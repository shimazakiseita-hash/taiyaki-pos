/*
 * ミニゲーム「およげない？たいやきくん」と今日のランキング（お客さん向けページ用）
 * タップで少し浮かぶ。網（上）と岩（下）をよけ、浮き輪を集める。底に沈むか、ぶつかったら終わり。
 * 10個よけるごとにステージ（景色と仕掛け）が変わる。速さとすき間の狭さは、よけた数だけで決まり、ステージが一周しても戻らない。
 * アイテム：あんこだん（5秒間あんこを撃ってクラゲを倒せる）・あおいうきわ（1回だけ助かる）・あじのぐ（4しゅ集めるとボーナス）。
 * しんかい（クラゲが出る海）からは、クラゲがしびれだまを撃ってくる。
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
  var JELLY_POINTS = 5; // あんこだんでクラゲを倒した
  var FLAVOR_POINTS = 2;
  var COMPLETE_POINTS = 20; // あじのぐ 4しゅ コンプリート
  var GUN_SECONDS = 5;
  var SAFE_SECONDS = 1.2; // シールドで助かったあと、少しのあいだ当たらない
  var FLAVORS = [
    { id: "anko", label: "あ", color: "#9e3232", text: "#ffffff" },
    { id: "custard", label: "カ", color: "#e3ae2f", text: "#1a1a1a" },
    { id: "matcha", label: "抹", color: "#5a8a3a", text: "#ffffff" },
    { id: "choco", label: "チ", color: "#6b4226", text: "#ffffff" },
  ];
  var NAME_KEY = "taiyaki-name";
  var BEST_KEY = "taiyaki-best";
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ステージごとの景色と仕掛け。move はすき間が上下に動く幅、jelly はクラゲが出る確率 */
  var STAGES = [
    { id: "shallow", name: "あさせ", top: "#6cb8ea", bottom: "#2f74b5", floor: "#e8cf98", dot: "#cfae6c", rock: "#6b7488", move: 0, jelly: 0, fish: "rgba(255,255,255,0.35)" },
    { id: "coral", name: "サンゴしょう", top: "#43c0b5", bottom: "#1c6d8c", floor: "#f3c2ac", dot: "#e39a83", rock: "#d9666b", move: 45, jelly: 0, fish: "rgba(255,214,102,0.75)" },
    { id: "deep", name: "しんかい", top: "#1f3d73", bottom: "#081430", floor: "#3a4258", dot: "#2a3146", rock: "#3f4a63", move: 55, jelly: 0.55, fish: "rgba(140,220,255,0.35)" },
    { id: "storm", name: "あらしのうみ", top: "#59657a", bottom: "#1d2533", floor: "#6b5b4b", dot: "#55473a", rock: "#4b5263", move: 65, jelly: 0.35, fish: "rgba(255,255,255,0.2)" },
  ];
  var STORM = STAGES[STAGES.length - 1];

  var root = document.getElementById("game");
  var canvas = document.getElementById("game-canvas");
  var panel = document.getElementById("game-panel");
  var ctx = canvas.getContext("2d");
  var img = new Image();
  img.src = "/brand/taiyaki.webp"; // ロゴから切り抜いた、たい焼きの形の絵（左向き）

  var W = 0, H = 0, FLOOR = 0;
  var state = "closed"; // closed | title | ready（タップ待ち）| playing | over | done
  var player, obstacles, jellies, bubbles, fishes, popups, score, passed, startedAt, lastTime;
  var stageIndex, stageShownAt, blend, flashUntil;
  var bullets, bolts, shield, safeUntil, gunUntil, nextShot, collected, nowT;

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
  function stageLabel() { return (lap() > 0 ? lap() + 1 + "しゅうめ " : "") + stage().name; }
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
    bullets = [];
    bolts = [];
    shield = false;
    safeUntil = 0;
    gunUntil = 0;
    nextShot = 0;
    collected = {};
    nowT = 0;
  }

  /* すき間に浮かべるもの（なにもないこともある） */
  function rollItem() {
    var r = Math.random();
    if (r < 0.06) return { kind: "gold" };
    if (r < 0.13) return { kind: "anko" };
    if (r < 0.19) return { kind: "shield" };
    if (r < 0.34) {
      var missing = FLAVORS.filter(function (f) { return !collected[f.id]; });
      var pool = missing.length ? missing : FLAVORS;
      return { kind: "flavor", flavor: pool[Math.floor(Math.random() * pool.length)] };
    }
    if (r < 0.62) return { kind: "ring" };
    return null;
  }

  function spawn() {
    var gap = currentGap();
    var move = currentMove();
    var base = 40 + move + Math.random() * Math.max(10, FLOOR - gap - 80 - move * 2);
    obstacles.push({
      x: W + 20,
      base: base,
      top: base,
      bottom: base + gap,
      gap: gap,
      move: move,
      phase: Math.random() * Math.PI * 2,
      passed: false,
      item: rollItem(),
    });
    // 障害物と障害物のあいだにクラゲ
    if (Math.random() < currentJelly()) {
      jellies.push({ x: W + 20 + Math.max(190, W * 0.55) / 2 + OBSTACLE_W / 2, y0: H * (0.25 + Math.random() * 0.45), phase: Math.random() * 6, r: 15, willFire: Math.random() < 0.65, fired: false });
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
    if (s.id === "shallow") {
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      for (var i = 0; i < 4; i++) {
        var x0 = ((i * W) / 3 + Math.sin(t * 0.6 + i) * 20) % (W + 80);
        ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + 50, 0); ctx.lineTo(x0 + 140, FLOOR); ctx.lineTo(x0 + 60, FLOOR); ctx.fill();
      }
    }
    // 深海：光るプランクトン
    if (s.id === "deep") {
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
    var storm = s.id === "storm";
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
    if (s.id === "coral") {
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
    if (s.id === "deep") {
      ctx.fillStyle = "rgba(160,240,255,0.7)"; // 岩に光る点
      [[14, 22], [40, 40], [26, 70]].forEach(function (p) { ctx.beginPath(); ctx.arc(x + p[0], y + p[1], 2.5, 0, Math.PI * 2); ctx.fill(); });
    } else {
      ctx.fillStyle = "#5a8a3a"; // 海藻（ゆらゆら）
      var sway = Math.sin(t * 2 + x / 40) * 3;
      ctx.fillRect(x + 10 + sway, y - 14, 6, 14);
      ctx.fillRect(x + OBSTACLE_W - 18 - sway, y - 22, 6, 22);
    }
  }

  function drawRing(x, y, color, big, glow) {
    for (var i = 0; i < 8; i++) {
      ctx.strokeStyle = i % 2 ? "#ffffff" : color;
      ctx.lineWidth = big ? 8 : 7;
      ctx.beginPath();
      ctx.arc(x, y, big ? 15 : 13, (i * Math.PI) / 4, ((i + 1) * Math.PI) / 4);
      ctx.stroke();
    }
    if (glow) { ctx.strokeStyle = glow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.stroke(); }
  }

  function drawAnko(x, y, r) {
    ctx.fillStyle = "#5b2a1f";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, Math.PI * 2); ctx.fill();
  }

  function drawItem(it, x, y, t) {
    y += Math.sin(t * 3 + x / 50) * 3;
    if (it.kind === "ring") drawRing(x, y, "#c8322b", false, null);
    else if (it.kind === "gold") drawRing(x, y, "#e3ae2f", true, "rgba(255,230,140,0.6)");
    else if (it.kind === "shield") drawRing(x, y, "#2f74d0", true, "rgba(160,210,255," + (0.5 + 0.3 * Math.sin(t * 6)) + ")");
    else if (it.kind === "anko") {
      ctx.strokeStyle = "rgba(255,210,170," + (0.5 + 0.3 * Math.sin(t * 6)) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.stroke();
      drawAnko(x, y, 13);
    } else if (it.kind === "flavor") {
      var f = it.flavor;
      ctx.fillStyle = f.color;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = f.text;
      ctx.font = "800 16px 'M PLUS Rounded 1c', system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(f.label, x, y + 1);
      ctx.textBaseline = "alphabetic";
    }
  }

  function drawShots(t) {
    bullets.forEach(function (b) { drawAnko(b.x, b.y, 6); });
    bolts.forEach(function (b) {
      ctx.fillStyle = "rgba(255,240,120,0.35)";
      ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffe66b";
      ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff8c8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (var i = 0; i < 3; i++) {
        var a = t * 8 + (i * Math.PI * 2) / 3;
        ctx.moveTo(b.x + Math.cos(a) * 8, b.y + Math.sin(a) * 8);
        ctx.lineTo(b.x + Math.cos(a) * 14, b.y + Math.sin(a) * 14);
      }
      ctx.stroke();
    });
  }

  /* 左上：あつめた あじ・シールド・あんこだんの のこり */
  function drawHud(t) {
    FLAVORS.forEach(function (f, i) {
      var x = 22 + i * 26;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.fillStyle = collected[f.id] ? f.color : "rgba(255,255,255,0.15)";
      ctx.beginPath(); ctx.arc(x, 28, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    if (shield) drawRing(30, 60, "#2f74d0", false, null);
    if (t < gunUntil) {
      var x0 = shield ? 64 : 30;
      drawAnko(x0, 60, 9);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(x0 + 14, 56, 60, 8);
      ctx.fillStyle = "#ffd6a0";
      ctx.fillRect(x0 + 14, 56, (60 * (gunUntil - t)) / GUN_SECONDS, 8);
    }
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

  function drawPlayer(t) {
    // シールド：まわりに あおい うきわ。助かった直後は点滅
    if (shield) drawRing(player.x, player.y, "#2f74d0", true, "rgba(160,210,255,0.5)");
    if (t < safeUntil && Math.floor(t * 10) % 2 === 0) return;
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
    ctx.font = "800 " + size + "px 'M PLUS Rounded 1c', system-ui, sans-serif";
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
      if (o.item && !o.item.taken) drawItem(o.item, o.x + OBSTACLE_W / 2, (o.top + o.bottom) / 2, t);
    });
    jellies.forEach(function (j) { drawJelly(j, t); });
    drawShots(t);
    drawPlayer(t);
    popups.forEach(function (p) { drawText(p.text, p.x, p.y, 26, Math.max(0, p.life)); });
    if (state === "ready") {
      drawText("タップで スタート！", W / 2, H * 0.62, 30, 0.65 + 0.35 * Math.abs(Math.sin(t * 3)));
      // タップの波紋（指の絵文字は端末によって出ないので描く）
      var phase = (t % 1.2) / 1.2;
      ctx.strokeStyle = "rgba(255,255,255," + (1 - phase) + ")";
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(W / 2, H * 0.62 + 60, 10 + phase * 26, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath(); ctx.arc(W / 2, H * 0.62 + 60, 9, 0, Math.PI * 2); ctx.fill();
    }
    if (state === "playing" || state === "over") {
      drawHud(t);
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

  function popup(text, x, y) { popups.push({ text: text, x: x === undefined ? player.x + 30 : x, y: y === undefined ? player.y - 20 : y, life: 1 }); }

  /* 当たったとき：シールドがあれば1回だけ助かる。終わったら true */
  function hit(reason) {
    if (nowT < safeUntil) return false;
    if (shield) {
      shield = false;
      safeUntil = nowT + SAFE_SECONDS;
      popup("セーフ！");
      if (navigator.vibrate) navigator.vibrate(60);
      return false;
    }
    finish(reason);
    return true;
  }

  function take(it) {
    it.taken = true;
    if (it.kind === "ring") { score += RING_POINTS; popup("+" + RING_POINTS); }
    else if (it.kind === "gold") { score += GOLD_POINTS; popup("+" + GOLD_POINTS); if (navigator.vibrate) navigator.vibrate(30); }
    else if (it.kind === "anko") { gunUntil = nowT + GUN_SECONDS; nextShot = nowT; popup("あんこだん！"); }
    else if (it.kind === "shield") { shield = true; popup("シールド！"); }
    else if (it.kind === "flavor") {
      collected[it.flavor.id] = true;
      score += FLAVOR_POINTS;
      popup("+" + FLAVOR_POINTS);
      if (FLAVORS.every(function (f) { return collected[f.id]; })) {
        collected = {};
        score += COMPLETE_POINTS;
        popups.push({ text: "4しゅ コンプリート！ +" + COMPLETE_POINTS, x: W / 2, y: H * 0.4, life: 1.6 });
        if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
      }
    }
  }

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
      if (state === "title" || state === "ready") player.y = H * 0.42 + Math.sin(t * 3) * 10;
      return;
    }

    nowT = t;
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y < player.r + 14) { player.y = player.r + 14; player.vy = 0; }
    if (player.y + player.r * 0.8 > FLOOR) {
      // シールドがあれば（助かった直後も）底ではねて戻る
      if (!shield && t >= safeUntil) return finish("しずんじゃった…");
      if (shield) hit("");
      player.y = FLOOR - player.r * 0.8;
      player.vy = FLAP;
    }

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
      if (hitsRect(o) && hit("ぶつかっちゃった…")) return;
      if (o.item && !o.item.taken) {
        var dx = player.x - (o.x + OBSTACLE_W / 2), dy = player.y - (o.top + o.bottom) / 2;
        if (dx * dx + dy * dy < (player.r + 14) * (player.r + 14)) take(o.item);
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
      var jyNow = jellyY(j, t);
      // クラゲの はんげき：近づくと しびれだまを 1回 うってくる
      if (j.willFire && !j.fired && j.x < W * 0.72) {
        j.fired = true;
        var ax = player.x - j.x, ay = player.y - jyNow, len = Math.sqrt(ax * ax + ay * ay) || 1;
        bolts.push({ x: j.x, y: jyNow, vx: (ax / len) * 150, vy: (ay / len) * 150 });
      }
      var jx = player.x - j.x, jy = player.y - jyNow;
      var rr = player.r * 0.75 + j.r;
      if (jx * jx + jy * jy < rr * rr && hit("クラゲに さされた…")) return;
    }
    // しびれだま
    for (var q = 0; q < bolts.length; q++) {
      var bo = bolts[q];
      bo.x += bo.vx * dt - speed * dt * 0.3;
      bo.y += bo.vy * dt;
      var bx = player.x - bo.x, by = player.y - bo.y, br = player.r * 0.7 + 7;
      if (!bo.gone && bx * bx + by * by < br * br) { bo.gone = true; if (hit("しびれちゃった…")) return; }
    }
    // あんこだん：前に まっすぐ とんで、クラゲと しびれだまを たおす。網や岩に当たると消える
    if (t < gunUntil && t >= nextShot) { bullets.push({ x: player.x + 26, y: player.y }); nextShot = t + 0.32; }
    for (var u = 0; u < bullets.length; u++) {
      var bu = bullets[u];
      bu.x += 460 * dt;
      for (var m = 0; m < jellies.length && !bu.gone; m++) {
        var je = jellies[m], ex = bu.x - je.x, ey = bu.y - jellyY(je, t);
        if (!je.gone && ex * ex + ey * ey < (je.r + 6) * (je.r + 6)) {
          je.gone = bu.gone = true;
          score += JELLY_POINTS;
          popup("+" + JELLY_POINTS, je.x, jellyY(je, t) - 10);
        }
      }
      for (var n = 0; n < bolts.length && !bu.gone; n++) {
        var bb = bolts[n], fx = bu.x - bb.x, fy = bu.y - bb.y;
        if (!bb.gone && fx * fx + fy * fy < 13 * 13) bb.gone = bu.gone = true;
      }
      for (var v = 0; v < obstacles.length && !bu.gone; v++) {
        var ob = obstacles[v];
        if (bu.x > ob.x && bu.x < ob.x + OBSTACLE_W && (bu.y < ob.top || bu.y > ob.bottom)) bu.gone = true;
      }
    }
    jellies = jellies.filter(function (je) { return !je.gone; });
    bolts = bolts.filter(function (b) { return !b.gone && b.x > -20 && b.x < W + 20 && b.y > -20 && b.y < H + 20; });
    bullets = bullets.filter(function (b) { return !b.gone && b.x < W + 20; });
    obstacles = obstacles.filter(function (o) { return o.x > -OBSTACLE_W - 10; });
    jellies = jellies.filter(function (j) { return j.x > -30; });
    if (stage().id === "storm" && Math.random() < dt * 0.15) flashUntil = t * 1000 + 120;
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
    if (state === "ready") {
      // 最初のタップで泳ぎ出す（説明を読み終えてから、自分のタイミングで始められる）
      state = "playing";
      startedAt = Date.now();
      stageShownAt = performance.now() / 1000;
    }
    if (state === "playing") player.vy = FLAP;
  }

  // ── 画面（タイトル・結果・できあがり） ─────────
  function showPanel(children) {
    panel.textContent = "";
    children.forEach(function (c) { panel.appendChild(c); });
    panel.hidden = false;
  }

  /* 遊び方の絵（浮き輪・金の浮き輪・よけるもの） */
  var ICONS = {
    ring: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="13" fill="none" stroke="#c8322b" stroke-width="7" stroke-dasharray="10.2 10.2"/><circle cx="20" cy="20" r="13" fill="none" stroke="#fff" stroke-width="7" stroke-dasharray="10.2 10.2" stroke-dashoffset="10.2"/></svg>',
    gold: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="#f3d27a" stroke-width="2"/><circle cx="20" cy="20" r="13" fill="none" stroke="#e3ae2f" stroke-width="7" stroke-dasharray="10.2 10.2"/><circle cx="20" cy="20" r="13" fill="none" stroke="#fff" stroke-width="7" stroke-dasharray="10.2 10.2" stroke-dashoffset="10.2"/></svg>',
    shield: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="#a0d2ff" stroke-width="2"/><circle cx="20" cy="20" r="13" fill="none" stroke="#2f74d0" stroke-width="7" stroke-dasharray="10.2 10.2"/><circle cx="20" cy="20" r="13" fill="none" stroke="#fff" stroke-width="7" stroke-dasharray="10.2 10.2" stroke-dashoffset="10.2"/></svg>',
    anko: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="none" stroke="#ffd2aa" stroke-width="3"/><circle cx="20" cy="20" r="12" fill="#5b2a1f"/><circle cx="16" cy="16" r="3.5" fill="#fff" opacity=".45"/></svg>',
    flavor: '<svg viewBox="0 0 96 40" aria-hidden="true"><circle cx="12" cy="20" r="10" fill="#9e3232"/><circle cx="36" cy="20" r="10" fill="#e3ae2f"/><circle cx="60" cy="20" r="10" fill="#5a8a3a"/><circle cx="84" cy="20" r="10" fill="#6b4226"/></svg>',
    bolt: '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="12" fill="#ffe66b" opacity=".4"/><circle cx="20" cy="20" r="7" fill="#e3b800"/><path d="M28 12l5-5M28 28l5 5M10 20H3" stroke="#e3b800" stroke-width="2.5"/></svg>',
    avoid: '<svg viewBox="0 0 96 40" aria-hidden="true"><rect x="2" y="2" width="26" height="22" fill="#faf6ee" stroke="#7a869e" stroke-width="2"/><path d="M2 2l26 22M28 2L2 24M15 2v22M2 13h26" stroke="#7a869e" stroke-width="1.5"/><circle cx="8" cy="26" r="3" fill="#c8322b"/><circle cx="22" cy="26" r="3" fill="#c8322b"/><path d="M36 38v-18q0-8 8-8h6q8 0 8 8v18z" fill="#6b7488"/><path d="M74 20a10 10 0 0 1 20 0z" fill="#ffaadc"/><path d="M78 20q2 8 0 16M84 20q2 8 0 16M90 20q2 8 0 16" stroke="#ffaadc" stroke-width="2" fill="none"/></svg>',
  };

  function legendRow(icon, html) {
    var row = el("li", "legend-row");
    var pic = el("span", "legend-pic");
    pic.innerHTML = icon; // 上の決まった絵だけ（外から来た文字は入れない）
    var text = el("span", "legend-text");
    text.innerHTML = html;
    row.append(pic, text);
    return row;
  }

  function title() {
    state = "title";
    reset();
    var h = el("h2", "maru game-title", "およげない？たいやきくん");
    h.id = "game-title";
    var legend = el("ul", "legend");
    legend.append(
      legendRow(ICONS.ring, "うきわ <b>＋3</b>　きんは <b>＋10</b>"),
      legendRow(ICONS.anko, "あんこだん：クラゲを たおせる <b>＋5</b>"),
      legendRow(ICONS.shield, "あおい うきわ：1かい だけ セーフ"),
      legendRow(ICONS.flavor, "4しゅの あじを あつめると <b>＋20</b>"),
      legendRow(ICONS.avoid, "あみ・いわ・クラゲは よけてね"),
      legendRow(ICONS.bolt, "しんかいから クラゲが しびれだまを うってくる！")
    );
    showPanel([
      h,
      el("p", "game-text", "タップで ふわっと うくよ。およげないから、ほうっておくと しずんじゃう！"),
      legend,
      el("p", "game-text small", "10こ よけるごとに うみの けしきが かわるよ"),
      button("はじめる！", "primary wide", start),
    ]);
  }

  function start() {
    reset();
    panel.hidden = true;
    state = "ready";
  }

  function finish(reason) {
    state = "over";
    var playMs = Date.now() - startedAt;
    var previousBest = parseInt(recall(BEST_KEY) || "0", 10) || 0;
    var best = Math.max(score, previousBest);
    store(BEST_KEY, String(best));
    if (navigator.vibrate) navigator.vibrate(80);

    var items = [
      el("p", "game-reason", reason),
      el("p", "game-score", score + "てん"),
      el("p", "game-cheer", cheer(score, previousBest)),
      el("p", "game-text small", "ステージ" + (stageIndex + 1) + "（" + stageLabel() + "）まで いったよ"),
      el("p", "game-text small", "じこベスト " + best + "てん"),
    ];
    var n = myNumber();
    if (n && score > 0) items.push(rankForm(n, score, playMs));
    else if (!n) items.push(el("p", "game-text small", "ページの うえで ばんごうを いれると、ランキングに のれるよ"));
    items.push(button("もういっかい！", "primary wide", start), button("とじる", "link", close));
    showPanel(items);
  }

  /* ひとこと（子どもにも大人にも、ちょっとうれしい・くやしい言葉） */
  function cheer(s, previousBest) {
    if (previousBest > 0 && s > previousBest) return "じこベスト こうしん！ すごい！";
    if (previousBest > 0 && previousBest - s <= 5) return "おしい！ あと " + (previousBest - s + 1) + "てんで じこベスト";
    if (s >= 50) return "うまい！ まるで およげるみたい";
    if (s >= 10) return "ナイス！ そのちょうし";
    return "ドンマイ！ もういっかい いってみよう";
  }

  function rankForm(n, s, playMs) {
    var form = el("form", "rank-form");
    var label = el("label", "", "ランキングに のせる（" + n + "ばん）");
    label.htmlFor = "rank-name";
    var input = el("input");
    input.id = "rank-name";
    input.maxLength = 10;
    input.placeholder = "なまえ（10もじまで）";
    input.value = recall(NAME_KEY) || "";
    input.autocomplete = "nickname";
    var send = el("button", "secondary", "のせる");
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
          msg.textContent = "のせたよ！ いま " + data.rank + "い だよ";
          renderRanking(data.top);
        })
        .catch(function () { msg.textContent = "つうしん できなかったよ。もういちど おしてね"; send.disabled = false; });
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
      el("p", "game-text", n + "ばんの たいやきが できたよ！ うけとりぐちに きてね"),
      button("ゲームを とじる", "primary wide", close),
    ]);
  }

  // ── ランキング ────────────────────────────
  function renderRanking(top) {
    var ol = document.getElementById("ranking");
    ol.textContent = "";
    top.forEach(function (r) {
      var li = el("li");
      if (r.number === myNumber()) li.className = "me";
      li.append(el("span", "rank", r.rank + "い"), el("span", "name", r.name), el("span", "pts", r.score + "てん"));
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
    if ((state === "ready" || state === "playing") && (ev.key === " " || ev.key === "ArrowUp")) { ev.preventDefault(); flap(); }
  });
  document.getElementById("game-open").addEventListener("click", open);
  document.getElementById("game-close").addEventListener("click", close);
  window.addEventListener("resize", function () { if (state !== "closed") resize(); });
  document.addEventListener("visibilitychange", function () {
    // 別のアプリに切り替えたら、その回は終わりにする（戻ったときに急に沈まないように）
    if (document.hidden && state === "playing") finish("ひとやすみ…");
  });

  window.taiyakiGame = { ready: ready };
  refreshRanking();
  setInterval(function () { if (state === "closed") refreshRanking(); }, 30000);
})();
