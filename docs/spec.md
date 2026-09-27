# 仕様書 — たい焼き屋台 注文管理アプリ

## 1. 運用の前提
| 項目 | 内容 |
|---|---|
| 開催 | 寮祭当日の1日のみ |
| 提供方式 | 先に会計 → 呼び出し番号を発行 → 焼き上がったら番号で呼んで受け渡し |
| 支払い | 100円券の金券のみ（お釣りは発生しない） |
| 端末 | レジPC 1台（サーバー兼用）、キッチンPC 1台、スタッフの個人スマホ数台 |
| ネットワーク | スマホのテザリングで作るローカルネットワーク。インターネット接続は不要 |
| 販売目標 | 300個（味ごとの販売数に上限は設けない） |

## 2. メニューと料金
| id | 表示名 | テーマ色 |
|---|---|---|
| anko | あんこ | 赤 |
| custard | カスタード | 黄 |
| matcha | 抹茶 | 緑 |
| choco | チョコ | 茶 |

- 味ごとの仕込み上限・売り切れ判定はない（数が当日決まっていないため）。材料が尽きたら口頭で案内する

- 単品200円、**味を問わず3個で500円**
- 1注文の合計金額 = `floor(総個数 / 3) * 500 + (総個数 % 3) * 200`
  - 例：1個=200、2個=400、3個=500、4個=700、5個=900、6個=1000
- 金券枚数 = 合計金額 / 100
- 1注文の総個数は 1〜20 個

## 3. 注文の状態遷移
```
waiting（焼き待ち） → ready（完成・呼び出し中） → served（受け渡し済み）
waiting → cancelled（取り消し）
ready → waiting（「完成」の押し間違いを戻す）
served → ready（「渡した」の押し間違いを戻す）
```
上記以外の遷移はエラー（409）。

## 4. データモデル（SQLite）
```sql
CREATE TABLE orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  number      INTEGER NOT NULL UNIQUE,      -- 呼び出し番号（1からの連番）
  status      TEXT NOT NULL CHECK (status IN ('waiting','ready','served','cancelled')),
  total_qty   INTEGER NOT NULL,
  amount      INTEGER NOT NULL,             -- 円
  created_at  TEXT NOT NULL,                -- ISO8601
  ready_at    TEXT,
  served_at   TEXT,
  cancelled_at TEXT
);
CREATE TABLE order_items (
  order_id INTEGER NOT NULL REFERENCES orders(id),
  flavor   TEXT NOT NULL CHECK (flavor IN ('anko','custard','matcha','choco')),
  qty      INTEGER NOT NULL CHECK (qty > 0),
  PRIMARY KEY (order_id, flavor)
);
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL                        -- JSON文字列
);
```
- 呼び出し番号：`SELECT COALESCE(MAX(number),0)+1 FROM orders` を注文INSERTと同一トランザクションで取得
- settings：`target_qty`（300）
- WALモードを有効にする

## 5. 集計の定義
- **販売数**：status が cancelled 以外の注文の個数合計（味別・全体）
- **売上**：cancelled 以外の amount 合計。**金券枚数**＝売上/100（閉店後の金券と照合する）
- **焼くべき数**：status = waiting の注文の個数合計（味別）
- **平均待ち時間**：直近10件の served 注文の `served_at - created_at` の平均

## 6. 画面
すべて `http://<レジPCのIP>:3000/<パス>` でアクセス。トップ `/` は各画面へのリンク集。

### 6.1 レジ `/register`（レジPC）
- 味ボタン4つ（テーマ色、大きく）。タップで+1、各味に−ボタン
- 画面右側：選択中の内訳、総個数、**合計金額と「金券 ◯枚」を特大表示**
- 「確定」→ 注文作成 → 発行された**呼び出し番号を画面いっぱいに表示**（番号札に書く／伝える用）→ 「次のお客さん」で入力画面に戻る
- 「クリア」で入力中の内容を破棄
- 直近の注文5件を表示し、waiting のものは取り消しできる（確認ダイアログあり）

### 6.2 キッチン `/kitchen`（キッチンPC）
- 上部：**味ごとの「焼くべき数」**を大きく表示
- 下部：waiting の注文を古い順にカード表示（番号・経過時間・味別個数）
  - 経過10分以上のカードは強調表示
  - 「完成」ボタン → ready
- 右側：ready の注文一覧。「渡した」→ served、「戻す」→ waiting
- 最近 served にした注文を3件表示し、「戻す」で ready に戻せる

### 6.3 呼び出し表示 `/display`（お客さん向け、スマホやPCの別ウィンドウ）
- ready の番号を特大で表示（「お呼び出し中」）
- waiting の番号を小さく表示（「焼いています」）
- 操作ボタンなし。新しく ready になった番号は数秒間ハイライト

### 6.4 管理 `/admin`（責任者のスマホ）
- 売上金額・金券枚数・販売数（全体と味別）・目標300個に対する進捗バー
- 現在の待ち件数と平均待ち時間
- 全注文のCSVダウンロード（バックアップ・事後集計用）
- サーバーのLAN上のURL表示（他の端末をつなぐとき用）

## 7. API
| メソッド | パス | 内容 |
|---|---|---|
| POST | `/api/orders` | 注文作成。body: `{ items: { flavor, qty }[] }` → `{ id, number, amount, tickets }` |
| GET | `/api/orders?status=waiting,ready` | 注文一覧（items込み） |
| PATCH | `/api/orders/:id` | 状態変更。body: `{ status }`。不正遷移は 409 |
| GET | `/api/summary` | 5章の集計一式 |
| GET/PUT | `/api/settings` | 目標（`{ targetQty }`） |
| GET | `/api/export.csv` | 全注文CSV（1行＝1注文、味別個数を列に） |
| GET | `/api/server-info` | LAN上のIPアドレスとURL |

## 8. 非機能要件
- 外部リソースへの通信ゼロ（フォントはシステムフォント）
- 5台程度からの2秒ポーリングで問題なく動くこと
- サーバー再起動後もデータが残ること
- スマホ縦画面（/display・/admin）とPC横画面（/register・/kitchen）に対応
- 認証なし（ローカルネットワーク限定のため）
