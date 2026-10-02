/*
 * ミニゲーム「およげない？たいやきくん」と今日のランキング（お客さん向けページ用）
 * タップで少し浮かぶ。網（上）と岩（下）をよけ、浮き輪を集める。底に沈むか、ぶつかったら終わり。
 * 10個よけるごとにステージ（景色と仕掛け）が変わる。速さとすき間の狭さは、よけた数だけで決まり、ステージが一周しても戻らない。
 * 自分の番号ができあがったら、ゲームを止めて知らせる（ページから taiyakiGame.ready() が呼ばれる）
 */
(function () {
  "use strict";

  var GRAVITY = 1500;
  var FLAP = -430;
  var OBSTACLE_W = 64;
  var PER_STAGE = 10;
  var RING_POINTS = 3;
  var GOLD_POINTS = 10;
  var NAME_KEY = "taiyaki-name";
  var BEST_KEY = "taiyaki-best";
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ステージごとの景色と仕掛け。move はすき間が上下に動く幅、jelly はクラゲが出る確率 */
  var STAGES = [
    { name: "浅瀬", top: "#6cb8ea", bottom: "#2f74b5", floor: "#e8cf98", dot: "#cfae6c", rock: "#6b7488", move: 0, jelly: 0, fish: "rgba(255,255,255,0.35)" },
    { name: "サンゴ礁", top: "#43c0b5", bottom: "#1c6d8c", floor: "#f3c2ac", dot: "#e39a83", rock: "#d9666b", move: 45, jelly: 0, fish: "rgba(255,214,102,0.75)" },
    { name: "深海", top: "#1f3d73", bottom: "#081430", floor: "#3a4258", dot: "#2a3146", rock: "#3f4a63", move: 55, jelly: 0.55, fish: "rgba(140,220,255,0.35)" },
    { name: "嵐の海", top: "#59657a", bottom: "#1d2533", floor: "#6b5b4b", dot: "#55473a", rock: "#4b5263", move: 65, jelly: 0.35, fish: "rgba(255,255,255,0.2)" },
  ];
  var STORM = STAGES[STAGES.length - 1];

  var root = document.getElementById("game");
  var canvas = document.getElementById("game-canvas");
  var panel = document.getElementById("game-panel");
  var ctx = canvas.getContext("2d");
  var img = new Image();
  img.src = "/brand/taiyaki.webp"; // ロゴから切り抜いた、たい焼きの形の絵（左向き）

  var W = 0, H = 0, FLOOR = 0;
  var state = "closed"; // closed | title | playing | over | done
  var player, obstacles, jellies, bubbles, fishes, popups, score, passed, startedAt, lastTime;
  var stageIndex, stageShownAt, blend, flashUntil;

  function recall(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function store(key, v) { try { localStorage.setItem(key, v); } catch {} }
  function myNumber() { return window.taiyakiPage ? window.taiyakiPage.number() : null; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function button(text, cls, onClick) {
    var b = el("button", cls, text);
    b.type = "button";
    b.addEventListener("click", function (ev) { ev.stopPropagation(); onClick(); });
    return b;
  }

  // ── ステージ ──────────────────────────────
  function stage() { return STAGES[stageIndex % STAGES.length]; }
  function lap() { return Math.floor(stageIndex / STAGES.length); }
  function stageLabel() { return (lap() > 0 ? lap() + 1 + "周目 " : "") + stage().name; }
  // 速さとすき間はよけた数だけで決まる（ステージが一周して景色が浅瀬に戻っても、遅くはならない）
  function currentSpeed() { return Math.min(340, 150 + passed * 2.4); }
  function currentGap() { return H * Math.max(0.24, 0.36 - passed * 0.0015); }
  // 2周目からは、どの景色でも動くすき間とクラゲが出る
  function currentMove() { return lap() > 0 ? Math.max(stage().move, STORM.move) : stage().move; }
  function currentJelly() { return lap() > 0 ? Math.max(stage().jelly, STORM.jelly) : stage().jelly; }

  /* 色を混ぜる（ステージが変わるとき、景色をなめらかに切り替える） */
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) {
    var x = hex(a), y = hex(b);
    return "rgb(" + [0, 1, 2].map(function (i) { return Math.round(x[i] + (y[i] - x[i]) * t); }).join(",") + ")";
  }
  function colors() {
    var to = stage();
    var from = stageIndex > 0 ? STAGES[(stageIndex - 1) % STAGES.length] : to;
    var t = Math.min(1, blend);
    return { top: mix(from.top, to.top, t), bottom: mix(from.bottom, to.bottom, t), floor: mix(from.floor, to.floor, t), dot: mix(from.dot, to.dot, t) };
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = root.clientWidth;
    H = root.clientHeight;
    FLOOR = H - 44;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function reset() {
    player = { x: W * 0.3, y: H * 0.42, vy: 0, r: 20 };
    obstacles = [];
    jellies = [];
    bubbles = [];
    fishes = [];
    popups = [];
    score = 0;
    passed = 0;
    stageIndex = 0;
    stageShownAt = -10;
    blend = 1;
    flashUntil = 0;
  }

  function spawn() {
    var gap = currentGap();
    var move = currentMove();
    var base = 40 + move + Math.random() * Math.max(10, FLOOR - gap - 80 - move * 2);
    var roll = Math.random();
    obstacles.push({
      x: W + 20,
      base: base,
      top: base,
      bottom: base + gap,
      gap: gap,
      move: move,
      phase: Math.random() * Math.PI * 2,
      passed: false,
      ring: roll < 0.06 ? { gold: true, taken: false } : roll < 0.6 ? { gold: false, taken: false } : null,
    });
    // 障害物と障害物のあいだにクラゲ
    if (Math.random() < currentJelly()) {
      jellies.push({ x: W + 20 + Math.max(190, W * 0.55) / 2 + OBSTACLE_W / 2, y0: H * (0.25 + Math.random() * 0.45), phase: Math.random() * 6, r: 15 });
    }
  }

  // ── 描画 ────────────────────────────────
  function drawSea(t) {
    var c = colors();
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c.top);
    g.addColorStop(1, c.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    var s = stage();

    // 浅瀬：水面から差す光
    if (s.name === "浅瀬") {
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      for (var i = 0; i < 4; i++) {
        var x0 = ((i * W) / 3 + Math.sin(t * 0.6 + i) * 20) % (W + 80);
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 50, 0); ctx.lineTo(x0 + 140, FLOOR); ctx.lineTo(x0 + 60, FLOOR); ctx.fill();
      }
    }
    // 深海：光るプランクトン
    if (s.name === "深海") {
      ctx.fillStyle = "rgba(160,240,255,0.55)";
      for (var p = 0; p < 26; p++) {
        var px = (p * 97 + t * 12) % W, py = (p * 53) % FLOOR + Math.sin(t + p) * 6;
        ctx.beginPath(); ctx.arc(W - px, py, 1.5 + (p % 3) * 0.6, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 背景の小魚（ゆっくり左へ）
    ctx.fillStyle = s.fish;
    fishes.forEach(function (f) {
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 10 * f.s, 5 * f.s, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(f.x + 9 * f.s, f.y); ctx.lineTo(f.x + 16 * f.s, f.y - 5 * f.s); ctx.lineTo(f.x + 16 * f.s, f.y + 5 * f.s); ctx.fill();
    });

    // 水面（嵐は大きく揺れる）
    var storm = s.name === "嵐の海";
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = storm ? 4 : 3;
    ctx.beginPath();
    for (var x = 0; x <= W; x += 8) ctx.lineTo(x, (storm ? 16 : 10) + Math.sin(x / 26 + t * (storm ? 4 : 2.4)) * (storm ? 9 : 4));
    ctx.stroke();
    // 嵐：雨と稲光
    if (storm) {
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (var r = 0; r < 40; r++) {
        var rx = (r * 61 + t * 420) % (W + 40) - 20, ry = (r * 37 + t * 900) % FLOOR;
        ctx.moveTo(W - rx, ry); ctx.lineTo(W - rx - 6, ry + 14);
      }
      ctx.stroke();
      if (!REDUCED && t * 1000 < flashUntil) { ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(0, 0, W, H); }
    }

    // 泡
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    bubbles.forEach(function (b) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); });
    // 海底
    ctx.fillStyle = c.floor;
    ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.fillStyle = c.dot;
    for (var d = 0; d < W; d += 22) ctx.fillRect(d, FLOOR + 10 + (d % 3) * 8, 6, 3);
  }

  function drawNet(x, h) {
    ctx.fillStyle = "rgba(250,246,238,0.92)";
    ctx.fillRect(x, 0, OBSTACLE_W, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(x, 0, OBSTACLE_W, h); ctx.clip();
    ctx.strokeStyle = "#7a869e";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = -h; i < OBSTACLE_W + h; i += 14) {
      ctx.moveTo(x + i, 0); ctx.lineTo(x + i + h, h);
      ctx.moveTo(x + i + h, 0); ctx.lineTo(x + i, h);
    }
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#c8322b"; // 網の下端の浮き
    for (var f = x + 8; f < x + OBSTACLE_W; f += 20) { ctx.beginPath(); ctx.arc(f, h, 5, 0, Math.PI * 2); ctx.fill(); }
  }

  function drawBottom(x, y, t) {
    var s = stage();
    ctx.fillStyle = s.rock;
    if (s.name === "サンゴ礁") {
      // サンゴ：枝分かれした形
      ctx.fillRect(x + 8, y + 14, OBSTACLE_W - 16, FLOOR - y - 14);
      [[x + 14, 0], [x + 32, -10], [x + 50, 2]].forEach(function (b) {
        ctx.beginPath(); ctx.arc(b[0], y + 12 + b[1], 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(b[0] - 5, y + 12 + b[1], 10, 20);
      });
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x, FLOOR);
    ctx.lineTo(x, y + 18);
    ctx.quadraticCurveTo(x, y, x + 18, y);
    ctx.lineTo(x + OBSTACLE_W - 18, y);
    ctx.quadraticCurveTo(x + OBSTACLE_W, y, x + OBSTACLE_W, y + 18);
    ctx.lineTo(x + OBSTACLE_W, FLOOR);
    ctx.fill();
    if (s.name === "深海") {
      ctx.fillStyle = "rgba(160,240,255,0.7)"; // 岩に光る点
      [[14, 22], [40, 40], [26, 70]].forEach(function (p) { ctx.beginPath(); ctx.arc(x + p[0], y + p[1], 2.5, 0, Math.PI * 2); ctx.fill(); });
    } else {
      ctx.fillStyle = "#5a8a3a"; // 海藻（ゆらゆら）
      var sway = Math.sin(t * 2 + x / 40) * 3;
      ctx.fillRect(x + 10 + sway, y - 14, 6, 14);
      ctx.fillRect(x + OBSTACLE_W - 18 - sway, y - 22, 6, 22);
    }
  }

  function drawRing(x, y, gold) {
    for (var i = 0; i < 8; i++) {
      ctx.strokeStyle = i % 2 ? "#ffffff" : gold ? "#e3ae2f" : "#c8322b";
      ctx.lineWidth = gold ? 8 : 7;
      ctx.beginPath();
      ctx.arc(x, y, gold ? 15 : 13, (i * Math.PI) / 4, ((i + 1) * Math.PI) / 4);
      ctx.stroke();
    }
    if (gold) { ctx.strokeStyle = "rgba(255,230,140,0.6)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke(); }
  }

  function drawJelly(j, t) {
    var y = jellyY(j, t);
    ctx.fillStyle = "rgba(255,170,220,0.85)";
    ctx.beginPath(); ctx.arc(j.x, y, j.r, Math.PI, 0); ctx.lineTo(j.x + j.r, y + 4); ctx.lineTo(j.x - j.r, y + 4); ctx.fill();
    ctx.strokeStyle = "rgba(255,170,220,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = -2; i <= 2; i++) {
      var tx = j.x + i * 5;
      ctx.moveTo(tx, y + 4);
      ctx.quadraticCurveTo(tx + Math.sin(t * 5 + i) * 4, y + 14, tx, y + 24);
    }
    ctx.stroke();
  }

  function drawPlayer() {
    var w = player.r * 3.6;
    var h = img.naturalWidth ? (w * img.naturalHeight) / img.naturalWidth : w * 0.7;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(Math.max(-0.5, Math.min(0.7, player.vy / 700)));
    ctx.scale(-1, 1); // 絵は左向きなので右へ泳ぐように反転
    if (img.complete && img.naturalWidth) ctx.drawImage(img, -w / 2, -h / 2, w, h);
    else { ctx.fillStyle = "#e3ae2f"; ctx.beginPath(); ctx.arc(0, 0, player.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function drawText(text, x, y, size, alpha) {
    ctx.globalAlpha = alpha;
    ctx.font = "900 " + size + "px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = Math.max(4, size / 7);
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }

  function draw(t) {
    drawSea(t);
    obstacles.forEach(function (o) {
      drawNet(o.x, o.top);
      drawBottom(o.x, o.bottom, t);
      if (o.ring && !o.ring.taken) drawRing(o.x + OBSTACLE_W / 2, (o.top + o.bottom) / 2, o.ring.gold);
    });
    jellies.forEach(function (j) { drawJelly(j, t); });
    drawPlayer();
    popups.forEach(function (p) { drawText(p.text, p.x, p.y, 26, Math.max(0, p.life)); });
    if (state === "playing" || state === "over") {
      drawText(String(score), W / 2, 76, 44, 1);
      var since = t - stageShownAt;
      if (since < 2) drawText("ステージ" + (stageIndex + 1) + "　" + stageLabel(), W / 2, H * 0.28, 26, Math.min(1, 2 - since));
    }
  }

  // ── 動き ────────────────────────────────
  function jellyY(j, t) { return j.y0 + Math.sin(t * 1.8 + j.phase) * 40; }

  function hitsRect(o) {
    var cx = Math.max(o.x, Math.min(player.x, o.x + OBSTACLE_W));
    var r = player.r * 0.8; // 見た目より少し小さめに判定（理不尽に感じないように）
    function near(top, bottom) {
      var cy = Math.max(top, Math.min(player.y, bottom));
      var dx = player.x - cx, dy = player.y - cy;
      return dx * dx + dy * dy < r * r;
    }
    return near(0, o.top) || near(o.bottom, FLOOR);
  }

  function popup(text) { popups.push({ text: text, x: player.x + 30, y: player.y - 20, life: 1 }); }

  function step(dt, t) {
    if (Math.random() < dt * 3) bubbles.push({ x: Math.random() * W, y: FLOOR, r: 2 + Math.random() * 4 });
    bubbles.forEach(function (b) { b.y -= 40 * dt; });
    bubbles = bubbles.filter(function (b) { return b.y > 0; });
    if (Math.random() < dt * 0.8) fishes.push({ x: W + 20, y: 60 + Math.random() * (FLOOR - 120), s: 0.7 + Math.random() * 0.8, v: 30 + Math.random() * 40 });
    fishes.forEach(function (f) { f.x -= f.v * dt; });
    fishes = fishes.filter(function (f) { return f.x > -30; });
    popups.forEach(function (p) { p.y -= 40 * dt; p.life -= dt; });
    popups = popups.filter(function (p) { return p.life > 0; });
    blend += dt / 1.5;

    if (state !== "playing") {
      if (state === "title") player.y = H * 0.42 + Math.sin(t * 3) * 10;
      return;
    }

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y < player.r + 14) { player.y = player.r + 14; player.vy = 0; }
    if (player.y + player.r * 0.8 > FLOOR) return finish("沈んじゃった…");

    var speed = currentSpeed();
    var last = obstacles[obstacles.length - 1];
    if (!last || last.x < W - Math.max(190, W * 0.55)) spawn();
    for (var i = 0; i < obstacles.length; i++) {
      var o = obstacles[i];
      o.x -= speed * dt;
      if (o.move) {
        o.top = o.base + Math.sin(t * 1.6 + o.phase) * o.move;
        o.bottom = o.top + o.gap;
      }
      if (hitsRect(o)) return finish("ぶつかっちゃった…");
      if (o.ring && !o.ring.taken) {
        var dx = player.x - (o.x + OBSTACLE_W / 2), dy = player.y - (o.top + o.bottom) / 2;
        if (dx * dx + dy * dy < (player.r + 14) * (player.r + 14)) {
          o.ring.taken = true;
          var pts = o.ring.gold ? GOLD_POINTS : RING_POINTS;
          score += pts;
          popup("+" + pts);
          if (o.ring.gold && navigator.vibrate) navigator.vibrate(30);
        }
      }
      if (!o.passed && o.x + OBSTACLE_W < player.x - player.r) {
        o.passed = true;
        passed++;
        score++;
        if (passed % PER_STAGE === 0) {
          stageIndex++;
          stageShownAt = t;
          blend = 0;
        }
      }
    }
    for (var k = 0; k < jellies.length; k++) {
      var j = jellies[k];
      j.x -= speed * dt;
      var jx = player.x - j.x, jy = player.y - jellyY(j, t);
      var rr = player.r * 0.75 + j.r;
      if (jx * jx + jy * jy < rr * rr) return finish("クラゲにさされた…");
    }
    obstacles = obstacles.filter(function (o) { return o.x > -OBSTACLE_W - 10; });
    jellies = jellies.filter(function (j) { return j.x > -30; });
    if (stage().name === "嵐の海" && Math.random() < dt * 0.15) flashUntil = t * 1000 + 120;
  }

  function frame(now) {
    if (state === "closed") return;
    var t = now / 1000;
    var dt = Math.min(0.05, (now - (lastTime || now)) / 1000);
    lastTime = now;
    step(dt, t);
    draw(t);
    requestAnimationFrame(frame);
  }

  function flap() {
    if (state === "playing") player.vy = FLAP;
  }

  // ── 画面（タイトル・結果・できあがり） ─────────
  function showPanel(children) {
    panel.textContent = "";
    children.forEach(function (c) { panel.appendChild(c); });
    panel.hidden = false;
  }

  function title() {
    state = "title";
    reset();
    var h = el("h2", "brush game-title", "およげない？たいやきくん");
    h.id = "game-title";
    showPanel([
      h,
      el("p", "game-text", "画面をタップすると少し浮かびます（泳げないので、ほうっておくと沈みます）。網と岩をよけて、浮き輪を集めよう！"),
      el("p", "game-text small", "よけるたびに1点、浮き輪は3点、金の浮き輪は10点。10個よけるごとに海の景色が変わります"),
      button("スタート", "primary wide", start),
    ]);
  }

  function start() {
    reset();
    panel.hidden = true;
    state = "playing";
    startedAt = Date.now();
    stageShownAt = performance.now() / 1000;
    player.vy = FLAP;
  }

  function finish(reason) {
    state = "over";
    var playMs = Date.now() - startedAt;
    var best = Math.max(score, parseInt(recall(BEST_KEY) || "0", 10) || 0);
    store(BEST_KEY, String(best));
    if (navigator.vibrate) navigator.vibrate(80);

    var items = [
      el("p", "game-reason", reason),
      el("p", "game-score", score + "点"),
      el("p", "game-text small", "到達：ステージ" + (stageIndex + 1) + "（" + stageLabel() + "）／ 自己ベスト " + best + "点"),
    ];
    var n = myNumber();
    if (n && score > 0) items.push(rankForm(n, score, playMs));
    else if (!n) items.push(el("p", "game-text small", "ページ上で番号を入れると、ランキングに参加できます"));
    items.push(button("もう一回", "primary wide", start), button("とじる", "link", close));
    showPanel(items);
  }

  function rankForm(n, s, playMs) {
    var form = el("form", "rank-form");
    var label = el("label", "", "ランキングに登録（" + n + "番）");
    label.htmlFor = "rank-name";
    var input = el("input");
    input.id = "rank-name";
    input.maxLength = 10;
    input.placeholder = "なまえ（10文字まで）";
    input.value = recall(NAME_KEY) || "";
    input.autocomplete = "nickname";
    var send = el("button", "secondary", "登録");
    send.type = "submit";
    var msg = el("p", "rank-msg");
    msg.setAttribute("aria-live", "polite");
    form.append(label, input, send, msg);
    form.addEventListener("click", function (ev) { ev.stopPropagation(); });
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      send.disabled = true;
      store(NAME_KEY, input.value);
      fetch("/api/ranking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: n, name: input.value, score: s, playMs: playMs }),
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.error) { msg.textContent = data.error; send.disabled = false; return; }
          msg.textContent = "登録しました！ いま " + data.rank + "位です";
          renderRanking(data.top);
        })
        .catch(function () { msg.textContent = "通信できませんでした。もう一度どうぞ"; send.disabled = false; });
    });
    return form;
  }

  function open() {
    root.hidden = false;
    document.body.style.overflow = "hidden";
    resize();
    title();
    lastTime = 0;
    requestAnimationFrame(frame);
  }

  function close() {
    state = "closed";
    root.hidden = true;
    document.body.style.overflow = "";
    refreshRanking();
  }

  /** 自分の番号ができあがった：遊んでいたら止めて知らせる */
  function ready(n) {
    if (state === "closed" || state === "done") return;
    state = "done";
    var msg = el("p", "game-reason done", "できあがり！");
    msg.setAttribute("role", "alert");
    showPanel([
      msg,
      el("p", "game-text", n + "番のたい焼きができあがりました。受け取り口へお越しください"),
      button("ゲームをとじる", "primary wide", close),
    ]);
  }

  // ── ランキング ────────────────────────────
  function renderRanking(top) {
    var ol = document.getElementById("ranking");
    ol.textContent = "";
    top.forEach(function (r) {
      var li = el("li");
      if (r.number === myNumber()) li.className = "me";
      li.append(el("span", "rank", r.rank + "位"), el("span", "name", r.name), el("span", "pts", r.score + "点"));
      ol.appendChild(li);
    });
    document.getElementById("ranking-empty").hidden = top.length > 0;
  }

  function refreshRanking() {
    fetch("/api/ranking", { cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (data) { renderRanking(data.top || []); })
      .catch(function () {});
  }

  canvas.addEventListener("pointerdown", function (ev) { ev.preventDefault(); flap(); });
  document.addEventListener("keydown", function (ev) {
    if (state === "playing" && (ev.key === " " || ev.key === "ArrowUp")) { ev.preventDefault(); flap(); }
  });
  document.getElementById("game-open").addEventListener("click", open);
  document.getElementById("game-close").addEventListener("click", close);
  window.addEventListener("resize", function () { if (state !== "closed") resize(); });
  document.addEventListener("visibilitychange", function () {
    // 別のアプリに切り替えたら、その回は終わりにする（戻ったときに急に沈まないように）
    if (document.hidden && state === "playing") finish("ひと休み中…");
  });

  window.taiyakiGame = { ready: ready };
  refreshRanking();
  setInterval(function () { if (state === "closed") refreshRanking(); }, 30000);
})();
