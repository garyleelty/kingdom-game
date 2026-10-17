// test/sim.js — 平衡模拟：多种策略对弈
const { newRun, resolveNode, endBattle, resolveEvent, pickRewardCard } = require("../js/run.js");
const { CARDS } = require("../js/cards.js");
const E = require("../js/engine.js");

// 策略 1：无脑（只打攻击，无防御）
function naive(seed) {
  const run = newRun(seed);
  let steps = 0;
  while (run.status === "playing" && steps++ < 300) {
    resolveNode(run);
    if (run.rewardCards.length) pickRewardCard(run, run.rewardCards[0]);
    if (run.battle) {
      let g = 0;
      while (run.battle.status === "playing" && run.battle.turn <= 60 && g++ < 500) {
        const b = run.battle;
        const atk = b.hand.find(c => c !== "__rest__" && CARDS[c] && CARDS[c].type === "attack");
        if (atk) { const r = E.playCard(b, atk); if (r.ok) continue; }
        const any = b.hand[0];
        if (any) { const r = E.playCard(b, any); if (r.ok) continue; const d = E.discardCard(b, any); if (d.ok) continue; }
        E.endTurn(b);
      }
      if (run.battle.status === "playing") { run.battle.status = "lose"; run.battle.playerHp = 0; }
      endBattle(run, run.battle);
    }
    const node = run.map[run.nodeIndex];
    if (node && node.type === "event" && !node.done) {
      let done = false;
      for (let i = 0; i < node.event.opts.length && !done; i++) { const r = resolveEvent(run, i); if (r.ok) done = true; }
      if (!done) { node.done = true; run.nodeIndex++; }
    }
  }
  return run;
}

// 策略 2：聪明（先格挡保血再攻击；按价值选奖励卡）
function smart(seed) {
  const run = newRun(seed);
  let steps = 0;
  while (run.status === "playing" && steps++ < 300) {
    resolveNode(run);
    if (run.rewardCards.length) {
      const scored = run.rewardCards.map(c => ({
        c, v: (CARDS[c].dmg || 0) * 2 + (CARDS[c].block || 0) * 1.5 + (CARDS[c].qish || 0) + (CARDS[c].draw || 0) * 1.2 + (CARDS[c].onTurnStart ? 1.5 : 0)
      }));
      scored.sort((a, b) => b.v - a.v);
      pickRewardCard(run, scored[0].c);
    }
    if (run.battle) {
      let g = 0;
      while (run.battle.status === "playing" && run.battle.turn <= 60 && g++ < 500) {
        const b = run.battle;
        const intent = E.previewIntent(b);
        const block = b.hand.find(c => c !== "__rest__" && CARDS[c] && CARDS[c].type === "skill" && CARDS[c].block);
        if (block && intent && intent.dmg >= 6) { const r = E.playCard(b, block); if (r.ok) continue; }
        const atk = b.hand.find(c => c !== "__rest__" && CARDS[c] && CARDS[c].type === "attack");
        if (atk) { const r = E.playCard(b, atk); if (r.ok) continue; }
        const any = b.hand[0];
        if (any) { const r = E.playCard(b, any); if (r.ok) continue; const d = E.discardCard(b, any); if (d.ok) continue; }
        E.endTurn(b);
      }
      if (run.battle.status === "playing") { run.battle.status = "lose"; run.battle.playerHp = 0; }
      endBattle(run, run.battle);
    }
    const node = run.map[run.nodeIndex];
    if (node && node.type === "event" && !node.done) {
      let done = false;
      for (let i = 0; i < node.event.opts.length && !done; i++) { const r = resolveEvent(run, i); if (r.ok) done = true; }
      if (!done) { node.done = true; run.nodeIndex++; }
    }
  }
  return run;
}

function runStrategy(fn, N) {
  let win = 0, lose = 0;
  const turns = [];
  for (let seed = 1; seed <= N; seed++) {
    const r = fn(seed);
    if (r.status === "win") { win++; turns.push(r.battleCount); } else lose++;
  }
  return { win, lose, N, winRate: (win / N * 100).toFixed(1), avgBattles: turns.length ? (turns.reduce((a,b)=>a+b,0)/turns.length).toFixed(1) : 0 };
}

const N = 200;
const naiveR = runStrategy(naive, N);
const smartR = runStrategy(smart, N);
console.log(`无脑策略 (${N}局): 胜率 ${naiveR.winRate}%, 平均战斗 ${naiveR.avgBattles}`);
console.log(`聪明策略 (${N}局): 胜率 ${smartR.winRate}%, 平均战斗 ${smartR.avgBattles}`);

if (require.main === module) {
  console.log(`\n推荐阈值: 无脑 < 50%, 聪明 > 55%（差距越大越好）`);
  if (smartR.winRate > 55 && smartR.winRate - naiveR.winRate > 5) console.log("✅ 平衡 OK：无脑难赢、有策略易赢");
  else console.log("⚠ 平衡需调整");
}