/*
 * 弹踢道场 · WebAudio 合成音效（无音频文件）
 * 微信小游戏用 wx.createWebAudioContext()，标准浏览器降级 AudioContext。
 * 环境不可用时所有方法静默为空，不影响游戏。
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KickballAudio = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function createAudio() {
    var actx = null;

    function ensure() {
      if (actx) {
        if (actx.state === "suspended") actx.resume();
        return actx;
      }
      try {
        if (typeof wx !== "undefined" && wx.createWebAudioContext) {
          actx = wx.createWebAudioContext();
        } else if (typeof globalThis !== "undefined" && globalThis.AudioContext) {
          actx = new globalThis.AudioContext();
        }
      } catch (e) { actx = null; }
      return actx;
    }

    function tone(freq, dur, opt) {
      var ac = ensure();
      if (!ac) return;
      opt = opt || {};
      var t0 = ac.currentTime + (opt.delay || 0);
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = opt.type || "sine";
      osc.frequency.setValueAtTime(freq, t0);
      if (opt.freq2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opt.freq2), t0 + dur);
      var vol = opt.vol != null ? opt.vol : 0.18;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }

    function noise(dur, opt) {
      var ac = ensure();
      if (!ac) return;
      opt = opt || {};
      var t0 = ac.currentTime + (opt.delay || 0);
      var n = Math.floor(ac.sampleRate * dur);
      var buf = ac.createBuffer(1, n, ac.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var src = ac.createBufferSource();
      src.buffer = buf;
      var gain = ac.createGain();
      gain.gain.setValueAtTime(opt.vol != null ? opt.vol : 0.2, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      var filt = ac.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = opt.cutoff || 1200;
      src.connect(filt).connect(gain).connect(ac.destination);
      src.start(t0);
    }

    var MELODY = [523, 587, 659, 784, 880]; // 胜利：宫调式上行

    function onEvent(ev) {
      switch (ev) {
        case "kick": tone(170, 0.07, { type: "triangle", vol: 0.12 }); break;
        case "perfectKick":
          tone(1240, 0.16, { type: "sine", vol: 0.2 });
          tone(1860, 0.12, { type: "sine", vol: 0.1, delay: 0.02 });
          break;
        case "lowKick": tone(210, 0.09, { type: "square", vol: 0.08 }); break;
        case "dash":
        case "dashThrough":
        case "perilDash":
          tone(520, 0.18, { type: "sawtooth", freq2: 180, vol: 0.07 });
          break;
        case "drum": // 花鼓灯「隆·咚」：低鼓膜音 + 一记鼓皮噪声
          tone(150, 0.2, { type: "sine", freq2: 62, vol: 0.22 });
          noise(0.05, { cutoff: 380, vol: 0.12 });
          break;
        case "fire": // 第三拍「哐」：出球音本身落在鼓点上
          tone(680, 0.12, { type: "sine", freq2: 280, vol: 0.07 });
          tone(130, 0.18, { type: "sine", freq2: 58, vol: 0.16 });
          noise(0.06, { cutoff: 500, vol: 0.1 });
          break;
        case "peril":
        case "perilFire":
          tone(300, 0.1, { type: "square", vol: 0.1 });
          tone(300, 0.12, { type: "square", vol: 0.1, delay: 0.16 });
          break;
        case "hurt": noise(0.16, { cutoff: 700, vol: 0.22 }); tone(120, 0.16, { type: "sawtooth", vol: 0.12 }); break;
        case "perilHit": noise(0.3, { cutoff: 500, vol: 0.3 }); tone(90, 0.28, { type: "sawtooth", vol: 0.16 }); break;
        case "returnHit": tone(520, 0.16, { type: "triangle", vol: 0.18 }); noise(0.08, { cutoff: 3000, vol: 0.1 }); break;
        case "stagger":
          tone(1560, 0.1, { type: "sine", vol: 0.14 });
          tone(2080, 0.14, { type: "sine", vol: 0.12, delay: 0.08 });
          break;
        case "break": noise(0.25, { cutoff: 5000, vol: 0.2 }); break;
        case "deathblow":
          tone(150, 0.5, { type: "triangle", freq2: 70, vol: 0.26 });
          noise(0.4, { cutoff: 900, vol: 0.22 });
          break;
        case "wave": tone(95, 0.34, { type: "sine", freq2: 60, vol: 0.24 }); break;
        case "victory":
          MELODY.forEach(function (f, i) { tone(f, 0.22, { type: "triangle", vol: 0.16, delay: i * 0.13 }); });
          break;
        case "death": tone(380, 0.7, { type: "sawtooth", freq2: 70, vol: 0.2 }); break;
        default: break;
      }
    }

    return { unlock: ensure, onEvent: onEvent };
  }

  return { createAudio: createAudio };
});
