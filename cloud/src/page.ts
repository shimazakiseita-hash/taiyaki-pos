/** お客さんのスマホで開くページ（外部リソースなし・5秒ごとに更新） */
export const PAGE_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>呼び出し状況｜およげない！たいやきくん</title>
<style>
  :root {
    --navy: #1b2a4a; --navy-light: #2e4a7a; --paper: #faf6ee; --ink: #1a1a1a;
    --red: #c8322b; --ok: #2f7d4f; --warn: #d9822b;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100dvh; background: var(--navy); color: var(--paper);
    font-family: "Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, system-ui, sans-serif;
  }
  main { max-width: 40rem; margin: 0 auto; padding: 1.25rem 1rem 2rem; display: flex; flex-direction: column; gap: 1.25rem; }
  h1 { margin: 0; text-align: center; font-size: 1.6rem; font-weight: 900; }
  h1 small { display: block; font-size: 1rem; font-weight: 700; opacity: 0.8; }
  .card { background: var(--paper); color: var(--ink); border-radius: 1rem; padding: 1rem; }
  form { display: flex; gap: 0.5rem; align-items: center; }
  label { font-weight: 700; white-space: nowrap; }
  input {
    flex: 1; min-width: 0; font: inherit; font-size: 1.5rem; font-weight: 900; padding: 0.4rem 0.6rem;
    border: 2px solid var(--navy-light); border-radius: 0.6rem; text-align: center;
  }
  button {
    font: inherit; font-weight: 900; font-size: 1.1rem; color: var(--paper); background: var(--navy-light);
    border: 0; border-radius: 0.6rem; padding: 0.7rem 1rem; min-height: 3rem;
  }
  #mine { margin: 0.75rem 0 0; font-size: 1.15rem; font-weight: 700; line-height: 1.5; }
  #mine:empty { display: none; }
  #mine.ready { color: var(--paper); background: var(--red); border-radius: 0.6rem; padding: 0.75rem; font-size: 1.3rem; }
  h2 {
    margin: 0 auto 0.75rem; width: fit-content; padding: 0.3rem 1.5rem; border-radius: 999px;
    font-size: 1.3rem; font-weight: 900;
  }
  .ready-h { background: var(--red); }
  .waiting-h { background: var(--navy-light); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
  .ready-list li {
    background: var(--paper); color: var(--ink); border-radius: 0.8rem; min-width: 5.5rem; padding: 0.3rem 0.8rem;
    text-align: center; font-size: 3rem; font-weight: 900; font-variant-numeric: tabular-nums;
  }
  .waiting-list li { font-size: 1.5rem; font-weight: 700; min-width: 3rem; text-align: center; font-variant-numeric: tabular-nums; }
  li.me { outline: 0.25rem solid var(--warn); outline-offset: 0.15rem; border-radius: 0.5rem; }
  .empty { text-align: center; opacity: 0.8; margin: 0; }
  #updated { text-align: center; font-size: 0.9rem; opacity: 0.85; margin: 0; }
  #stale { background: var(--warn); color: var(--ink); border-radius: 0.6rem; padding: 0.75rem; font-weight: 700; margin: 0; }
  #stale[hidden] { display: none; }
</style>
</head>
<body>
<main>
  <h1><small>およげない！たいやきくん</small>呼び出し状況</h1>

  <section class="card" aria-labelledby="mine-label">
    <form id="form">
      <label id="mine-label" for="n">あなたの番号</label>
      <input id="n" name="n" type="number" inputmode="numeric" min="1" max="9999" placeholder="例：12">
      <button type="submit">見る</button>
    </form>
    <p id="mine" aria-live="polite"></p>
  </section>

  <p id="stale" hidden>しばらく情報が更新されていません。お店の呼び出し表示もご確認ください。</p>

  <section aria-labelledby="ready-h">
    <h2 id="ready-h" class="ready-h">お呼び出し中</h2>
    <ul id="ready" class="ready-list"></ul>
    <p id="ready-empty" class="empty" hidden>ただいまお呼び出し中の番号はありません</p>
  </section>

  <section aria-labelledby="waiting-h">
    <h2 id="waiting-h" class="waiting-h">焼いています</h2>
    <ul id="waiting" class="waiting-list"></ul>
    <p id="waiting-empty" class="empty" hidden>焼き待ちの注文はありません</p>
  </section>

  <p id="updated"></p>
</main>
<script>
(function () {
  var POLL_MS = 5000;
  var STALE_MS = 60000;
  var KEY = "taiyaki-number";
  var input = document.getElementById("n");
  var mine = document.getElementById("mine");
  var updatedAt = null;
  var myNumber = null;

  function load() {
    var q = new URLSearchParams(location.search).get("n");
    if (q) return q;
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(n) {
    try { if (n) localStorage.setItem(KEY, n); else localStorage.removeItem(KEY); } catch (e) {}
    var url = new URL(location.href);
    if (n) url.searchParams.set("n", n); else url.searchParams.delete("n");
    history.replaceState(null, "", url);
  }
  function setNumber(raw) {
    var n = parseInt(raw, 10);
    myNumber = n >= 1 ? n : null;
    input.value = myNumber ? String(myNumber) : "";
    save(myNumber ? String(myNumber) : null);
  }

  function renderList(id, numbers) {
    var ul = document.getElementById(id);
    ul.textContent = "";
    numbers.forEach(function (num) {
      var li = document.createElement("li");
      li.textContent = String(num);
      if (num === myNumber) li.className = "me";
      ul.appendChild(li);
    });
    document.getElementById(id + "-empty").hidden = numbers.length > 0;
  }

  function renderMine(lookup) {
    mine.className = "";
    if (!myNumber || !lookup) { mine.textContent = ""; return; }
    if (lookup.state === "ready") {
      mine.className = "ready";
      mine.textContent = myNumber + "番：できあがりました！お店でお受け取りください";
    } else if (lookup.state === "waiting") {
      mine.textContent = lookup.ahead === 0
        ? myNumber + "番：焼いています。前に待っている注文はありません"
        : myNumber + "番：焼いています。前にあと " + lookup.ahead + " 件";
    } else {
      mine.textContent = myNumber + "番は、お呼び出し中・焼き待ちにありません。お受け取り済みか、番号をご確認ください";
    }
  }

  function renderUpdated() {
    var el = document.getElementById("updated");
    if (!updatedAt) { el.textContent = "準備中です"; return; }
    var sec = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
    el.textContent = "最終更新：" + (sec < 60 ? sec + "秒前" : Math.floor(sec / 60) + "分前");
    document.getElementById("stale").hidden = Date.now() - updatedAt < STALE_MS;
  }

  function refresh() {
    var url = "/api/status" + (myNumber ? "?n=" + myNumber : "");
    fetch(url, { cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var s = data.status;
        updatedAt = s ? Date.parse(s.updatedAt) : null;
        renderList("ready", s ? s.ready : []);
        renderList("waiting", s ? s.waiting : []);
        renderMine(data.lookup);
        renderUpdated();
      })
      .catch(function () { renderUpdated(); });
  }

  document.getElementById("form").addEventListener("submit", function (e) {
    e.preventDefault();
    setNumber(input.value);
    input.blur();
    refresh();
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });

  setNumber(load());
  refresh();
  setInterval(refresh, POLL_MS);
  setInterval(renderUpdated, 1000);
})();
</script>
</body>
</html>
`;
