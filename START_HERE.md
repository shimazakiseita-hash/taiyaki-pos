# Claude Code の始め方

## 1. 準備（Ubuntu 26.04）
```bash
# Node.js 20以上があるか確認（なければ nvm で入れる）
node -v

# ネイティブモジュール（better-sqlite3）のビルドに必要
sudo apt update && sudo apt install -y build-essential python3

# このフォルダをホーム以下に置く
cd ~/taiyaki-pos
code .          # VS Code で開く
claude          # Claude Code を起動
```

## 2. 最初に貼るプロンプト
```
CLAUDE.md と docs/spec.md、docs/tasks.md を読んで、フェーズ0から始めて。
既存の CLAUDE.md と docs/ は消さずに、このフォルダの中に Next.js プロジェクトを作ってほしい
（create-next-app は空でないフォルダに作れないので、一時フォルダに作ってから中身を移動して）。
フェーズ0が終わったら受け入れ条件の確認方法を教えて、止まって。
```

## 3. 以降のフェーズ
```
docs/tasks.md のフェーズ1を進めて。終わったらテストを通して、コミットして止まって。
```
を、フェーズ番号を変えながら繰り返す。各フェーズの後に自分で画面を触って確認してから次へ進む。

## 4. 実機テスト（フェーズ0の直後に一度やっておくと安心）
先に `docs/event-day.md` の「レジPC（Ubuntu）のネットワーク設定」を済ませておく。
スマホのテザリングにPCをつなぎ、`npm run dev` のまま、スマホから `http://<PCのIP>:3000` を開く。
