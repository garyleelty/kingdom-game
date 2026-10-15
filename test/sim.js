/**
 * 平衡模拟：node test/sim.js
 * 三种打法对比：无为 / 只会造田（不懂集市）/ 合格打法（税制+防务+集市）
 */
const G = require("../js/game.js");

function have(s, id) { return s.buildings[id] || 0; }
function tryBuild(s, ids) {
  const c = G.BUILDINGS;
  for (const id of ids) if (G.canAfford(s, c[id].cost) && G.build(s, id).ok) return id;
  return null;
}

/* 只会造田：不懂集市、不管防务 */
function farmOnly(s) {
  const net = G.income(s, s.tax);
  if (net.food < 8) tryBuild(s, ["farm"]);
  else tryBuild(s, ["market"]);
  if (G.canAfford(s, G.BUILDINGS.wonder.cost)) G.build(s, "wonder");
}

/* 合格打法：税制管理 + 防务 + 集市套利冲奇观 */
function competent(s) {
  const net = G.income(s, s.tax);
  const c = G.BUILDINGS;
  // 忠诚管理
  if (s.loyalty < 40 && s.tax !== "low") G.setTax(s, "low");
  else if (s.loyalty > 65 && s.tax === "low") G.setTax(s, "mid");
  if (s.loyalty < 32 && s.gold > 180) G.feast(s);
  // 防务：城墙优先，其次募兵
  const need = G.raiderThreat(s), def = G.totalDefense(s);
  if (def < need) {
    if (have(s, "wall") < 2) tryBuild(s, ["wall"]);
    else if (s.gold > 150) G.recruit(s);
  }
  // 产能建设
  if (s.turn <= 3) {
    if (have(s, "lumber") < 2) tryBuild(s, ["lumber"]);
    if (have(s, "quarry") < 2) tryBuild(s, ["quarry"]);
    if (net.food < 8) tryBuild(s, ["farm"]);
  } else {
    if (net.food < 8) tryBuild(s, ["farm"]);
    else if (have(s, "market") < 3) tryBuild(s, ["market"]);
    if (s.pop >= G.popCap(s) - 3 && have(s, "house") < 3) tryBuild(s, ["house"]);
  }
  // 集市：先补齐奇观所需木/石，再卖 surplus 换金
  const t = c.wonder.cost;
  while (s.tradeLeft > 0) {
    if (s.wood < t.wood && s.gold > 100 && G.trade(s, "buy", "wood").ok) continue;
    if (s.stone < t.stone && s.gold > 100 && G.trade(s, "buy", "stone").ok) continue;
    break;
  }
  while (s.tradeLeft > 0 && (s.wood > t.wood + 40 || s.stone > t.stone + 40) && s.gold < t.gold) {
    if (s.wood > t.wood + 40 && G.trade(s, "sell", "wood").ok) continue;
    if (s.stone > t.stone + 40 && G.trade(s, "sell", "stone").ok) continue;
    break;
  }
  if (G.canAfford(s, t)) G.build(s, "wonder");
}

/* 只买不卖：会用集市补建材，但不会卖多余建材换金（与 competent 相同但去掉卖出段） */
function buyOnlyStrategy(s) {
  const net = G.income(s, s.tax);
  const c = G.BUILDINGS;
  if (s.loyalty < 40 && s.tax !== "low") G.setTax(s, "low");
  else if (s.loyalty > 65 && s.tax === "low") G.setTax(s, "mid");
  if (s.loyalty < 32 && s.gold > 180) G.feast(s);
  const need = G.raiderThreat(s), def = G.totalDefense(s);
  if (def < need) {
    if (have(s, "wall") < 2) tryBuild(s, ["wall"]);
    else if (s.gold > 150) G.recruit(s);
  }
  if (s.turn <= 3) {
    if (have(s, "lumber") < 2) tryBuild(s, ["lumber"]);
    if (have(s, "quarry") < 2) tryBuild(s, ["quarry"]);
    if (net.food < 8) tryBuild(s, ["farm"]);
  } else {
    if (net.food < 8) tryBuild(s, ["farm"]);
    else if (have(s, "market") < 3) tryBuild(s, ["market"]);
    if (s.pop >= G.popCap(s) - 3 && have(s, "house") < 3) tryBuild(s, ["house"]);
  }
  const t = c.wonder.cost;
  while (s.tradeLeft > 0) {
    if (s.wood < t.wood && s.gold > 100 && G.trade(s, "buy", "wood").ok) continue;
    if (s.stone < t.stone && s.gold > 100 && G.trade(s, "buy", "stone").ok) continue;
    break;
  }
  if (G.canAfford(s, t)) G.build(s, "wonder");
}

function passive() { /* 什么都不做 */ }

function play(strategy, seed) {
  const s = G.newState(seed);
  let guard = 0;
  while (s.status === "playing" && guard++ < 80) {
    strategy(s);
    G.endTurn(s);
  }
  return s;
}

function batch(name, strategy, n = 300) {
  let win = 0, turns = [];
  for (let i = 1; i <= n; i++) {
    const s = play(strategy, i);
    if (s.status === "win") { win++; turns.push(s.turn); }
  }
  turns.sort((a, b) => a - b);
  const med = turns.length ? turns[Math.floor(turns.length / 2)] : "-";
  console.log(`${name.padEnd(14)} 胜率 ${(win / n * 100).toFixed(1).padStart(5)}%  中位通关第 ${med} 季`);
}

if (require.main === module) {
  batch("无为", passive);
  batch("只会造田", farmOnly);
  batch("只买不卖", buyOnlyStrategy);
  batch("合格打法", competent);
}

module.exports = { play, passive, farmOnly, buyOnlyStrategy, competent };
