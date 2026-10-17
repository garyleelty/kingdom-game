// test/engine.test.js
const assert = require("assert");
const E = require("../js/engine.js");
const { CARDS } = require("../js/cards.js");

// 1. 新建战斗状态
const s = E.newBattle({ hp:80, deck:["zhan","shoushi","xushi","huiqi","jianyi"], relics:[] });
assert.strictEqual(s.playerHp, 80);
assert.strictEqual(s.hand.length, 5);
assert.strictEqual(s.energy, 3);
assert.strictEqual(s.qish, 0);
assert.strictEqual(s.status, "playing");
console.log("PASS 初始状态");

// 2. 出攻击牌：伤害 + 气势累积
const e2 = E.newBattle({ hp:80, deck:["zhan"], relics:[] });
const enemyHpBefore = e2.enemyHp;
E.playCard(e2, "zhan");
assert.strictEqual(e2.enemyHp, enemyHpBefore - 6, "斩应造成 6 伤害");
assert.strictEqual(e2.qish, 2);
console.log("PASS 出攻击牌");

// 3. 大招触发
const e3 = E.newBattle({ hp:80, deck:["zhan"], relics:[] });
e3.qish = 6;
e3.enemyHp = 40;
E.playCard(e3, "zhan");
assert.ok(e3.enemyHp <= 40 - 6 - 12, `大招未触发: ${e3.enemyHp}`);
assert.strictEqual(e3.qish, 0, "大招后气势应清零");
console.log("PASS 大招触发");

// 4. 格挡回合清零
const e4 = E.newBattle({ hp:80, deck:["shoushi"], relics:[] });
E.playCard(e4, "shoushi");
assert.strictEqual(e4.block, 5);
E.endTurn(e4);
assert.strictEqual(e4.block, 0, "格挡应回合清零");
console.log("PASS 格挡清零");

// 5. 敌人意图结算
const e5 = E.newBattle({ hp:80, deck:[], enemy:{name:"游魂",hp:22,intents:[{dmg:8}]}, relics:[] });
const hpBefore = e5.playerHp;
E.endTurn(e5);
assert.strictEqual(e5.playerHp, hpBefore - 8, "敌人应造成 8 伤害");
console.log("PASS 敌人意图");

// 6. 能力牌持续触发
const e6 = E.newBattle({ hp:80, deck:["jianyi"], relics:[] });
E.playCard(e6, "jianyi");
E.endTurn(e6);
assert.ok(e6.qish >= 1, "能力牌应每回合+1气势，当前 qish=" + e6.qish);
console.log("PASS 能力持续");

// 7. 胜负判定
const e7 = E.newBattle({ hp:80, deck:[], enemy:{name:"游魂",hp:22,intents:[{dmg:10}]}, relics:[] });
e7.playerHp = 3;
E.endTurn(e7);
assert.strictEqual(e7.status, "lose");
console.log("PASS 玩家败");

const e8 = E.newBattle({ hp:80, deck:["zhan"], relics:[] });
e8.enemyHp = 5;
E.playCard(e8, "zhan");
assert.strictEqual(e8.status, "win");
console.log("PASS 玩家胜");

// 8. 抽牌上限
const e9 = E.newBattle({ hp:80, deck:Object.keys(CARDS).slice(0,20), relics:[] });
assert.ok(e9.hand.length <= E.MAX_HAND, "手牌不应超过上限");
console.log("PASS 抽牌上限");

console.log("\nengine.test 全部通过");