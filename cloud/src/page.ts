/** お客さんのスマホで開くページ（5秒ごとに更新。画像とフォントは cloud/public から配る） */
import { FLAVORS, type FlavorId } from "../../src/lib/menu";
import { SET_PRICE, SET_SIZE, TICKET_VALUE, UNIT_PRICE } from "../../src/lib/pricing";
import { BRUSH_TEXT } from "./brushText";

const FLAVOR_COLORS: Record<FlavorId, { bg: string; fg: string }> = {
  anko: { bg: "var(--anko)", fg: "#fff" },
  custard: { bg: "var(--custard)", fg: "var(--ink)" },
  matcha: { bg: "var(--matcha)", fg: "#fff" },
  choco: { bg: "var(--choco)", fg: "#fff" },
};

const SANS = `"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", Meiryo, system-ui, sans-serif`;

const flavorChips = FLAVORS.map(
  (f) => `<li style="background:${FLAVOR_COLORS[f.id].bg};color:${FLAVOR_COLORS[f.id].fg}">${f.name}</li>`,
).join("");

export const PAGE_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1b2a4a">
<title>呼び出し状況｜およげない！たいやきくん</title>
<link rel="preload" href="/fonts/yuji-syuku-subset.woff2" as="font" type="font/woff2" crossorigin>
<style>
  @font-face {
    font-family: "Yuji Syuku";
    src: url(/fonts/yuji-syuku-subset.woff2) format("woff2");
    font-display: swap;
  }
  :root {
    --navy: #1b2a4a; --navy-light: #2e4a7a; --paper: #faf6ee; --ink: #1a1a1a; --red: #c8322b;
    --anko: #9e3232; --custard: #e3ae2f; --matcha: #5a8a3a; --choco: #6b4226; --warn: #d9822b;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; min-height: 100dvh; color: #fff; font-family: ${SANS}; font-variant-numeric: tabular-nums; }
  img { display: block; max-width: 100%; height: auto; }
  button { font: inherit; cursor: pointer; touch-action: manipulation; }
  [hidden] { display: none !important; }
  .brush { font-family: "Yuji Syuku", ${SANS}; font-weight: 400; }

  /* 青海波（店内の呼び出し表示と同じ描き方） */
  .sea {
    --sg-bg: var(--navy);
    --sg-line: color-mix(in srgb, var(--navy-light) 70%, var(--navy));
    --sg-size: 72px;
    background-color: var(--sg-bg);
    background-image:
      radial-gradient(circle at 100% 150%, var(--sg-bg) 24%, var(--sg-line) 24% 28%, var(--sg-bg) 28% 36%, var(--sg-line) 36% 40%, transparent 40%),
      radial-gradient(circle at 0 150%, var(--sg-bg) 24%, var(--sg-line) 24% 28%, var(--sg-bg) 28% 36%, var(--sg-line) 36% 40%, transparent 40%),
      radial-gradient(circle at 50% 100%, var(--sg-line) 10%, var(--sg-bg) 10% 23%, var(--sg-line) 23% 30%, var(--sg-bg) 30% 43%, var(--sg-line) 43% 50%, var(--sg-bg) 50% 63%, var(--sg-line) 63% 71%, transparent 71%),
      radial-gradient(circle at 100% 50%, var(--sg-line) 5%, var(--sg-bg) 5% 15%, var(--sg-line) 15% 20%, var(--sg-bg) 20% 29%, var(--sg-line) 29% 34%, var(--sg-bg) 34% 44%, var(--sg-line) 44% 49%, transparent 49%),
      radial-gradient(circle at 0 50%, var(--sg-line) 5%, var(--sg-bg) 5% 15%, var(--sg-line) 15% 20%, var(--sg-bg) 20% 29%, var(--sg-line) 29% 34%, var(--sg-bg) 34% 44%, var(--sg-line) 44% 49%, transparent 49%);
    background-size: var(--sg-size) calc(var(--sg-size) / 2);
    background-attachment: fixed;
  }

  main { max-width: 34rem; margin: 0 auto; padding: 1rem 1rem calc(2rem + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 1.5rem; }
  header { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
  header img { width: min(52vw, 13rem); filter: drop-shadow(0 0.4rem 0 rgb(0 0 0 / 0.35)); }
  h1 { margin: 0; font-size: 2rem; letter-spacing: 0.1em; text-shadow: 0 0.15rem 0 rgb(0 0 0 / 0.35); }

  .card { background: var(--paper); color: var(--ink); border-radius: 1.5rem; padding: 1.25rem; box-shadow: 0 0.4rem 0 rgb(0 0 0 / 0.3); }

  /* 番号の入力 */
  form { display: flex; flex-direction: column; gap: 0.6rem; }
  label { font-weight: 900; font-size: 1.2rem; color: var(--navy); }
  .row { display: flex; gap: 0.5rem; }
  input {
    flex: 1; min-width: 0; font: inherit; font-size: 1.8rem; font-weight: 900; padding: 0.3rem 0.6rem; text-align: center;
    border: 3px solid var(--navy); border-radius: 0.8rem; background: #fff; color: var(--ink);
  }
  .primary { color: #fff; background: var(--red); border: 0; border-radius: 0.8rem; padding: 0 1.4rem; min-height: 3.5rem; font-size: 1.2rem; font-weight: 900; box-shadow: 0 0.25rem 0 rgb(0 0 0 / 0.25); }
  .hint { margin: 0; font-size: 0.95rem; color: #4a4a4a; }

  /* 自分の番号 */
  .hero { display: flex; align-items: center; gap: 1rem; }
  .hero .ukiwa { width: 7rem; flex-shrink: 0; padding: 0.77rem; } /* % だと親の幅基準になるので固定 */
  .hero .ukiwa-inner[data-digits="1"], .hero .ukiwa-inner[data-digits="2"] { font-size: 56cqw; }
  .hero .ukiwa-inner[data-digits="3"] { font-size: 40cqw; }
  .hero-text { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
  .hero-label { margin: 0; font-weight: 700; color: #4a4a4a; }
  .state { margin: 0; font-size: 1.7rem; line-height: 1.25; color: var(--navy); white-space: nowrap; }
  .state.done { color: var(--red); font-size: 1.8rem; }
  .state.plain { font-family: ${SANS}; font-weight: 900; font-size: 1.25rem; white-space: normal; }
  .detail { margin: 0; font-size: 1.15rem; font-weight: 700; }
  .detail b { font-size: 1.8rem; color: var(--red); }
  #mine.is-done { outline: 0.3rem solid #fff; box-shadow: 0 0 2rem 0.5rem rgb(255 255 255 / 0.45), 0 0.4rem 0 rgb(0 0 0 / 0.3); }

  /* 進み具合：たい焼きが受け取り口へ泳いでいく */
  .track { position: relative; height: 3.4rem; margin: 1.25rem 0 0.25rem; border-radius: 999px; background: #dfe7f2; overflow: hidden; }
  .water { position: absolute; inset: 0 auto 0 0; width: 0; border-radius: 999px; background: linear-gradient(90deg, #9fd3ff, #4f8fd6); transition: width 1s ease; }
  .goal { position: absolute; right: 0.9rem; top: 50%; transform: translateY(-50%); font-size: 0.85rem; font-weight: 900; color: var(--navy); }
  .swimmer-lane { position: absolute; inset: 0 7rem 0 1.6rem; }
  .swimmer { position: absolute; top: 50%; left: 0; width: 3.2rem; transform: translate(-50%, -50%) scaleX(-1); transition: left 1s ease; animation: swim 2.4s ease-in-out infinite; }
  @keyframes swim {
    0%, 100% { transform: translate(-50%, -50%) scaleX(-1) rotate(-6deg); }
    50% { transform: translate(-50%, -62%) scaleX(-1) rotate(6deg); }
  }
  .link { margin-top: 0.75rem; background: none; border: 0; padding: 0.5rem 0; color: var(--navy-light); font-weight: 700; text-decoration: underline; }

  #stale { margin: 0; background: var(--warn); color: var(--ink); border-radius: 1rem; padding: 0.9rem 1rem; font-weight: 700; }

  /* 浮き輪（店内の呼び出し表示と同じ） */
  .ukiwa {
    container-type: inline-size; position: relative; aspect-ratio: 1; border-radius: 999px; padding: 11%;
    background: repeating-conic-gradient(from -15deg, var(--red) 0 30deg, #fff 30deg 60deg);
    box-shadow: 0 0.35rem 0 rgb(0 0 0 / 0.25), inset 0 0 0 2px rgb(0 0 0 / 0.15);
  }
  .ukiwa-inner {
    display: flex; height: 100%; align-items: center; justify-content: center; border-radius: 999px;
    background: #fff; box-shadow: inset 0 0.25rem 0.5rem rgb(0 0 0 / 0.18);
    color: var(--red); font-weight: 900; line-height: 1; letter-spacing: -0.04em;
  }
  .ukiwa-inner[data-digits="1"], .ukiwa-inner[data-digits="2"] { font-size: 44cqw; }
  .ukiwa-inner[data-digits="3"] { font-size: 32cqw; }
  .ukiwa-inner[data-digits="4"] { font-size: 24cqw; }
  .ukiwa.muted { background: repeating-conic-gradient(from -15deg, #9aa3b5 0 30deg, #fff 30deg 60deg); }
  .ukiwa.muted .ukiwa-inner { color: #5d6678; }
  @keyframes bob {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    25% { transform: translateY(-9%) rotate(-5deg); }
    75% { transform: translateY(3%) rotate(4deg); }
  }
  .ukiwa.bob { animation: bob 1.6s ease-in-out infinite; }
  .ukiwa.new { box-shadow: 0 0 0 0.3rem rgb(255 255 255 / 0.9), 0 0 2rem 0.4rem rgb(255 255 255 / 0.45); }
  @keyframes splash {
    0% { transform: translate(-50%, -50%) rotate(var(--a)) translateY(0) scale(0.4); opacity: 0; }
    15% { opacity: 1; }
    100% { transform: translate(-50%, -50%) rotate(var(--a)) translateY(-72cqw) scale(1); opacity: 0; }
  }
  .drop {
    position: absolute; top: 50%; left: 50%; width: 11cqw; height: 15cqw; pointer-events: none;
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    background: radial-gradient(circle at 35% 35%, #fff 0 20%, #9fd3ff 21% 100%);
    animation: splash 1.4s ease-out infinite; animation-delay: var(--d);
  }

  /* 呼び出し中・焼いています */
  h2 { margin: 0; font-size: 1.7rem; text-align: center; }
  .pill { margin: 0 auto; width: fit-content; padding: 0.15rem 1.6rem; border-radius: 999px; background: var(--red); box-shadow: 0 0.25rem 0 rgb(0 0 0 / 0.3); letter-spacing: 0.08em; }
  .sub { margin: 0.6rem 0 1rem; text-align: center; font-weight: 700; font-size: 0.9rem; opacity: 0.9; }
  ul { list-style: none; margin: 0; padding: 0; }
  .ready-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem 4%; }
  .ready-list li { width: 29%; }
  .ready-list .new-label { margin: 0.35rem 0 0; text-align: center; font-weight: 900; color: #fde047; font-size: 0.95rem; }
  .idle { display: flex; align-items: center; gap: 1rem; }
  .idle img { width: 6.5rem; flex-shrink: 0; }
  .idle p { margin: 0; font-size: 1.5rem; line-height: 1.4; color: var(--navy); }
  @keyframes drift {
    0%, 100% { transform: translateY(0) rotate(-3deg); }
    50% { transform: translateY(-6%) rotate(3deg); }
  }
  .drift { animation: drift 4s ease-in-out infinite; }
  .baking { background: rgb(255 255 255 / 0.1); border-radius: 1.5rem; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .baking h2 { font-size: 1.5rem; opacity: 0.9; }
  .baking h2 span { font-family: ${SANS}; font-size: 1rem; font-weight: 400; }
  .waiting-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
  .waiting-list li { min-width: 3.2rem; padding: 0.15rem 0.6rem; border-radius: 0.7rem; background: rgb(255 255 255 / 0.15); text-align: center; font-size: 1.5rem; font-weight: 700; color: rgb(255 255 255 / 0.85); }
  .waiting-list li.me { background: #fff; color: var(--red); font-weight: 900; }
  .muted-text { margin: 0; text-align: center; opacity: 0.75; }
  #avg { margin: 0; text-align: center; font-weight: 700; }

  /* メニュー */
  .menu { display: flex; flex-direction: column; gap: 0.8rem; text-align: center; }
  .menu h2 { color: var(--navy); }
  .prices { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.6rem 1rem; }
  .prices p { margin: 0; font-size: 1.2rem; font-weight: 700; }
  .prices b { font-size: 1.9rem; color: var(--red); }
  .prices .set { transform: rotate(-3deg); background: var(--red); color: #fff; border-radius: 0.8rem; padding: 0.2rem 0.8rem; box-shadow: 0 0.2rem 0 rgb(0 0 0 / 0.2); }
  .prices .set b { color: #fff; }
  .flavors { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
  .flavors li { padding: 0.3rem 0.9rem; border-radius: 999px; font-weight: 700; }
  .menu .note { margin: 0; font-size: 0.95rem; color: #4a4a4a; }

  #updated { margin: 0; text-align: center; font-size: 0.9rem; opacity: 0.8; }

  @media (prefers-reduced-motion: reduce) {
    .ukiwa.bob, .drift, .swimmer { animation: none; }
    .drop { display: none; }
    .water, .swimmer { transition: none; }
  }
</style>
</head>
<body class="sea">
<main>
  <header>
    <img src="/brand/logo.webp" alt="およげない！たいやきくん" width="560" height="595">
    <h1 class="brush">${BRUSH_TEXT.title}</h1>
  </header>

  <section id="mine" class="card" aria-label="あなたの番号">
    <form id="form">
      <label for="n">あなたの番号</label>
      <div class="row">
        <input id="n" name="n" type="number" inputmode="numeric" min="1" max="9999" placeholder="例：12" autocomplete="off">
        <button class="primary" type="submit">見る</button>
      </div>
      <p class="hint">番号札のQRコードを読み取ると、自動で入ります</p>
    </form>
    <div id="mine-view" hidden>
      <div class="hero">
        <div id="my-ukiwa" class="ukiwa"><div id="my-number" class="ukiwa-inner"></div></div>
        <div class="hero-text" aria-live="polite">
          <p class="hero-label">あなたの番号</p>
          <p id="my-state" class="state brush"></p>
          <p id="my-detail" class="detail"></p>
        </div>
      </div>
      <div id="track" class="track" aria-hidden="true">
        <div id="water" class="water"></div>
        <span class="goal">受け取り口</span>
        <div class="swimmer-lane"><img id="swimmer" class="swimmer" src="/brand/character.webp" alt="" width="320" height="320"></div>
      </div>
      <button id="change" class="link" type="button">番号を変える</button>
    </div>
  </section>

  <p id="stale" hidden>しばらく情報が更新されていません。お店の呼び出し表示もご確認ください。</p>

  <section aria-labelledby="ready-h">
    <h2 id="ready-h" class="pill brush">${BRUSH_TEXT.ready}</h2>
    <p class="sub">番号札をお持ちのうえ、受け取り口へお越しください</p>
    <ul id="ready" class="ready-list" aria-live="polite"></ul>
    <div id="idle" class="card idle" hidden>
      <img class="drift" src="/brand/character.webp" alt="" width="320" height="320">
      <p id="idle-msg" class="brush"></p>
    </div>
  </section>

  <section class="baking" aria-labelledby="baking-h">
    <h2 id="baking-h" class="brush">${BRUSH_TEXT.baking}<span id="baking-count"></span></h2>
    <ul id="waiting" class="waiting-list"></ul>
    <p id="waiting-empty" class="muted-text" hidden>ただいま焼き待ちはありません</p>
    <p id="avg" hidden></p>
  </section>

  <section class="card menu" aria-labelledby="menu-h">
    <h2 id="menu-h" class="brush">${BRUSH_TEXT.menu}</h2>
    <div class="prices">
      <p>1個 <b>${UNIT_PRICE}</b>円</p>
      <p class="set">${SET_SIZE}個セットがお得！ <b>${SET_PRICE}</b>円</p>
    </div>
    <ul class="flavors">${flavorChips}</ul>
    <p class="note">味はまぜてもOK。お支払いは金券（${TICKET_VALUE}円券）です</p>
  </section>

  <p id="updated"></p>
</main>
<script>
(function () {
  var T = ${JSON.stringify(BRUSH_TEXT)};
  var POLL_MS = 5000;
  var STALE_MS = 60000;
  var NEW_MS = 6000;
  var KEY = "taiyaki-number";
  var BASE_TITLE = document.title;
  var DROPS = [["-70deg", "0s"], ["-25deg", "0.35s"], ["20deg", "0.15s"], ["65deg", "0.5s"], ["-115deg", "0.25s"], ["110deg", "0.6s"]];

  var input = document.getElementById("n");
  var form = document.getElementById("form");
  var view = document.getElementById("mine-view");
  var updatedAt = null;
  var myNumber = null;
  var lastState = null;
  var knownReady = null;
  var newUntil = {};

  function $(id) { return document.getElementById(id); }
  function store(key, value) {
    try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) {}
  }
  function recall(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function setNumber(raw) {
    var n = parseInt(raw, 10);
    myNumber = n >= 1 && n <= 9999 ? n : null;
    lastState = null;
    store(KEY, myNumber ? String(myNumber) : null);
    var url = new URL(location.href);
    if (myNumber) url.searchParams.set("n", String(myNumber)); else url.searchParams.delete("n");
    history.replaceState(null, "", url);
    form.hidden = !!myNumber;
    view.hidden = !myNumber;
    input.value = "";
  }

  function ukiwa(el, num) {
    var inner = el.querySelector(".ukiwa-inner");
    inner.textContent = String(num);
    inner.setAttribute("data-digits", String(String(num).length));
  }
  function splash(el, on) {
    var drops = el.querySelectorAll(".drop");
    if (!on) { for (var i = 0; i < drops.length; i++) drops[i].remove(); return; }
    if (drops.length) return;
    DROPS.forEach(function (d) {
      var s = document.createElement("span");
      s.className = "drop";
      s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--a", d[0]);
      s.style.setProperty("--d", d[1]);
      el.appendChild(s);
    });
  }

  /* 進み具合：最初に見たときの「前の件数」を基準に、0件に近づくほど受け取り口へ */
  function progress(ahead) {
    var key = "taiyaki-max-ahead-" + myNumber;
    var max = Math.max(ahead, parseInt(recall(key) || "0", 10) || 0);
    store(key, String(max));
    return (max - ahead + 1) / (max + 2);
  }
  function setTrack(ratio) {
    $("water").style.width = Math.round(ratio * 100) + "%";
    $("swimmer").style.left = Math.round(ratio * 100) + "%";
  }

  function renderMine(lookup) {
    if (!myNumber) return;
    var box = $("my-ukiwa"), state = $("my-state"), detail = $("my-detail");
    ukiwa(box, myNumber);
    var s = lookup ? lookup.state : null;
    var done = s === "ready";
    $("mine").classList.toggle("is-done", done);
    box.classList.toggle("bob", done);
    box.classList.toggle("muted", s === "notFound");
    splash(box, done);
    state.className = "state brush" + (done ? " done" : "") + (s === "notFound" || !s ? " plain" : "");
    $("track").hidden = s === "notFound" || !s;

    if (done) {
      state.textContent = T.done;
      detail.textContent = "受け取り口へお越しください";
      setTrack(1);
    } else if (s === "waiting") {
      state.textContent = T.baking;
      detail.innerHTML = lookup.ahead === 0 ? "前に待っている注文はありません" : "前にあと <b>" + lookup.ahead + "</b> 件";
      setTrack(progress(lookup.ahead));
    } else if (s === "notFound") {
      state.textContent = "呼び出し中・焼き待ちにありません";
      detail.textContent = "お受け取り済みか、番号をご確認ください";
    } else {
      state.textContent = "準備中です";
      detail.textContent = "";
    }

    document.title = done ? "【できあがり！】" + BASE_TITLE : BASE_TITLE;
    // 見ている間にできあがったら、震えて知らせる（対応している端末だけ）
    if (done && lastState === "waiting" && navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    if (s) lastState = s;
  }

  function renderReady(numbers, baking) {
    var now = Date.now();
    if (knownReady) {
      numbers.forEach(function (n) { if (knownReady.indexOf(n) < 0) newUntil[n] = now + NEW_MS; });
    }
    knownReady = numbers.slice();
    var ul = $("ready");
    ul.textContent = "";
    numbers.forEach(function (n) {
      var fresh = (newUntil[n] || 0) > now;
      var li = document.createElement("li");
      var ring = document.createElement("div");
      ring.className = "ukiwa" + (fresh || n === myNumber ? " bob new" : "");
      var inner = document.createElement("div");
      inner.className = "ukiwa-inner";
      ring.appendChild(inner);
      ukiwa(ring, n);
      if (fresh) splash(ring, true);
      li.appendChild(ring);
      if (fresh || n === myNumber) {
        var label = document.createElement("p");
        label.className = "new-label";
        label.textContent = n === myNumber ? "あなたの番号" : "できあがり！";
        li.appendChild(label);
      }
      ul.appendChild(li);
    });
    $("idle").hidden = numbers.length > 0;
    $("idle-msg").textContent = baking ? T.busy : T.welcome;
  }

  function renderWaiting(numbers, avgSec) {
    var ul = $("waiting");
    ul.textContent = "";
    numbers.forEach(function (n) {
      var li = document.createElement("li");
      li.textContent = String(n);
      if (n === myNumber) li.className = "me";
      ul.appendChild(li);
    });
    $("waiting-empty").hidden = numbers.length > 0;
    $("baking-count").textContent = numbers.length ? "（" + numbers.length + "件）" : "";
    var avg = $("avg");
    avg.hidden = avgSec === null || avgSec === undefined;
    if (!avg.hidden) avg.textContent = "最近は、注文から受け取りまで平均 約" + Math.max(1, Math.round(avgSec / 60)) + "分";
  }

  function renderUpdated() {
    var el = $("updated");
    if (!updatedAt) { el.textContent = "準備中です"; $("stale").hidden = true; return; }
    var sec = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
    el.textContent = "最終更新：" + (sec < 60 ? sec + "秒前" : Math.floor(sec / 60) + "分前");
    $("stale").hidden = Date.now() - updatedAt < STALE_MS;
  }

  function refresh() {
    fetch("/api/status" + (myNumber ? "?n=" + myNumber : ""), { cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var s = data.status;
        updatedAt = s ? Date.parse(s.updatedAt) : null;
        var waiting = s ? s.waiting : [];
        renderReady(s ? s.ready : [], waiting.length > 0);
        renderWaiting(waiting, s ? s.avgWaitSeconds : null);
        renderMine(data.lookup);
        renderUpdated();
      })
      .catch(renderUpdated);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    setNumber(input.value);
    refresh();
  });
  $("change").addEventListener("click", function () {
    setNumber(null);
    document.title = BASE_TITLE;
    input.focus();
    refresh();
  });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });

  setNumber(new URLSearchParams(location.search).get("n") || recall(KEY));
  refresh();
  setInterval(refresh, POLL_MS);
  setInterval(renderUpdated, 1000);
})();
</script>
</body>
</html>
`;
