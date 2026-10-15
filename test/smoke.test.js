/**
 * 冒烟测试：node test/smoke.test.js
 * 验证核心规则不崩溃、收支正确、胜负条件可达。
 */
const assert = require("assert");
const G = require("../js/game.js");

// 1. 初始状态
const s = G.newState(42);
assert.strictEqual(s.status, "playing");
assert.strictEqual(s.turn, 1);
assert.strictEqual(G.popCap(s), 40);
console.log("PASS 初始状态");

// 2. 建造扣费
const before = s.gold;
assert.ok(G.build(s, "farm").ok);
assert.strictEqual(s.gold, before - G.BUILDINGS.farm.cost.gold);
assert.strictEqual(s.buildings.farm, 1);
console.log("PASS 建造扣费");

// 3. 收支计算
const inc = G.income(s, "mid");
assert.ok(Number.isFinite(inc.gold) && Number.isFinite(inc.food));
console.log("PASS 收支计算", JSON.stringify(inc));

// 4. 回合推进不产生 NaN，最终必然收敛到胜负
for (let i = 0; i < 60 && s.status === "playing"; i++) {
  G.endTurn(s);
  for (const k of ["gold", "food", "wood", "stone", "pop", "army", "loyalty"]) {
    assert.ok(Number.isFinite(s[k]), `${k} 非法: ${s[k]}`);
  }
}
assert.notStrictEqual(s.status, "playing");
console.log("PASS 回合推进收敛, 结局:", s.status, "|", s.endReason);

// 5. 奇观胜利可达
const w = G.newState(7);
w.gold = 9999; w.wood = 9999; w.stone = 9999;
assert.ok(G.build(w, "wonder").ok);
assert.strictEqual(w.status, "win");
assert.ok(w.endReason.includes("奇观"));
console.log("PASS 奇观胜利");

// 6. 忠诚归零判负
const l = G.newState(9);
l.loyalty = 1; l.tax = "high"; l.food = 0; l.pop = 40;
G.endTurn(l);
assert.strictEqual(l.status, "lose");
console.log("PASS 暴政亡国（", l.endReason, "）");

// 7. 相同种子 -> 相同流程（可复现）
function run(seed) {
  const t = G.newState(seed);
  for (let i = 0; i < 10 && t.status === "playing"; i++) G.endTurn(t);
  return JSON.stringify({ turn: t.turn, gold: t.gold, food: t.food, loyalty: t.loyalty, status: t.status });
}
assert.strictEqual(run(123), run(123));
console.log("PASS 随机可复现");

// 8. 税率切换
G.setTax(s, "low");
assert.strictEqual(s.tax, "low");
assert.strictEqual(G.setTax(s, "bogus").ok, false);
console.log("PASS 税制切换");

console.log("\n全部冒烟测试通过 ✔");
