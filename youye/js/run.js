// js/run.js — 单局流程（地图/事件/战斗衔接/奖励）
(function (global) {
"use strict";
if (typeof module !== "undefined" && module.exports) {
  require("./cards.js");
  require("./engine.js");
}
const CARDS = global.KingdomGame.CARDS;
const ENEMIES = global.KingdomGame.ENEMIES;
const ELITES = global.KingdomGame.ELITES;
const BOSS = global.KingdomGame.BOSS;
const RELICS = global.KingdomGame.RELICS;
const EVENTS = global.KingdomGame.EVENTS;
const ENGINE = global.KingdomGame;

const MAP_TYPES = ["battle","event","battle","elite","battle","event","battle","boss"];
const PLAYER_START_HP = 80;
const DECK_START = ["zhan","jizhan","pojun","xushi","shoushi","yunyin","huiqi","huaying","duannian","lingxi","jianyi","gushou"];

function makeRng(seed) {
  let a = (seed || Date.now()) >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandomN(rng, arr, n) {
  const a = arr.slice();
  const out = [];
  while (out.length < n && a.length > 0) {
    const i = Math.floor(rng() * a.length);
    out.push(a.splice(i, 1)[0]);
  }
  return out;
}

function randomEnemy(rng) {
  const keys = Object.keys(ENEMIES);
  const k = keys[Math.floor(rng() * keys.length)];
  return { id:k, name:ENEMIES[k].name, hp:ENEMIES[k].hp, intents:ENEMIES[k].intents, maxHp:ENEMIES[k].hp };
}

function randomElite(rng) {
  const keys = Object.keys(ELITES);
  const k = keys[Math.floor(rng() * keys.length)];
  const E = ELITES[k];
  return { id:k, name:E.name, hp:E.hp, intents:baseEliteIntents(k), maxHp:E.hp, eliteMeta:E };
}

function baseEliteIntents(id) {
  if (id === "shanxiao") return [{dmg:8},{block:6},{dmg:12}];
  return [{dmg:7},{dmg:5,hits:2},{block:5,drawSelf:1}];
}

function bossEnemy() {
  return {
    id:"boss", name:BOSS.name,
    hp:BOSS.phase1.hp, maxHp:BOSS.phase1.hp,
    intents:BOSS.phase1.intents,
    intentsPhase2:BOSS.phase2.intents,
    bossPhase2Pct:BOSS.phase2.pct,
  };
}

function randomEvent(rng) {
  const keys = Object.keys(EVENTS);
  const k = keys[Math.floor(rng() * keys.length)];
  return { id:k, name:EVENTS[k].name, opts:EVENTS[k].opts };
}

function genMap(rng) {
  return MAP_TYPES.map((type, i) => ({
    type, index: i, done:false,
    enemy: type === "battle" ? randomEnemy(rng) :
           type === "elite" ? randomElite(rng) :
           type === "boss" ? bossEnemy() : null,
    event: type === "event" ? randomEvent(rng) : null,
  }));
}

function newRun(seed) {
  const rng = makeRng(seed);
  const r = {
    seed, rng,
    status: "playing",
    hp: PLAYER_START_HP,
    maxHp: PLAYER_START_HP,
    gold: 0,
    qishCap: 6,
    deck: DECK_START.slice(),
    relics: [],
    map: genMap(rng),
    nodeIndex: 0,
    battle: null,
    battleEnemy: null,
    rewardCards: [],
    rewardRelic: null,
    buffNextBattle: null,
    log: [],
    firstBattleDone: false,
    battleCount: 0,
  };
  return r;
}

function pushRunLog(r, msg) {
  r.log.unshift(msg);
  if (r.log.length > 50) r.log.pop();
}

function resolveNode(r) {
  if (r.status !== "playing") return r;
  const node = r.map[r.nodeIndex];
  if (!node) { r.status = "win"; return r; }
  if (node.done) { r.nodeIndex++; return resolveNode(r); }

  switch (node.type) {
    case "battle":
    case "elite":
    case "boss":
      return startBattle(r, node);
    case "event":
      pushRunLog(r, `事件：${node.event.name}`);
      return r;
  }
  return r;
}

function startBattle(r, node) {
  const enemy = node.enemy;
  r.battleEnemy = enemy;
  r.battle = ENGINE.newBattle({
    hp: r.hp,
    maxHp: r.maxHp,
    deck: r.deck.slice(),
    relics: r.relics.slice(),
    enemy: { name:enemy.name, hp:enemy.hp, intents:enemy.intents },
    seed: r.seed * 1000 + r.nodeIndex,
    qishCap: r.qishCap,
    firstBattle: !r.firstBattleDone,
    buffNextBattle: r.buffNextBattle,
    bossPhase2Pct: enemy.bossPhase2Pct || null,
  });
  // 给 Boss 二阶段意图
  if (enemy.intentsPhase2) {
    r.battle.enemy.intentsPhase2 = enemy.intentsPhase2;
  }
  r.firstBattleDone = true;
  r.buffNextBattle = null;
  pushRunLog(r, `遭遇【${enemy.name}】`);
  return r.battle;
}

function endBattle(r, battle) {
  const node = r.map[r.nodeIndex];
  r.battle = null;
  r.battleEnemy = null;
  if (!battle) return r;
  r.hp = Math.max(0, battle.playerHp);
  // 同归于尽判 lose
  if (r.hp <= 0) { r.status = "lose"; pushRunLog(r, "力竭而亡……"); return r; }

  if (battle.status === "win") {
    r.battleCount++;
    const isElite = node && node.type === "elite";
    const isBoss = node && node.type === "boss";
    r.gold += (isBoss ? 90 : isElite ? 45 : 20) + r.nodeIndex * 3;
    const pool = Object.keys(CARDS).filter(k => CARDS[k].tier === "upgrade");
    r.rewardCards = pickRandomN(r.rng, pool, 3);
    if (isElite || isBoss) {
      const relicPool = Object.keys(RELICS);
      r.rewardRelic = relicPool[Math.floor(r.rng() * relicPool.length)];
    }
    if (r.relics.includes("fuzhi")) r.hp = Math.min(r.maxHp, r.hp + 5);
    node.done = true;
    r.nodeIndex++;
    pushRunLog(r, `胜利！获得 ${r.gold} 金币`);
    if (isBoss || r.nodeIndex >= r.map.length) r.status = "win";
  } else if (battle.status === "lose") {
    r.hp = 0;
    r.status = "lose";
    pushRunLog(r, "败北……");
  }
  return r;
}

function resolveEvent(r, optIndex) {
  const node = r.map[r.nodeIndex];
  if (!node || node.type !== "event") return { ok:false, why:"当前不是事件节点" };
  const opt = node.event.opts[optIndex];
  if (!opt) return { ok:false, why:"无效选项" };
  if (opt.cost && opt.cost.gold) {
    if (r.gold < opt.cost.gold) return { ok:false, why:"金币不足" };
    r.gold -= opt.cost.gold;
  }
  if (opt.hp) {
    r.hp -= opt.hp;
    if (r.hp <= 0) { r.hp = 0; r.status = "lose"; node.done = true; return { ok:true, dead:true }; }
  }
  if (opt.gain) {
    if (opt.gain.gold) r.gold += opt.gain.gold;
    if (opt.gain.hp) r.hp = Math.min(r.maxHp, r.hp + opt.gain.hp);
    if (opt.gain.relic === true) {
      const pool = Object.keys(RELICS);
      r.relics.push(pool[Math.floor(r.rng() * pool.length)]);
    } else if (typeof opt.gain.relic === "string") {
      r.relics.push(opt.gain.relic);
    }
    if (opt.gain.cards) {
      const pool = Object.keys(CARDS);
      for (let i = 0; i < opt.gain.cards; i++) r.deck.push(pool[Math.floor(r.rng() * pool.length)]);
    }
    if (opt.gain.qishCap) r.qishCap = opt.gain.qishCap;
    if (opt.gain.buffNextBattle) r.buffNextBattle = opt.gain.buffNextBattle;
    if (opt.gain.cardChoice) {
      const pool = Object.keys(CARDS).filter(k => CARDS[k].tier === "upgrade");
      r.rewardCards = pickRandomN(r.rng, pool, 3);
    }
  }
  node.done = true;
  r.nodeIndex++;
  pushRunLog(r, `事件【${node.event.name}】：${opt.label}`);
  if (r.nodeIndex >= r.map.length) r.status = "win";
  return { ok:true };
}

function pickRewardCard(r, cardId) {
  if (!r.rewardCards.includes(cardId)) return { ok:false, why:"非候选卡" };
  r.deck.push(cardId);
  r.rewardCards = [];
  if (r.rewardRelic) {
    r.relics.push(r.rewardRelic);
    r.rewardRelic = null;
  }
  pushRunLog(r, `获得卡牌【${CARDS[cardId].name}】`);
  return { ok:true };
}

function healAtFire(r) {
  if (r.gold < 50) return { ok:false, why:"金币不足" };
  r.gold -= 50;
  r.hp = Math.min(r.maxHp, r.hp + 20);
  pushRunLog(r, "篝火休息，回 20 血");
  return { ok:true };
}

const exports_ = {
  newRun, resolveNode, startBattle, endBattle, resolveEvent,
  pickRewardCard, healAtFire, genMap,
  DECK_START, PLAYER_START_HP, MAP_TYPES,
};

if (typeof module !== "undefined" && module.exports) module.exports = exports_;
if (typeof global !== "undefined") {
  global.KingdomGame = global.KingdomGame || {};
  Object.assign(global.KingdomGame, { run: exports_ });
}
})(typeof globalThis !== "undefined" ? globalThis : this);