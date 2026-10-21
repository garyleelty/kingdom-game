// js/engine.js — 战斗引擎（纯逻辑，无 DOM）
(function (global) {
"use strict";
// Node 环境下先加载 cards.js（UMD 会挂到 global.KingdomGame.CARDS）
if (typeof module !== "undefined" && module.exports) {
  require("./cards.js");
}
const CARDS = global.KingdomGame.CARDS;

const MAX_HAND = 6;
const QISH_THRESHOLD = 6;
const ULT_DMG_BASE = 12;

function makeRng(seed) {
  let a = (seed || Date.now()) >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pushLog(s, msg) {
  s.log.push(`T${s.turn} ${msg}`);
  if (s.log.length > 60) s.log.shift();
}

/** 新建战斗 */
function newBattle(cfg) {
  const rng = makeRng(cfg.seed || 1);
  const RELICS = global.KingdomGame.RELICS;
  const enemy = cfg.enemy || { name:"游魂", hp:22, intents:[{dmg:6}] };
  const s = {
    status: "playing",
    seed: cfg.seed || 1,
    rng,
    log: [],
    turn: 1,
    turnCount: 0,
    maxHand: MAX_HAND,

    playerHp: cfg.hp,
    maxPlayerHp: cfg.maxHp || cfg.hp,
    energy: 3,
    maxEnergy: 3,
    block: 0,
    qish: 0,
    qishCap: cfg.qishCap || QISH_THRESHOLD,
    discardUsed: false,

    deck: shuffle(cfg.deck.slice(), rng),
    hand: [],
    discard: [],
    powers: [],
    // 本回合打出的牌（昆特同名牌 Bond 用）
    playedThisTurn: [],
    // bond 连牌标记：记录哪些卡已触发过 Bond（用于 UI 高亮）
    bonded: [],

    enemy: { name:enemy.name, hp:enemy.hp, maxHp:enemy.hp, intents:enemy.intents, intent:0, phase:1 },
    enemyHp: enemy.hp,
    enemyBlock: 0,
    enemyBuff: {},
    intentLog: [],
    lastEnemyIntent: null,

    relics: (cfg.relics || []).slice(),
    relicEff: {},
    firstBattle: !!cfg.firstBattle,
    buffNextBattle: cfg.buffNextBattle || null,

    selfDmgNext: 0,
    poisonOnPlayer: 0,
    enemySkipTurn: 0,
    enemyRandomIntent: false,
    enemyReduceDmg: 0,
    lastAttackCard: null,
    goldEarned: 0,

    // boss 阶段
    bossPhase2Pct: cfg.bossPhase2Pct || null,
    specialEvery: null,
    specialCounter: 0,
  };

  // 遗物效果
  for (const r of s.relics) {
    const eff = RELICS[r]?.effect || {};
    if (eff.goldOnStart) s.goldEarned += eff.goldOnStart;
    if (eff.powerCost) s.relicEff.powerCost = eff.powerCost;
    if (eff.qishPerAttack) s.relicEff.qishPerAttack = eff.qishPerAttack;
    if (eff.ultDmg) s.relicEff.ultDmg = eff.ultDmg;
    if (eff.firstBlock) s.relicEff.firstBlock = eff.firstBlock;
    if (eff.extraDrawEvery) s.relicEff.extraDrawEvery = eff.extraDrawEvery;
    if (eff.healAfterBattle) s.relicEff.healAfterBattle = eff.healAfterBattle;
    if (eff.firstBattleReduce && s.firstBattle) s.relicEff.firstBattleReduce = eff.firstBattleReduce;
  }
  // 事件 buff
  if (s.buffNextBattle && s.buffNextBattle.reduceDmg) s.relicEff.firstBattleReduce = s.buffNextBattle.reduceDmg;
  if (s.buffNextBattle && s.buffNextBattle.qishStart) s.qish = s.buffNextBattle.qishStart;

  drawPhase(s, 5);
  return s;
}

function drawPhase(s, n) {
  for (let i = 0; i < n && s.hand.length < s.maxHand; i++) {
    if (s.deck.length === 0) {
      if (s.discard.length === 0) {
        // 保底：牌库+弃牌堆皆空时，给一张 0 费「蓄势」（气势+1），避免死锁
        s.hand.push("__rest__");
        continue;
      }
      s.deck = shuffle(s.discard, s.rng);
      s.discard = [];
      pushLog(s, "弃牌堆洗回抽牌堆");
    }
    s.hand.push(s.deck.pop());
  }
}

function cardCost(s, cardId) {
  if (cardId === "__rest__") return 0;
  const base = CARDS[cardId];
  let cost = base.cost;
  if (base.type === "power" && s.relicEff.powerCost) {
    cost = Math.max(0, cost - s.relicEff.powerCost);
  }
  return cost;
}

/** 打出卡牌 */
function playCard(s, cardId) {
  if (s.status !== "playing") return { ok:false, why:"战斗已结束" };
  const idx = s.hand.indexOf(cardId);
  if (idx < 0) return { ok:false, why:"手牌中无此卡" };
  // 保底卡 __rest__：0 费，气势+1
  if (cardId === "__rest__") {
    s.hand.splice(idx, 1);
    s.qish += 1;
    pushLog(s, "调息，气势+1");
    checkUlt(s);
    return { ok:true };
  }
  const base = CARDS[cardId];
  const cost = cardCost(s, cardId);
  if (s.energy < cost) return { ok:false, why:"灵气不足" };

  s.energy -= cost;
  s.hand.splice(idx, 1);

  // —— 同名牌（Bond）：本回合已打出过同名卡则效果翻倍 ——
  let bondMult = 1;
  let bondTriggered = false;
  if (base.bond && s.playedThisTurn.includes(cardId)) {
    bondMult = 2;
    bondTriggered = true;
    pushLog(s, `同名牌连发！【${base.name}】效果翻倍`);
  }
  s.playedThisTurn.push(cardId);
  if (bondTriggered && !s.bonded.includes(cardId)) s.bonded.push(cardId);

  // 攻击牌
  if (base.type === "attack") {
    let dmg = (base.dmg || 0) * bondMult;
    // 破军之势全局 +2
    if (s.powers.includes("pojunshi")) dmg += 2;
    // 剑气纵横：若手牌全攻击牌再打一次
    const allAtk = s.hand.every(c => CARDS[c] && CARDS[c].type === "attack");
    const hits = base.hits || 1;
    let total = 0;
    for (let h = 0; h < hits; h++) total += dmg;
    if (base.allAttackBonus && allAtk && s.hand.length > 0) total += base.allAttackBonus;
    if (base.pierce) s.enemyBlock = 0;
    // 伤害先被敌人格挡吸收
    const blocked = Math.min(s.enemyBlock, total);
    s.enemyBlock -= blocked;
    const actual = total - blocked;
    s.enemyHp = Math.max(0, s.enemyHp - actual);
    // 气势
    let qishGain = (base.qish || 0) + 2;
    if (s.relicEff.qishPerAttack) qishGain += s.relicEff.qishPerAttack;
    if (s.powers.includes("jiandan")) qishGain += 1;
    s.qish += qishGain;
    s.lastAttackCard = cardId;
    // 血契自伤
    if (base.selfDmgNext) s.selfDmgNext += base.selfDmgNext;
    pushLog(s, `打出【${base.name}】造成 ${actual} 伤害（原 ${total}，格挡 ${blocked}），气势+${qishGain}`);
    checkWin(s);
    if (s.status !== "playing") return { ok:true };
  }

  // 技能牌
  if (base.type === "skill") {
    if (base.block) {
      let b = base.block * bondMult;
      if (s.relicEff.firstBlock && s.block === 0) b += s.relicEff.firstBlock;
      s.block += b;
      if (base.counter) s.enemyReduceDmg += base.counter;
    }
    if (base.draw) drawPhase(s, base.draw * bondMult);
    if (base.qish) s.qish += base.qish * bondMult;
    if (base.discard) {
      for (let i = 0; i < base.discard && s.hand.length > 0; i++) s.discard.push(s.hand.pop());
    }
    if (base.reshuffle) {
      const n = s.hand.length;
      s.discard.push(...s.hand);
      s.hand = [];
      drawPhase(s, n);
    }
    if (base.pierce) s.enemyBlock = 0;
    if (base.skipIntent) s.enemySkipTurn += base.skipIntent;
    if (base.randomIntent) s.enemyRandomIntent = true;
    if (base.copyLastAttack && s.lastAttackCard) {
      const orig = CARDS[s.lastAttackCard];
      const half = Math.max(1, Math.floor((orig.dmg || 0) * base.copyLastAttack));
      s.enemyHp = Math.max(0, s.enemyHp - half);
      pushLog(s, `借影复制【${orig.name}】造成 ${half} 伤害`);
      checkWin(s);
    }
    pushLog(s, `打出【${base.name}】`);
  }

  // 能力牌
  if (base.type === "power") {
    if (!s.powers.includes(cardId)) s.powers.push(cardId);
    pushLog(s, `打出能力【${base.name}】，持续生效`);
    if (base.onTurnStart) applyOnTurnStart(s, base.onTurnStart);
  }

  checkUlt(s);
  return { ok:true };
}

function applyOnTurnStart(s, eff) {
  if (eff.qi) s.maxEnergy = Math.min(6, s.maxEnergy + eff.qi);
  if (eff.qish) s.qish += eff.qish;
  if (eff.block) s.block += eff.block;
}

function checkUlt(s) {
  if (s.status !== "playing") return;
  if (s.qish >= s.qishCap) {
    let ultDmg = s.relicEff.ultDmg || ULT_DMG_BASE;
    if (s.powers.includes("dazhao")) ultDmg += 6;
    s.enemyHp = Math.max(0, s.enemyHp - ultDmg);
    s.qish = 0;
    pushLog(s, `💥 一剑霜寒！造成 ${ultDmg} 伤害`);
    checkWin(s);
  }
}

function checkWin(s) {
  if (s.status !== "playing") return;
  if (s.enemyHp <= 0) s.status = "win";
  if (s.playerHp <= 0) s.status = "lose";
}

/** 弃一张手牌（每回合一次） */
function discardCard(s, cardId) {
  if (s.discardUsed) return { ok:false, why:"本回合已弃过牌" };
  const idx = s.hand.indexOf(cardId);
  if (idx < 0) return { ok:false, why:"手牌中无此卡" };
  s.hand.splice(idx, 1);
  s.discard.push(cardId);
  drawPhase(s, 1);
  s.discardUsed = true;
  return { ok:true };
}

/** 获取当前意图 */
function currentIntent(s) {
  const pool = s.enemy.intents;
  if (!pool || pool.length === 0) return null;
  let idx;
  if (s.enemyRandomIntent) {
    idx = Math.floor(s.rng() * pool.length);
  } else {
    idx = (s.enemy.intent || 0) % pool.length;
    s.enemy.intent = idx + 1;
  }
  const intent = { ...pool[idx], _idx: idx };
  s.lastEnemyIntent = intent;
  return intent;
}

function previewIntent(s) {
  if (s.status !== "playing") return null;
  const pool = s.enemy.intents;
  if (!pool || pool.length === 0) return null;
  const idx = (s.enemy.intent || 0) % pool.length;
  return pool[idx];
}

/** 结束回合 */
function endTurn(s) {
  if (s.status !== "playing") return s;

  // ① 毒/自伤
  if (s.poisonOnPlayer > 0) {
    s.playerHp -= s.poisonOnPlayer;
    s.poisonOnPlayer -= 1;
    pushLog(s, `中毒 ${s.poisonOnPlayer + 1} 伤害`);
  }
  if (s.selfDmgNext > 0) {
    s.playerHp -= s.selfDmgNext;
    s.selfDmgNext = 0;
  }

  // ② 敌人行动
  if (s.enemySkipTurn > 0) {
    s.enemySkipTurn -= 1;
    pushLog(s, `【${s.enemy.name}】被封妖，跳过行动`);
  } else {
    const intent = currentIntent(s);
    if (intent) {
      // 减伤（金刚身 + 反手 + 遗物首战）
      let dmg = intent.dmg || 0;
      let reduce = s.enemyReduceDmg;
      if (s.relicEff.firstBattleReduce && s.turn === 1) reduce += s.relicEff.firstBattleReduce;
      if (s.powers.includes("jingang")) reduce += 1;
      dmg = Math.max(0, dmg - reduce);

      const blocked = Math.min(s.block, dmg);
      s.block -= blocked;
      const actual = dmg - blocked;
      s.playerHp -= actual;
      if (intent.poison) s.poisonOnPlayer += intent.poison;
      if (intent.stealQi) s.energy = Math.max(0, s.energy - intent.stealQi);
      if (intent.stealQish) s.qish = Math.max(0, s.qish - intent.stealQish);
      if (intent.clearQish) s.qish = 0;
      pushLog(s, `【${s.enemy.name}】${intentLabel(intent)} → 你受 ${actual} 伤害`);
    }
    if (intent && intent.lifesteal) s.enemyHp = Math.min(s.enemy.maxHp, s.enemyHp + intent.dmg);
    if (intent && intent.revive && s.enemyHp <= 0) {
      s.enemyHp = Math.floor(s.enemy.maxHp * 0.5);
      intent.revive -= 1;
      pushLog(s, `【白骨】复活！`);
    }
    if (intent && intent.heal) s.enemyHp = Math.min(s.enemy.maxHp, s.enemyHp + intent.heal);
    if (intent && intent.block) s.enemyBlock += intent.block;
    // 敌人格挡回合末不清零（保持到被击破）—— 简化：敌人格挡持续
  }

  checkWin(s);
  if (s.status !== "playing") return s;

  // Boss 阶段切换
  if (s.bossPhase2Pct && s.enemy.phase === 1 && s.enemyHp <= s.enemy.maxHp * s.bossPhase2Pct) {
    s.enemy.phase = 2;
    s.enemy.intents = s.enemy.intentsPhase2 || s.enemy.intents;
    s.enemy.intent = 0;
    pushLog(s, `⚠【${s.enemy.name}】进入第二形态！`);
  }

  // ③ 新回合
  s.turn += 1;
  s.turnCount += 1;
  s.energy = s.maxEnergy;
  s.block = 0;
  s.enemyBlock = 0; // 敌人格挡回合末清零
  s.discardUsed = false;
  s.playedThisTurn = [];
  s.bonded = [];

  // 能力牌 onTurnStart
  for (const p of s.powers) {
    const eff = CARDS[p]?.onTurnStart;
    if (eff) applyOnTurnStart(s, eff);
  }

  // 遗物罗盘每3回合抽1
  if (s.relicEff.extraDrawEvery && s.turn % s.relicEff.extraDrawEvery === 0) drawPhase(s, 1);

  // 抽牌（灵脉每回合+1）
  const baseDraw = 5 + (s.powers.includes("lingmai") ? 1 : 0);
  drawPhase(s, baseDraw);

  // 妖气入体：敌人回合开始回血
  if (s.powers.includes("yaoqi")) s.playerHp = Math.min(s.maxPlayerHp, s.playerHp + 3);

  return s;
}

function intentLabel(intent) {
  if (intent.dmg) return `攻击 ${intent.dmg}${intent.hits > 1 ? "×" + intent.hits : ""}`;
  if (intent.block) return `格挡 ${intent.block}`;
  if (intent.heal) return `回血 ${intent.heal}`;
  if (intent.mirror) return `镜反`;
  return "行动";
}

const exports_ = {
  newBattle, playCard, discardCard, endTurn, cardCost,
  makeRng, QISH_THRESHOLD, ULT_DMG_BASE, MAX_HAND,
  previewIntent, intentLabel,
};

if (typeof module !== "undefined" && module.exports) module.exports = exports_;
if (typeof global !== "undefined") {
  global.KingdomGame = global.KingdomGame || {};
  Object.assign(global.KingdomGame, exports_);
}
})(typeof globalThis !== "undefined" ? globalThis : this);