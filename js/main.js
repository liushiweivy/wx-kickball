/*
 * 弹踢道场 · 微信小游戏入口适配
 * 负责：画布/DPR 适配、触摸输入、固定 60Hz 步长、音效事件转发。
 * 内核（core.js）与渲染（render.js）均无 wx 依赖，可在 Node / 浏览器复用。
 */
var core = require("./core.js");
var renderMod = require("./render.js");
var audioMod = require("./audio.js");

var Game = core.Game;
var CFG = core.CFG;
var BUTTONS = renderMod.BUTTONS;

var game = new Game();
var audio = audioMod.createAudio();

// getWindowInfo 为新 API（3.x 起 getSystemInfoSync 弃用），旧基础库回退
var info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
var dpr = info.pixelRatio || 1;
var vw = info.windowWidth;
var vh = info.windowHeight;

var canvas = wx.createCanvas();
canvas.width = Math.round(vw * dpr);
canvas.height = Math.round(vh * dpr);
var ctx = canvas.getContext("2d");
ctx.scale(dpr, dpr); // 后续全部使用 CSS 像素坐标

// 450x800 逻辑世界等比缩放到屏幕，居中
var scale = Math.min(vw / renderMod.W, vh / renderMod.H);
var offX = (vw - renderMod.W * scale) / 2;
var offY = (vh - renderMod.H * scale) / 2;

var view = {
  w: vw, h: vh, scale: scale, offX: offX, offY: offY,
  pressed: {},
  time: 0,
  kickAnimDur: core.CFG.KICK_ANIM,
  kickCooldown: core.CFG.KICK_COOLDOWN,
};

/* ---------- 触摸 ---------- */

var heldTouches = {}; // identifier -> buttonId（左右移动键支持按住）

function toWorld(touch) {
  return {
    x: (touch.clientX - offX) / scale,
    y: (touch.clientY - offY) / scale,
  };
}

function hitButton(p) {
  for (var i = 0; i < BUTTONS.length; i++) {
    var b = BUTTONS[i];
    var dx = p.x - b.x, dy = p.y - b.y;
    if (dx * dx + dy * dy <= b.r * b.r) return b;
  }
  return null;
}

function flashButton(id) {
  view.pressed[id] = true;
  setTimeout(function () { view.pressed[id] = false; }, 110);
}

function tapOverlay() {
  audio.unlock();
  if (game.mode === "title" || game.mode === "victory") game.start();
  else if (game.mode === "death") game.restart();
}

wx.onTouchStart(function (e) {
  var touches = e.changedTouches || [];
  for (var i = 0; i < touches.length; i++) {
    var t = touches[i];
    if (game.mode !== "fight") {
      tapOverlay();
      return;
    }
    var b = hitButton(toWorld(t));
    if (!b) continue;
    if (b.kind === "held") {
      heldTouches[t.identifier] = b.id;
      view.pressed[b.id] = true;
      game.setHeld(b.id, true);
    } else {
      flashButton(b.id);
      game.press(b.id);
    }
  }
});

function releaseTouches(e) {
  var touches = e.changedTouches || [];
  for (var i = 0; i < touches.length; i++) {
    var id = heldTouches[touches[i].identifier];
    if (id) {
      delete heldTouches[touches[i].identifier];
      // 可能有另一根手指仍按着同键
      var still = false;
      for (var k in heldTouches) if (heldTouches[k] === id) still = true;
      if (!still) {
        view.pressed[id] = false;
        game.setHeld(id, false);
      }
    }
  }
}
wx.onTouchEnd(releaseTouches);
wx.onTouchCancel(releaseTouches);

// 切后台/来电回来后丢弃累积时间，避免一帧连跳
var last = Date.now();
wx.onShow(function () { last = Date.now(); });

/* ---------- 固定步长主循环 ---------- */

var STEP = 1 / 60;
var acc = 0;

function frame() {
  var now = Date.now();
  var dt = (now - last) / 1000;
  last = now;
  acc += Math.min(dt, 0.1);

  // update() 开帧会清空事件队列；触摸回调（按键音）和 start/restart（开场鼓）
  // 发生在两帧之间，步进前先排空一次，否则这些事件会被静默丢弃。
  // 播放后立刻清空：120Hz 屏可能连续两帧都不满足步进，不清会重复播音效。
  if (game.events.length) {
    for (var k = 0; k < game.events.length; k++) audio.onEvent(game.events[k]);
    game.events.length = 0;
  }

  var guard = 0;
  while (acc >= STEP && guard < 5) {
    game.update(STEP);
    for (var i = 0; i < game.events.length; i++) audio.onEvent(game.events[i]);
    acc -= STEP;
    guard++;
  }
  acc = Math.min(acc, STEP * 2); // 严重卡顿后不无限追赶
  view.time = game.time;
  renderMod.drawScene(ctx, game, view);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 调试 / 自动化钩子
if (typeof globalThis !== "undefined") {
  globalThis.__kickball = { game: game, CFG: core.CFG, WAVES: core.WAVES };
}
