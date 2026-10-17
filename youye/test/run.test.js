// test/run.test.js
const assert = require("assert");
const { newRun, resolveNode, endBattle, resolveEvent, pickRewardCard } = require("../js/run.js");
const { CARDS } = require("../js/cards.js");
const E = require("../js/engine.js");

// 1. 新建单局
const r = newRun(42);
assert.strictEqual(r.hp, 80);
assert.strictEqual(r.nodeIndex, 0);
assert.ok(r.map.length >= 6, "地图应有至少 6 个节点");
assert.strictEqual(r.map[0].type, "battle");
console.log("PASS 新建单局");

// 2. 完整一局自动跑通
function autoPlay(seed) {
  const run = newRun(seed);
  let steps = 0;
  while (run.status === "playing" && steps++ < 300) {
    resolveNode(run);
    // 处理奖励（总是选第一张）
    if (run.rewardCards.length) pickRewardCard(run, run.rewardCards[0]);
    // 处理战斗
    if (run.battle) {
      let g = 0;
      const maxTurn = 60; // 僵持保护
      while (run.battle.status === "playing" && run.battle.turn <= maxTurn && g++ < 500) {
        const b = run.battle;
        const atk = b.hand.find(c => c !== "__rest__" && CARDS[c].type === "attack");
        if (atk) {
          const res = E.playCard(b, atk);
          if (res.ok) continue;
        }
        const any = b.hand[0];
        if (any) {
          const res = E.playCard(b, any);
          if (res.ok) continue;
          // 费用不足：尝试弃牌；若已弃过则结束回合
          const dres = E.discardCard(b, any);
          if (dres.ok) continue;
        }
        E.endTurn(b);
      }
      // 超回合判负
      if (run.battle.status === "playing") {
        run.battle.status = "lose";
        run.battle.playerHp = 0;
      }
      endBattle(run, run.battle);
    }
    // 处理事件：依次尝试选项直到成功
    const node = run.map[run.nodeIndex];
    if (node && node.type === "event" && !node.done) {
      let done = false;
      for (let i = 0; i < node.event.opts.length && !done; i++) {
        const res = resolveEvent(run, i);
        if (res.ok) done = true;
      }
      if (!done) { // 全部失败（异常兜底）：强制跳过节点
        node.done = true;
        run.nodeIndex++;
      }
    }
  }
  return run;
}

let wins = 0, losses = 0, N = 20;
for (let seed = 1; seed <= N; seed++) {
  const result = autoPlay(seed);
  assert.ok(["win","lose"].includes(result.status), "结局应为 win 或 lose");
  if (result.status === "win") wins++; else losses++;
}
console.log(`PASS 完整一局可跑通：${N} 局模拟 → 胜 ${wins} / 负 ${losses}`);

// 3. 同种子可复现
const a = autoPlay(7), b = autoPlay(7);
assert.strictEqual(a.status, b.status);
console.log("PASS 同种子可复现");

console.log("\nrun.test 全部通过");