# 边塞王国 · Kingdom Game

本地可直接游玩的回合制王国生存小游戏 + 配套系统策划案。**零依赖、零构建**：纯 HTML/CSS/原生 JS。

## 怎么玩

用浏览器直接打开（无需服务器）：

```bash
open index.html          # macOS
# 或双击文件管理器中的 index.html
```

- 🎯 **目标**：30 季内建成「王座奇观」（350🪙 120🪵 120🪨）即胜。
- 人口或忠诚归零、或期限已至奇观未成 → 王朝覆灭。
- 每季可自由建造 / 调税 / 集市买卖 / 庆典募兵，点 **结束本季** 结算推进。
- 第 8 季起马匪威胁逐季成长，注意补城防与军队。
- 关键技巧：木材石料会过剩而金币永远稀缺——**在集市卖掉多余的建材换金**。

## 开发与验证

```bash
node test/smoke.test.js   # 规则冒烟测试（8 项断言）
node test/sim.js          # 平衡模拟：三种打法 × 300 局胜率
```

## 目录结构

```
index.html          入口页面
css/style.css       样式
js/game.js          核心规则（纯逻辑，无 DOM，Node 可直跑）
js/ui.js            渲染与交互
docs/               系统策划案
test/               冒烟测试 + 平衡模拟
```

## 策划案

[docs/边塞王国-四季王座-策划案.md](docs/边塞王国-四季王座-策划案.md) —— 含简介、实现目标、基础设定、UI 交互、规则逻辑、美术资源与数值验证报告。

---

# 幽夜行 · YouYe

本地可直接游玩的**东方志怪卡牌构筑 Roguelike**（小体量试玩版）。纯 HTML/CSS/原生 JS，零依赖零构建。

## 怎么玩

```bash
open youye/index.html          # macOS
```

- 🎯 **目标**：斩开妖雾，击败最终 Boss「妖王·夜叉」（两阶段变身）即通关。
- **战斗**：每回合抽 5 张牌、3 点灵气。攻击牌积攒**气势**，满 6 触发大招「一剑霜寒」。
- **地图**：起 → 战斗 → 事件 → 战斗 → 精英 → 战斗 → 事件 → 战斗 → Boss。
- **构筑**：胜利后 3 选 1 加牌，遗物提供被动，精英/Boss 必得遗物。
- 失败可重开，随机种子决定单局。

## 开发与验证

```bash
node youye/test/cards.test.js    # 数据表完整性
node youye/test/engine.test.js   # 战斗引擎规则
node youye/test/run.test.js      # 单局流程冒烟（含全自动对弈）
```

## 目录结构

```
youye/index.html          入口页面（水墨宣纸）
youye/css/style.css       水墨视觉规范
youye/js/cards.js         数据表（卡/敌人/遗物/事件，UMD）
youye/js/engine.js        战斗引擎（纯逻辑，UMD）
youye/js/run.js           单局流程（地图/事件/奖励，UMD）
youye/js/ui.js            渲染与交互
youye/test/               Node 测试
```

## 设计文档

[docs/superpowers/specs/2026-10-17-youye-design.md](docs/superpowers/specs/2026-10-17-youye-design.md) —— 完整设计：战斗规则、地图/事件/遗物、实现架构、视觉规范、测试策略、验收标准、敌人/Boss/卡池/事件全表。
