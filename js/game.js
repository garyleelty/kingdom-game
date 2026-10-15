/**
 * 边塞王国 · 核心规则模块（纯逻辑，无 DOM 依赖）
 * 浏览器与 Node 测试共用同一份规则。
 */
(function (global, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    global.KingdomGame = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------- 基础设定 ---------------- */

  const BUILDINGS = {
    farm:       { name: "农田",   desc: "每回合产出 12 粮食",       cost: { gold: 60,  wood: 20 },              output: { food: 12 } },
    lumber:     { name: "伐木场", desc: "每回合产出 12 木材",        cost: { gold: 55 },                        output: { wood: 12 } },
    quarry:     { name: "采石场", desc: "每回合产出 10 石料",        cost: { gold: 70,  wood: 15 },              output: { stone: 10 } },
    market:     { name: "市场",   desc: "每回合产出 20 金币",        cost: { gold: 80,  wood: 20 },              output: { gold: 20 } },
    barracks:   { name: "兵营",   desc: "每回合训练 4 军队，需养兵",  cost: { gold: 100, stone: 30 },             output: { army: 4 }, upkeep: { food: 6 } },
    wall:       { name: "城墙",   desc: "防御 +15（可叠加）",        cost: { gold: 80,  stone: 40 },             defense: 15 },
    house:      { name: "民居",   desc: "人口上限 +20，微量税收",     cost: { gold: 40,  wood: 20 },              popCap: 20, output: { gold: 3 } },
    temple:     { name: "神庙",   desc: "每回合忠诚 +3",             cost: { gold: 120, stone: 50 },             output: { loyalty: 3 } },
    wonder:     { name: "王座奇观", desc: "建成即胜利",               cost: { gold: 350, wood: 120, stone: 120 },  wonder: true },
  };

  const TAX_LEVELS = [
    { key: "low",    name: "轻税", goldMul: 0.6, loyaltyDelta: +2 },
    { key: "mid",    name: "中税", goldMul: 1.0, loyaltyDelta: 0 },
    { key: "high",   name: "重税", goldMul: 1.5, loyaltyDelta: -4 },
  ];

  /**
   * 集市兑换：金币与建材/粮食的互兑，作为资源死锁的安全阀。
   * buyRate  = 买入 1 单位所需金币（贵）
   * sellRate = 卖出 1 单位所得金币（便宜，防刷钱）
   * 每季有兑换额度（tradeLeft），防止无限套利。
   */
  const TRADE = {
    wood:  { name: "木材", ico: "🪵", buyRate: 3, sellRate: 2, lot: 10 },
    stone: { name: "石料", ico: "🪨", buyRate: 4, sellRate: 2, lot: 10 },
    food:  { name: "粮食", ico: "🌾", buyRate: 2, sellRate: 1, lot: 20 },
  };
  const TRADE_LOTS_PER_TURN = 3; // 每季可在集市成交 3 单

  const EVENT_POOL = [
    { id: "plague",      text: "瘟疫蔓延：人口 -8，忠诚 -5",                     weight: 10, apply: (s) => { s.pop = Math.max(0, s.pop - 8); s.loyalty -= 5; } },
    {
      id: "raiders",
      text: "马匪来犯：防御不达标则遭劫掠",
      weight: 16,
      apply: (s, h) => {
        const threat = h.raiderThreat(s);
        const d = h.totalDefense(s);
        if (d >= threat) return `城防 ${d} 抵御住强度 ${threat} 的马匪。`;
        const gap = (threat - d) / threat; // 防线缺口比例
        const goldLoss = Math.min(Math.floor(s.gold), Math.round(25 + 65 * gap));
        const armyLoss = Math.min(s.army, Math.round(3 + 9 * gap));
        s.gold -= goldLoss;
        s.army -= armyLoss;
        s.loyalty = clamp(s.loyalty - 4, 0, 100);
        return `防线告破！-${goldLoss}🪙 -${armyLoss}⚔️`;
      },
    },
    { id: "bountiful",   text: "丰收之年：粮食 +40",                               weight: 12, apply: (s) => { s.food += 40; } },
    { id: "caravan",     text: "商队过境：金币 +30",                               weight: 12, apply: (s) => { s.gold += 30; } },
    { id: "immigrants",  text: "流民投奔：人口 +6（不超上限）",                     weight: 10, apply: (s, helpers) => { const gain = Math.min(6, helpers.popCap(s) - s.pop); s.pop = Math.max(0, s.pop + Math.max(0, gain)); if (gain < 6) return "城中床位不足，部分流民离去。"; } },
    { id: "drought",     text: "大旱：本回合农田减半（粮 -15）",                    weight: 10, apply: (s) => { s.food = Math.max(0, s.food - 15); } },
    { id: "festival",    text: "全民庆典：忠诚 +8",                                weight: 8,  apply: (s) => { s.loyalty += 8; } },
    { id: "taxrevolt",   text: "苛政之怨：若忠诚低于 30，人口 -10",                 weight: 8,  apply: (s) => { if (s.loyalty < 30) s.pop = Math.max(0, s.pop - 10); else return "民众尚算拥戴，骚乱被安抚。"; } },
    { id: "quake",       text: "地震：随机一座建筑损毁",                            weight: 6,  apply: (s, helpers) => { return helpers.destroyRandomBuilding(s); } },
    { id: "mercenary",   text: "佣兵投效：军队 +6，金币 -25",                       weight: 8,  apply: (s) => { if (s.gold >= 25) { s.gold -= 25; s.army += 6; } else { s.army += 2; return "金库不足，只有少量佣兵留下。"; } } },
  ];

  const TOTAL_TURNS = 30; // 生存 30 季：奇观未成则王朝谢幕

  /* ---------------- 工具 ---------------- */

  function makeRng(seed) {
    // mulberry32：可复现随机
    let a = (seed || Date.now()) >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ---------------- 派生量 ---------------- */

  function popCap(state) {
    return 40 + (state.buildings.house || 0) * 20;
  }

  function totalDefense(state) {
    return (state.buildings.wall || 0) * 15 + Math.floor(state.army * 1.2);
  }

  /** 马匪威胁值：从第 8 季起每季 +4（上限 80），中后期需要持续投入防务 */
  function raiderThreat(state) {
    if (state.turn < 8) return 0;
    return Math.min(80, 15 + (state.turn - 7) * 4);
  }

  function income(state, taxKey) {
    const tax = TAX_LEVELS.find((t) => t.key === taxKey) || TAX_LEVELS[1];
    const out = { gold: 0, food: 0, wood: 0, stone: 0, army: 0, loyalty: 0 };
    for (const [id, n] of Object.entries(state.buildings)) {
      if (!n) continue;
      const def = BUILDINGS[id];
      if (def.output) {
        for (const [k, v] of Object.entries(def.output)) out[k] += v * n;
      }
    }
    // 税收：人口 × 0.6 × 税率
    out.gold += Math.floor(state.pop * 0.6 * tax.goldMul);
    // 口粮消耗：人口 × 0.9；军队口粮由 upkeep 计入
    const upkeepFood = state.pop * 0.9 + (state.buildings.barracks || 0) * 6;
    out.food -= upkeepFood;
    return out;
  }

  function canAfford(state, cost) {
    return Object.entries(cost).every(([k, v]) => (state[k] || 0) >= v);
  }

  function pay(state, cost) {
    for (const [k, v] of Object.entries(cost)) state[k] -= v;
  }

  /* ---------------- 状态 ---------------- */

  function newState(seed) {
    const rng = makeRng(seed);
    return {
      seed: seed || 1,
      rng,
      turn: 1,
      totalTurns: TOTAL_TURNS,
      gold: 260,
      food: 150,
      wood: 90,
      stone: 60,
      pop: 40,
      army: 10,
      loyalty: 60,
      tax: "mid",
      tradeLeft: TRADE_LOTS_PER_TURN,
      buildings: {}, // id -> count
      log: [],
      status: "playing", // playing | win | lose
      endReason: "",
      lastEvent: null,
    };
  }

  function pushLog(state, msg) {
    state.log.unshift({ turn: state.turn, msg });
    if (state.log.length > 60) state.log.pop();
  }

  /* ---------------- 玩家操作 ---------------- */

  function build(state, id) {
    if (state.status !== "playing") return { ok: false, why: "游戏已结束" };
    const def = BUILDINGS[id];
    if (!def) return { ok: false, why: "未知建筑" };
    if (def.wonder && (state.buildings.wonder || 0) > 0)
      return { ok: false, why: "奇观已建成" };
    if (!canAfford(state, def.cost)) return { ok: false, why: "资源不足" };
    pay(state, def.cost);
    state.buildings[id] = (state.buildings[id] || 0) + 1;
    pushLog(state, `建成【${def.name}】`);
    if (def.wonder) {
      state.status = "win";
      state.endReason = "王座奇观落成，王国名垂青史！（建造胜利）";
    }
    return { ok: true };
  }

  function setTax(state, key) {
    if (!TAX_LEVELS.some((t) => t.key === key)) return { ok: false, why: "未知税率" };
    state.tax = key;
    pushLog(state, `税制调整为【${TAX_LEVELS.find((t) => t.key === key).name}】`);
    return { ok: true };
  }

  function feast(state) {
    if (state.gold < 50) return { ok: false, why: "需要 50 金币" };
    state.gold -= 50;
    state.loyalty = clamp(state.loyalty + 10, 0, 100);
    pushLog(state, "举办庆典，忠诚 +10");
    return { ok: true };
  }

  function recruit(state) {
    if (state.gold < 30) return { ok: false, why: "需要 30 金币" };
    if (state.pop < 5) return { ok: false, why: "人口不足" };
    state.gold -= 30;
    state.army += 5;
    pushLog(state, "募兵：军队 +5");
    return { ok: true };
  }

  /**
   * 集市交易。dir: "buy" | "sell"，res: wood|stone|food
   * 买入 lot 单位花费 lot*buyRate 金币；卖出 lot 单位所得 lot*sellRate 金币。
   * 每季限 TRADE_LOTS_PER_TURN 单。卖粮不能低于生存线（粮食卖出后不得 < 0）。
   */
  function trade(state, dir, res) {
    if (state.status !== "playing") return { ok: false, why: "游戏已结束" };
    const t = TRADE[res];
    if (!t) return { ok: false, why: "未知商品" };
    if (state.tradeLeft <= 0) return { ok: false, why: "本季集市额度已用尽" };
    if (dir === "buy") {
      const price = t.lot * t.buyRate;
      if (state.gold < price) return { ok: false, why: `需要 ${price} 金币` };
      state.gold -= price;
      state[res] += t.lot;
      state.tradeLeft -= 1;
      pushLog(state, `集市购入 ${t.name}×${t.lot}（-${price}🪙）`);
      return { ok: true };
    } else if (dir === "sell") {
      if (state[res] < t.lot) return { ok: false, why: `${t.name}不足 ${t.lot}` };
      if (res === "food" && state.food - t.lot < 0) return { ok: false, why: "不可卖断口粮" };
      const gain = t.lot * t.sellRate;
      state[res] -= t.lot;
      state.gold += gain;
      state.tradeLeft -= 1;
      pushLog(state, `集市售出 ${t.name}×${t.lot}（+${gain}🪙）`);
      return { ok: true };
    }
    return { ok: false, why: "未知操作" };
  }

  /* ---------------- 回合推进 ---------------- */

  function pickEvent(state) {
    const total = EVENT_POOL.reduce((a, e) => a + e.weight, 0);
    let r = state.rng() * total;
    for (const e of EVENT_POOL) {
      r -= e.weight;
      if (r <= 0) return e;
    }
    return EVENT_POOL[0];
  }

  function destroyRandomBuilding(state) {
    const owned = Object.entries(state.buildings).filter(([id, n]) => n > 0 && !BUILDINGS[id].wonder);
    if (!owned.length) return "地震摧毁了空地，无人受伤。";
    const idx = Math.floor(state.rng() * owned.length);
    const [id] = owned[idx];
    state.buildings[id] -= 1;
    if (state.buildings[id] <= 0) delete state.buildings[id];
    return `${BUILDINGS[id].name} 在地震中损毁！`;
  }

  function endTurn(state) {
    if (state.status !== "playing") return state;

    // 1. 收支结算
    const inc = income(state, state.tax);
    state.gold += inc.gold;
    state.food += Math.round(inc.food);
    state.wood += inc.wood;
    state.stone += inc.stone;
    state.army += inc.army;
    state.loyalty = clamp(state.loyalty + inc.loyalty, 0, 100);
    pushLog(
      state,
      `季结：金币${fmtDelta(inc.gold)} 粮${fmtDelta(inc.food)} 木${fmtDelta(inc.wood)} 石${fmtDelta(inc.stone)} 军${fmtDelta(inc.army)}`
    );

    // 2. 税率对忠诚的持续影响
    const tax = TAX_LEVELS.find((t) => t.key === state.tax);
    state.loyalty = clamp(state.loyalty + tax.loyaltyDelta, 0, 100);

    // 3. 饥荒
    if (state.food < 0) {
      const starve = Math.min(state.pop, Math.ceil(-state.food / 5) + 3);
      state.pop -= starve;
      state.food = 0;
      state.loyalty = clamp(state.loyalty - 8, 0, 100);
      pushLog(state, `饥荒！人口 -${starve}，民心动荡`);
    }

    // 4. 人口增长 / 流失
    if (state.loyalty >= 50 && state.food > 30) {
      const room = popCap(state) - state.pop;
      if (room > 0) {
        const gain = Math.min(room, 2);
        state.pop += gain;
        pushLog(state, `安居乐业：人口 +${gain}`);
      }
    } else if (state.loyalty < 25) {
      const leave = Math.min(state.pop, 3);
      state.pop -= leave;
      pushLog(state, `民心涣散：人口 -${leave}`);
    }

    // 5. 随机事件
    if (state.rng() < 0.7) {
      const ev = pickEvent(state);
      const extra = ev.apply(state, { totalDefense, popCap, destroyRandomBuilding, raiderThreat });
      state.lastEvent = { id: ev.id, text: ev.text, extra: extra || "" };
      pushLog(state, `事件：${ev.text}${extra ? "（" + extra + "）" : ""}`);
    } else {
      state.lastEvent = null;
      pushLog(state, "此季风平浪静。");
    }

    // 6. 胜负判定
    if (state.pop <= 0) {
      state.status = "lose";
      state.endReason = "人口归零，王国覆灭。";
    } else if (state.loyalty <= 0) {
      state.status = "lose";
      state.endReason = "忠诚归零，爆发革命，王朝倾覆。";
    } else if (state.turn >= state.totalTurns) {
      // 时限已至，奇观未成：根据国力给出评定
      state.status = "lose";
      state.endReason = `${state.totalTurns} 季已过，王座奇观未成，王朝在动荡中谢幕。`;
    }

    if (state.status === "playing") {
      state.turn += 1;
      state.tradeLeft = TRADE_LOTS_PER_TURN; // 集市额度刷新
    }
    return state;
  }

  function fmtDelta(v) {
    const r = Math.round(v);
    return (r >= 0 ? "+" : "") + r;
  }

  return {
    BUILDINGS, TAX_LEVELS, EVENT_POOL, TRADE, TRADE_LOTS_PER_TURN, TOTAL_TURNS,
    newState, build, setTax, feast, recruit, trade, endTurn,
    popCap, totalDefense, raiderThreat, income, canAfford, makeRng, fmtDelta,
  };
});
