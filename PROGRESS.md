# 影狼 · 弹踢道场（wx-kickball）— 进度断点

> 保存于 2026-10-15。

## 已完成

- **内核** `js/core.js`：竖屏 450×800，60Hz。三波（落武者 / 连射剑士 / 赤甲两管血 35% 危球）
  - 踢三档：完美（贴身 0.20s，金球反弹，敌掉 9 血 +28 架势）/ 蹩脚（0.20–0.40s 踢偏，自涨 14 架势）/ 裸吃 12 血
  - 踢冷却 0.30s（乱按不能全覆盖）；闪身 0.28s、无敌帧 0.20s
  - 危球 26 血踢不了只能闪身；架势满玩家崩 1.1s / 敌人踉跄 2.5s 内被金球命中忍杀秒杀一管
  - 敌人横向漂移追玩家，反弹球在飞时冻结漂移保证必中
- **测试 18/18 全绿**：`node --test tests/core.test.mjs tests/balance.test.mjs`
  - 平衡 bot：5 种子满血通关 62–77s、27–32 完美踢；乱按 bot 必败；站桩敌不掉血
- **表现层**：render.js（月夜城楼、火柴人、球拖尾、危字、虚拟按键+冷却扇形、HUD/标题/死/战功）、audio.js（合成音效）、main.js（wx 画布/DPR/触摸/固定步长）
- **浏览器 harness 真机验证**：harness/index.html（wx shim）+ Playwright 注入 bot
  - 标题、实战（赤甲双血条+金球飞行）、战功页截图均正常；bot 满血通关 61.8s / 26 完美踢 / 4 忍杀
  - harness 抓到并修复标题页 HUD 空指针（g.enemy 为 null）、危球闪身未入统计两个 bug
- 小游戏配置：game.js / game.json（竖屏）/ project.config.json（appid = wx6ac3f5090a6b99c5 小游戏游客固定 AppID）

## 环境备忘（坑）

- 微信开发者工具 2.02.2609231，装在 `%LOCALAPPDATA%\WeChatDevTools`（cli.bat 在根目录）
- **CLI 的 auto/open 通道拒绝游客 AppID**（"不存在此 AppID"），GUI 导入不受影响；
  小程序游客号是 `touristappid`，小游戏游客号是 `wx6ac3f5090a6b99c5`（从 app.asar 挖出 GAME_TOURIST_APPID）
- miniprogram-automator 装在 `%TEMP%\kick-auto`（auto 端口方案因游客号走不通，暂未用上）
- 静态服务脚本：`%TEMP%\kick-serve.mjs`（端口 8778，根目录 wx-kickball；注意 resolve 统一盘符斜杠，否则 403）
- 截图：E:\1workspace\kick-{title,fight,victory}.png

## Code review（2026-10-15，code-reviewer，0 CRITICAL / 2 HIGH，已全部修复）

- HIGH：帧间事件（kick/dash 按键音、start/wave 开场鼓）被 update 清队列丢弃 → main.js 步进前先排空一次
- HIGH：Boss 已打掉血条段画成满血 → 已灭段 ratio=0（截图 docs/kick-bossbar.png 验证）
- MEDIUM：harness/ 加入 packOptions.ignore
- LOW：同帧胜利/死亡覆盖（mode!==fight 不判死）、结算清飞球、acc 追赶钳制、getWindowInfo 新 API、死代码与硬编码常量清理

## 下次待做

1. [ ] 用户在开发者工具 GUI 导入项目（测试号）确认模拟器/真机效果 —— CLI 自动化此路不通
2. [ ] 真机触屏手感微调（按键位置/大小、DPR 异形屏 safe area）
3. [x] code-reviewer 过一遍，处理 CRITICAL/HIGH（2026-10-15 完成）
4. [ ] 需要发布时换正式 AppID，加分享/排行榜（wx.openDataContext）
5. [ ] 收尾归档：更新 1AI topic；可选推 GitHub
