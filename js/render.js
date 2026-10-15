/*
 * 弹踢道场 · 表现层（纯绘制函数，无 wx 依赖）
 * 输入：2D context、Game 内核状态、view（屏幕映射 + 按键状态）
 * 所有游戏元素都画在 450x800 的逻辑世界内，由 main.js 负责缩放/偏移。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KickballRender = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var W = 450;
  var H = 800;

  // 虚拟按键（逻辑坐标），main.js 用同一份布局做触摸命中
  var BUTTONS = [
    { id: "left", kind: "held", x: 66, y: 728, r: 38, label: "◀" },
    { id: "right", kind: "held", x: 150, y: 728, r: 38, label: "▶" },
    { id: "dash", kind: "tap", x: 298, y: 728, r: 42, label: "闪身" },
    { id: "kick", kind: "tap", x: 392, y: 728, r: 46, label: "踢" },
  ];

  var COL = {
    ink: "#e8ecf8",
    enemy: "#9aa4c7",
    enemyBoss: "#d0584a",
    ball: "#dfe8ff",
    peril: "#ff4d4d",
    gold: "#ffd45e",
    hp: "#e0473e",
    posture: "#e8a83c",
    dash: "#5fd0e0",
  };

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawScene(ctx, g, view) {
    drawBackdrop(ctx, view);
    var sx = 0, sy = 0;
    if (g.shake > 0) {
      sx = (Math.random() - 0.5) * g.shake * 14;
      sy = (Math.random() - 0.5) * g.shake * 14;
    }
    ctx.save();
    ctx.translate(view.offX + sx, view.offY + sy);
    ctx.scale(view.scale, view.scale);

    drawPlatform(ctx);
    drawEnemy(ctx, g, view.time);
    for (var i = 0; i < g.balls.length; i++) drawBall(ctx, g.balls[i]);
    drawPlayer(ctx, g, view.kickAnimDur);
    drawFx(ctx, g);
    drawHud(ctx, g);
    drawButtons(ctx, g, view.pressed, view.kickCooldown);
    if (g.banner) drawBanner(ctx, g.banner);
    if (g.mode !== "fight") drawOverlay(ctx, g);

    ctx.restore();
  }

  /* ---------- 背景（铺物理屏，避免留黑边） ---------- */

  function drawBackdrop(ctx, view) {
    var grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, "#070a1a");
    grad.addColorStop(0.55, "#121833");
    grad.addColorStop(1, "#1d2447");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);

    // 月亮（位置换算回物理坐标）
    var mx = view.offX + 348 * view.scale;
    var my = view.offY + 108 * view.scale;
    var mr = 44 * view.scale;
    var halo = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 3.2);
    halo.addColorStop(0, "rgba(244,236,216,0.28)");
    halo.addColorStop(1, "rgba(244,236,216,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(mx - mr * 3.4, my - mr * 3.4, mr * 6.8, mr * 6.8);
    ctx.fillStyle = "#f4ecd8";
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlatform(ctx) {
    // 敌人脚下的城楼高台
    ctx.fillStyle = "#0a0e20";
    ctx.fillRect(0, 168, W, 26);
    ctx.fillStyle = "#070a16";
    for (var x = 12; x < W; x += 46) ctx.fillRect(x, 150, 18, 18);
    ctx.fillRect(0, 194, W, 4);
    // 玩家地面
    ctx.fillStyle = "#0d1228";
    ctx.fillRect(0, 700, W, 100);
    ctx.fillStyle = "#161d3d";
    ctx.fillRect(0, 700, W, 3);
  }

  /* ---------- 火柴人 ---------- */

  function stick(ctx, x, y, opt) {
    // y = 脚底；正面小人，单位比例固定
    var s = opt.scale || 1;
    var c = opt.color || COL.ink;
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4 * s;

    var hipY = y - 34 * s;
    var shoulderY = y - 58 * s;
    var headY = y - 74 * s;

    // 投影
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + 3 * s, 18 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c;

    // 腿
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    if (opt.kick > 0) {
      // 踢腿：支撑腿微屈，踢腿向前（向上，球从上方来）高抬
      var k = opt.kick;
      ctx.lineTo(x - 9 * s, y - 6 * s);
      ctx.moveTo(x, hipY);
      var lift = (1 - Math.abs(k - 0.5) * 2); // 0..1 抛物线
      ctx.lineTo(x + 6 * s * lift, hipY - 30 * s * lift);
    } else {
      ctx.lineTo(x - 8 * s, y);
      ctx.moveTo(x, hipY);
      ctx.lineTo(x + 8 * s, y);
    }
    ctx.stroke();

    // 躯干
    ctx.beginPath();
    ctx.moveTo(x, hipY);
    ctx.lineTo(x, shoulderY);
    ctx.stroke();

    // 手臂
    ctx.beginPath();
    if (opt.kick > 0) {
      ctx.moveTo(x, shoulderY + 4 * s);
      ctx.lineTo(x - 12 * s, shoulderY + 14 * s);
      ctx.moveTo(x, shoulderY + 4 * s);
      ctx.lineTo(x + 12 * s, shoulderY + 12 * s);
    } else {
      ctx.moveTo(x, shoulderY + 4 * s);
      ctx.lineTo(x - 11 * s, shoulderY + 20 * s);
      ctx.moveTo(x, shoulderY + 4 * s);
      ctx.lineTo(x + 11 * s, shoulderY + 20 * s);
    }
    ctx.stroke();

    // 头 + 头巾
    ctx.beginPath();
    ctx.arc(x, headY, 9 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 9 * s, headY - 4 * s, 18 * s, 4 * s);
  }

  function drawPlayer(ctx, g, kickAnimDur) {
    var p = g.player;
    var x = p.x, y = 690;
    var color = COL.ink;
    if (p.state === "hurt") color = "#ff9b8e";
    if (p.state === "break") color = "#8a90a8";

    // 闪身残影
    if (p.state === "dash") {
      for (var i = 1; i <= 2; i++) {
        ctx.globalAlpha = 0.18 / i;
        stick(ctx, x - p.dashDir * 22 * i, y, { color: COL.dash });
      }
      ctx.globalAlpha = 1;
    }

    // 无敌帧微光
    if (p.invuln > 0) {
      ctx.save();
      ctx.shadowColor = COL.dash;
      ctx.shadowBlur = 16;
      stick(ctx, x, y, { color: p.state === "dash" ? COL.dash : color, kick: 0 });
      ctx.restore();
    } else {
      var kickPose = p.kickAnim > 0 ? p.kickAnim / kickAnimDur : 0;
      stick(ctx, x, y, { color: color, kick: kickPose });
    }
  }

  function drawEnemy(ctx, g, time) {
    var e = g.enemy;
    if (!e) return;
    var x = e.x, y = 168;
    var base = e.wave.hp.length > 1 ? COL.enemyBoss : COL.enemy;

    ctx.save();
    if (e.state === "dead") {
      ctx.globalAlpha = Math.max(0, 1 - e.stateT);
    }
    var lean = 0;
    if (e.state === "hurt") lean = 0.12;
    if (e.state === "stagger") lean = Math.sin(time * 14) * 0.08;
    ctx.translate(x, y);
    ctx.rotate(lean);
    ctx.translate(-x, -y);
    stick(ctx, x, y, { color: base, scale: 1.12 });
    ctx.restore();

    // 蓄力中的球（举在手上）
    if (e.state === "telegraph") {
      var prog = Math.min(1, e.stateT / e.castDur);
      var peril = e.castKind === "peril";
      var col = peril ? COL.peril : COL.ball;
      var r = 5 + prog * 9;
      var hx = x, hy = y - 56;
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 12 + prog * 22;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.55 + prog * 0.45;
      ctx.beginPath();
      ctx.arc(hx, hy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 危字警告 + 自身描边脉冲
      if (peril) {
        var pulse = 0.6 + 0.4 * Math.sin(time * 16);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = COL.peril;
        ctx.lineWidth = 3;
        rr(ctx, x - 26, y - 112, 52, 34, 6);
        ctx.stroke();
        ctx.fillStyle = COL.peril;
        ctx.font = "bold 24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("危", x, y - 95);
        ctx.restore();
      }
    }

    // 踉跄 stars
    if (e.state === "stagger") {
      ctx.fillStyle = COL.gold;
      for (var s = 0; s < 3; s++) {
        var a = time * 3 + (s * Math.PI * 2) / 3;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 24, y - 100 + Math.sin(a) * 6, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- 球 ---------- */

  function drawBall(ctx, b) {
    var col = b.kind === "peril" ? COL.peril : b.returned ? COL.gold : COL.ball;
    var speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    // 拖尾（沿速度反方向）
    for (var i = 3; i >= 1; i--) {
      var t = (i * 7) / speed;
      ctx.globalAlpha = 0.12 * (4 - i);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(b.x - b.vx * t, b.y - b.vy * t, 10 - i * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur = b.returned ? 22 : 14;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.beginPath();
    ctx.arc(b.x - 3, b.y - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- 特效 ---------- */

  function drawFx(ctx, g) {
    for (var i = 0; i < g.fx.length; i++) {
      var f = g.fx[i];
      var k = f.t / f.life;
      if (f.kind === "spark") {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
      } else if (f.kind === "ring") {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color;
        ctx.lineWidth = 3 * (1 - k) + 1;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 8 + k * 46, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- HUD ---------- */

  function bar(ctx, x, y, w, h, ratio, color, bg) {
    ctx.fillStyle = bg || "rgba(0,0,0,0.45)";
    rr(ctx, x, y, w, h, h / 2);
    ctx.fill();
    if (ratio > 0) {
      ctx.save();
      rr(ctx, x, y, Math.max(h, w * ratio), h, h / 2);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
  }

  function drawHud(ctx, g) {
    var e = g.enemy, p = g.player;
    if (!e) return; // 标题画面尚未生成敌人
    ctx.textAlign = "center";

    // 敌人
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "600 15px sans-serif";
    ctx.fillText(e.name + (e.nodes > 1 ? "  ×" + e.nodes : ""), W / 2, 26);
    var totalW = 260;
    // 多管血：分段
    var seg = e.wave.hp.length;
    for (var i = 0; i < seg; i++) {
      var sw = (totalW - (seg - 1) * 6) / seg;
      var sx = W / 2 - totalW / 2 + i * (sw + 6);
      var ratio = i < e.nodeIndex ? 0 : i === e.nodeIndex ? e.hp / e.maxHp : 1;
      bar(ctx, sx, 34, sw, 9, ratio, COL.hp);
    }
    bar(ctx, W / 2 - totalW / 2, 47, totalW, 5, e.posture / 100, COL.posture, "rgba(0,0,0,0.35)");
    if (e.state === "stagger") {
      ctx.fillStyle = COL.gold;
      ctx.font = "bold 13px sans-serif";
      ctx.fillText("破架势 · 快踢回金球忍杀！", W / 2, 68);
    }

    // 玩家（底部，按钮上方）
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "12px sans-serif";
    ctx.fillText("体", 24, 612);
    bar(ctx, 42, 602, 190, 10, p.hp / 100, COL.hp);
    bar(ctx, 42, 616, 190, 6, p.posture / 100, COL.posture, "rgba(0,0,0,0.35)");

    // 统计
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "12px sans-serif";
    ctx.fillText("完美踢 " + g.stats.perfectKicks, W - 20, 608);
  }

  /* ---------- 虚拟按键 ---------- */

  function drawButtons(ctx, g, pressed, kickCooldown) {
    var p = g.player;
    for (var i = 0; i < BUTTONS.length; i++) {
      var b = BUTTONS[i];
      var on = pressed[b.id];
      var accent = b.id === "kick" ? COL.gold : b.id === "dash" ? COL.dash : "#aeb8da";

      ctx.save();
      ctx.globalAlpha = on ? 0.85 : 0.5;
      ctx.fillStyle = on ? accent : "rgba(18,24,51,0.7)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 踢冷却扇形
      if (b.id === "kick" && p.kickCd > 0) {
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.arc(b.x, b.y, b.r, -Math.PI / 2, -Math.PI / 2 + (p.kickCd / kickCooldown) * Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = on && b.kind === "held" ? "#10162e" : accent;
      ctx.font = b.label.length > 1 ? "600 19px sans-serif" : "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(b.label, b.x, b.y + 1);
    }
  }

  /* ---------- Banner / 覆盖层 ---------- */

  function drawBanner(ctx, bn) {
    var k = bn.t < 0.3 ? bn.t / 0.3 : bn.tmax - bn.t < 0.3 ? (bn.tmax - bn.t) / 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, k));
    ctx.textAlign = "center";
    ctx.fillStyle = bn.peril ? COL.peril : "#f4ecd8";
    ctx.font = "bold 52px sans-serif";
    ctx.shadowColor = bn.peril ? COL.peril : "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 18;
    ctx.fillText(bn.main, W / 2, 350);
    if (bn.sub) {
      ctx.shadowBlur = 0;
      ctx.font = "600 18px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(bn.sub, W / 2, 388);
    }
    ctx.restore();
  }

  function overlay(ctx, alpha) {
    ctx.fillStyle = "rgba(6,9,22," + alpha + ")";
    ctx.fillRect(0, 0, W, H);
  }

  function drawOverlay(ctx, g) {
    ctx.textAlign = "center";
    if (g.mode === "title") {
      overlay(ctx, 0.72);
      ctx.fillStyle = "#f4ecd8";
      ctx.font = "bold 44px sans-serif";
      ctx.fillText("影狼 · 弹踢道场", W / 2, 300);
      ctx.font = "17px sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText("白球 · 贴身一瞬按「踢」，金球反弹打敌", W / 2, 360);
      ctx.fillText("红球「危」· 踢不得，按「闪身」无敌帧穿过", W / 2, 390);
      ctx.fillText("左下移动对齐，打穿三阵 · 赤甲两管血", W / 2, 420);
      ctx.fillStyle = COL.gold;
      ctx.font = "600 22px sans-serif";
      var blink = 0.55 + 0.45 * Math.sin((g.time || 0) * 5);
      ctx.globalAlpha = blink;
      ctx.fillText("点击屏幕 开 战", W / 2, 500);
      ctx.globalAlpha = 1;
    } else if (g.mode === "death") {
      overlay(ctx, 0.6);
      ctx.fillStyle = COL.peril;
      ctx.font = "bold 96px sans-serif";
      ctx.shadowColor = COL.peril;
      ctx.shadowBlur = 26;
      ctx.fillText("死", W / 2, 380);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "600 20px sans-serif";
      ctx.fillText("点击屏幕 重开本阵", W / 2, 460);
    } else if (g.mode === "victory") {
      overlay(ctx, 0.68);
      ctx.fillStyle = COL.gold;
      ctx.font = "bold 48px sans-serif";
      ctx.shadowColor = COL.gold;
      ctx.shadowBlur = 22;
      ctx.fillText("战 功", W / 2, 280);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "18px sans-serif";
      ctx.fillText("通关用时 " + g.stats.clearT.toFixed(1) + " 秒", W / 2, 350);
      ctx.fillText("完美反弹 " + g.stats.perfectKicks + " 次", W / 2, 384);
      ctx.fillText("闪身穿球 " + g.stats.dashThroughs + " 次", W / 2, 418);
      ctx.fillStyle = COL.gold;
      ctx.font = "600 20px sans-serif";
      ctx.fillText("点击屏幕 再战", W / 2, 490);
    }
  }

  return { W: W, H: H, BUTTONS: BUTTONS, drawScene: drawScene };
});
