// test/cards.test.js
const assert = require("assert");
const { CARDS, ENEMIES, ELITES, BOSS, RELICS, EVENTS } = require("../js/cards.js");

assert.strictEqual(Object.keys(CARDS).length, 33, "应正好 33 张卡");
assert.strictEqual(Object.values(CARDS).filter(c => c.tier === "base").length, 12, "基础 12 张");
assert.strictEqual(Object.values(CARDS).filter(c => c.tier === "upgrade").length, 21, "升级 21 张");
assert.strictEqual(Object.keys(ENEMIES).length, 8, "普通敌人 8 种");
assert.strictEqual(Object.keys(ELITES).length, 2, "精英 2 种");
assert.ok(BOSS, "应有最终 Boss");
assert.strictEqual(Object.keys(RELICS).length, 8, "遗物 8 个");
assert.strictEqual(Object.keys(EVENTS).length, 6, "事件 6 个");
for (const [id, c] of Object.entries(CARDS)) {
  assert.ok(["attack","skill","power"].includes(c.type), `${id} 类型非法`);
  assert.ok(c.cost >= 0 && c.cost <= 3, `${id} 费用非法`);
  assert.ok(["base","upgrade"].includes(c.tier), `${id} tier 非法`);
}
console.log("cards.test OK");