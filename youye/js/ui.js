// js/ui.js — UI 层（浏览器端），依赖 window.KingdomGame
// 风格：achromatic-ledger（app screen 规则）
(function (global) {
"use strict";
const KG = global.KingdomGame;
const CARDS = KG.CARDS;
const RELICS = KG.RELICS;
const E = KG;
const RUN = KG.run;

const $ = (id) => document.getElementById(id);
let run = null;
let atFire = false;           // 是否停在篝火这一屏

// 敌人画像：找不到就退回以字代画的落款
const PORTRAITS = {
  youhun:"youhun", yaohou:"yaohou", zhiyuan:"zhiyuan", shigui:"shigui",
  yexiao:"yexiao", shenv:"shenv", jingyao:"jingyao", baigu:"baigu",
  shanxiao:"shanxiao", shenlou:"shenlou", boss:"boss",
};
const EXT = [".jpg", ".png", ".svg", ".jpeg", ".webp"];

const REDUCED = () =>
  global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------------- 启动 ---------------- */

function init() {
  $("btn-restart").onclick = () => { atFire = false; newGame(); };
  $("btn-end-turn").onclick = () => {
    if (!run || !run.battle || run.battle.status !== "playing") return;
    E.endTurn(run.battle);
    render();
  };
  $("btn-discard").onclick = () => {
    if (!run || !run.battle || run.battle.status !== "playing") return;
    const card = run.battle.hand[0];
    if (card) { E.discardCard(run.battle, card); render(); }
  };
  $("btn-campfire").onclick = () => {
    if (!run) return;
    const res = RUN.healAtFire(run);
    if (!res.ok) { flash(res.why); return; }
    run.fireUsed = true;
    atFire = false;
    render();
  };
  $("btn-campfire-skip").onclick = () => { atFire = false; render(); };
  // 夜色山道：画不见了就把这一块收起来
  $("road-figure-img").onerror = () => $("road-figure").classList.add("is-empty");
  $("road-figure-credit").textContent = "戴进《钟馗夜游图》· 15 世纪 · 公有领域";
  newGame();
}

function newGame() {
  run = RUN.newRun(Math.floor(Math.random() * 100000));
  if (run.fireUsed === undefined) run.fireUsed = false;
  render();
}

/* ---------------- 总渲染 ---------------- */

function render() {
  if (!run) return;
  renderTopbar();
  renderMap();
  renderBattle();
  renderEvent();
  renderReward();
  renderCampfire();
  renderEnd();
  renderLog();
}

function renderTopbar() {
  $("hp-display").textContent = run.hp;
  $("hp-max").textContent = "/" + run.maxHp;
  $("gold-display").textContent = run.gold;
  $("node-display").textContent = Math.min(run.nodeIndex + 1, run.map.length);
  $("node-max").textContent = "/" + run.map.length;
}

/* ---------------- 地图：妖雾之路 ---------------- */

const KIND_LABEL = { battle:"战斗", event:"异闻", elite:"精英", boss:"决战" };

/** 当前该显示哪一屏。地图只是"还没进洞"时的那一屏。 */
function eventNode() {
  if (atFire || run.battle || run.status !== "playing") return null;
  const node = run.map[run.nodeIndex];
  if (!node || node.type !== "event" || node.done) return null;
  return node;
}
function hasReward() {
  return run.rewardCards.length > 0 || !!run.rewardRelic;
}

function renderMap() {
  const panel = $("map-panel");
  if (atFire || run.battle || run.status !== "playing" || eventNode() || hasReward()) {
    panel.classList.add("hidden"); return;
  }
  panel.classList.remove("hidden");

  const nodes = $("map-nodes");
  nodes.innerHTML = "";
  run.map.forEach((node, i) => {
    const li = document.createElement("li");
    const isCurrent = i === run.nodeIndex && !node.done;
    li.className = node.done ? "done" : (isCurrent ? "current" : "");
    const name = node.enemy ? node.enemy.name : (node.event ? node.event.name : "");
    const state = node.done ? "已过" : (isCurrent ? "在此" : "未至");
    li.innerHTML =
      `<span class="road-num">${i + 1}</span>` +
      `<span class="road-kind">${KIND_LABEL[node.type] || "遭遇"}</span>` +
      `<span class="road-name">${name}</span>` +
      `<span class="road-state">${state}</span>`;
    nodes.appendChild(li);
  });

  const node = run.map[run.nodeIndex];
  const actions = $("map-actions");
  actions.innerHTML = "";

  if (node && !node.done) {
    if (node.type === "battle" || node.type === "elite" || node.type === "boss") {
      const btn = document.createElement("button");
      btn.className = "primary";
      btn.textContent = node.type === "boss" ? "挑战妖王·夜叉"
                     : node.type === "elite" ? "挑战精英" : "开始战斗";
      btn.onclick = () => { RUN.resolveNode(run); render(); };
      actions.appendChild(btn);
    }
    if (!run.fireUsed) {
      const fire = document.createElement("button");
      fire.className = "ghost";
      fire.textContent = "在篝火旁歇息";
      fire.onclick = () => { atFire = true; render(); };
      actions.appendChild(fire);
    }
  }

  $("map-sub").textContent = mapSub(node);
  renderMapRail();
}

const TYPE_NAME = { attack:"攻击", skill:"技能", power:"能" };

function renderMapRail() {
  $("map-deck").textContent = run.deck.length;
  $("map-relics").textContent = run.relics.length;
  $("map-qishcap").textContent = run.qishCap;

  const mix = $("map-deck-mix");
  mix.innerHTML = "";
  const counts = { attack:0, skill:0, power:0 };
  for (const id of run.deck) { const c = CARDS[id]; if (c) counts[c.type] = (counts[c.type] || 0) + 1; }
  for (const t of ["attack", "skill", "power"]) {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = TYPE_NAME[t];
    const dd = document.createElement("dd");
    dd.textContent = counts[t];
    row.appendChild(dt); row.appendChild(dd);
    mix.appendChild(row);
  }

  const log = $("map-log");
  log.innerHTML = "";
  if (!run.log.length) {
    const p = document.createElement("p");
    p.textContent = "刚上路。";
    log.appendChild(p);
    return;
  }
  run.log.slice(-8).forEach(msg => {
    const p = document.createElement("p");
    p.textContent = msg;
    log.appendChild(p);
  });
}
function mapSub(node) {
  if (!node) return "路已走完。";
  if (node.type === "boss") return "最后一段路。妖王在雾的最深处。";
  if (node.type === "elite") return "雾里有强敌。赢了必得遗物。";
  if (node.type === "event") return "雾里传来人声，未知是福是祸。";
  const n = node.enemy;
  return n ? `雾里有个东西在动。${n.name}，血量 ${n.hp}。` : "雾里传来脚步声。";
}

/* ---------------- 战斗 ---------------- */

function renderBattle() {
  const panel = $("battle-panel");
  if (atFire || !run.battle) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  const b = run.battle;

  $("battle-title").textContent = b.enemy.name;
  $("battle-sub").textContent = qishFinding(b);

  // 对手
  const id = run.battleEnemy ? run.battleEnemy.id : null;
  renderPortrait($("enemy-portrait"), id, b.enemy.name);
  $("enemy-intent").textContent = "意图 · " + intentText(E.previewIntent(b));
  const pct = Math.max(0, Math.min(100, (b.enemyHp / b.enemy.maxHp) * 100));
  $("enemy-hp-fill").style.width = pct + "%";
  $("enemy-hp-text").textContent = `${Math.max(0, b.enemyHp)} / ${b.enemy.maxHp}`;

  // 我方
  $("qish-num").textContent = b.qish;
  $("qish-fill").style.width = Math.max(0, Math.min(100, (b.qish / b.qishCap) * 100)) + "%";
  $("energy-num").textContent = b.energy;
  $("block-num").textContent = b.block;
  $("hp-battle-num").textContent = b.playerHp;

  // 牌堆
  $("deck-count").textContent = b.deck.length;
  $("discard-count").textContent = b.discard.length;
  $("relic-count").textContent = run.relics.length;

  renderHand(b);
  renderPlayed(b);

  $("btn-end-turn").disabled = b.status !== "playing";
  $("btn-discard").disabled = b.status !== "playing" || b.discardUsed || b.hand.length === 0;
}

/** 这一屏最先被读到的一句：气势与那一剑 */
function qishFinding(b) {
  const left = b.qishCap - b.qish;
  if (left <= 0) return `气势 ${b.qish}/${b.qishCap}：一剑霜寒已蓄满，下一张牌即可发动`;
  return `气势 ${b.qish}/${b.qishCap}：再攒 ${left} 点发动「一剑霜寒」（${E.ULT_DMG_BASE} 伤害）`;
}

function intentText(intent) {
  if (!intent) return "意图不明";
  const bits = [];
  if (intent.dmg) bits.push(`攻击 ${intent.dmg}${intent.hits > 1 ? "×" + intent.hits : ""}`);
  if (intent.block) bits.push(`格挡 ${intent.block}`);
  if (intent.heal) bits.push(`回血 ${intent.heal}`);
  if (intent.mirror) bits.push("镜反");
  if (intent.stealQi) bits.push(`夺灵气 ${intent.stealQi}`);
  if (intent.stealQish) bits.push(`夺气势 ${intent.stealQish}`);
  if (intent.poison) bits.push(`施毒 ${intent.poison}`);
  if (!bits.length) return "意图不明";
  return bits.join(" · ");
}

function renderPortrait(el, id, name) {
  const key = id && PORTRAITS[id];
  // 同一个对手就别重画：重画会让画像在重新渲染时闪一下空白
  if (el.dataset.pid === String(key) && el.dataset.pname === name) return;
  el.dataset.pid = String(key);
  el.dataset.pname = name;
  el.innerHTML = "";
  // 底上永远压着一个字：画没找到时，它就是画像
  const glyph = document.createElement("span");
  glyph.className = "foe-glyph";
  glyph.textContent = name.slice(0, 1);
  el.appendChild(glyph);
  if (!key) return;
  const img = document.createElement("img");
  img.className = "foe-img";
  img.alt = name;
  const tryExt = (i) => {
    if (i >= EXT.length) return;          // 找不到就留字
    img.onerror = () => tryExt(i + 1);
    img.onload = () => img.classList.add("is-loaded");
    img.src = `img/${key}${EXT[i]}`;
  };
  tryExt(0);
  el.appendChild(img);
}

/* ---------------- 手牌 ---------------- */

function renderHand(b) {
  const hand = $("hand");
  const emptyEl = $("hand-empty");
  hand.innerHTML = "";
  emptyEl.classList.toggle("hidden", b.hand.length > 0 || b.status !== "playing");

  for (const cardId of b.hand) {
    if (cardId !== "__rest__" && !CARDS[cardId]) continue;   // 认不出的牌不占位
    const btn = document.createElement("button");
    btn.className = "card " + cardClass(cardId);
    btn.dataset.card = cardId;
    btn.innerHTML = cardMarkup(b, cardId);
    if (b.status === "playing") {
      btn.onclick = () => onPlayCard(b, cardId, btn);
    } else {
      btn.disabled = true;
    }
    hand.appendChild(btn);
  }
}

function onPlayCard(b, cardId, srcEl) {
  const ehpBefore = b.enemyHp;
  const qishBefore = b.qish;
  const srcRect = srcEl.getBoundingClientRect();

  const res = E.playCard(b, cardId);
  if (!res.ok) { flash(res.why); render(); return; }

  const bonded = b.bonded.includes(cardId);
  render();

  // 牌从手牌飞进战阵
  const dest = $("played-cards").querySelector('[data-new="1"]');
  if (dest) flyTo(srcRect, dest);

  // 同名牌：金印落定
  if (bonded) {
    for (const el of $("played-cards").querySelectorAll(".card.bonded")) {
      el.classList.remove("bond-leaf");
      void el.offsetWidth;
      el.classList.add("bond-leaf");
    }
  }
  playFx(b, cardId, ehpBefore, qishBefore);
}

function flyTo(srcRect, destEl) {
  if (REDUCED() || !srcRect || !srcRect.width) return;
  const b = destEl.getBoundingClientRect();
  if (!b.width) return;
  const dx = srcRect.left - b.left;
  const dy = srcRect.top - b.top;
  const sx = srcRect.width / b.width;
  const sy = srcRect.height / b.height;
  destEl.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.4 },
      { transform: "translate(0px, 0px) scale(1, 1)", opacity: 1 },
    ],
    { duration: 300, easing: "cubic-bezier(.2,.8,.3,1)" }
  );
}

/* ---------------- 战阵 ---------------- */

function renderPlayed(b) {
  const area = $("played-cards");
  const emptyEl = $("played-empty");
  area.innerHTML = "";
  const played = b.playedThisTurn || [];
  emptyEl.classList.toggle("hidden", played.length > 0);
  area.classList.toggle("is-empty", played.length === 0);
  if (!played.length) return;

  const newIdx = played.length - 1;
  const order = [];
  const byId = {};
  played.forEach((c, i) => {
    if (!byId[c]) { byId[c] = []; order.push(c); }
    byId[c].push(i);
  });

  order.forEach((id) => {
    const idxs = byId[id];
    const bonded = idxs.length > 1;
    idxs.forEach((pi, k) => {
      if (bonded && k === 1) {
        const link = document.createElement("span");
        link.className = "bond-link";
        link.setAttribute("aria-hidden", "true");
        area.appendChild(link);
      }
      const el = document.createElement("div");
      el.className = "card " + cardClass(id) + (bonded ? " bonded" : "");
      el.dataset.card = id;
      el.innerHTML = cardMarkup(b, id, { bonded });
      if (pi === newIdx) el.dataset.new = "1";
      area.appendChild(el);
    });
  });
}

function cardClass(cardId) {
  if (cardId === "__rest__") return "skill rest";
  const c = CARDS[cardId];
  return c ? c.type : "skill";
}

function cardMarkup(b, cardId, opts) {
  const o = opts || {};
  if (cardId === "__rest__") {
    return `<span class="card-top"><span class="card-type">技</span><span class="card-cost">0</span></span>
            <span class="card-name">调息</span>
            <span class="card-desc">气势 +1</span>`;
  }
  const card = CARDS[cardId];
  if (!card) return "";
  const typeLabel = { attack:"攻", skill:"技", power:"能" }[card.type];
  const cost = b ? E.cardCost(b, cardId) : (card.cost || 0);
  const mark = o.bonded ? `<span class="card-mark">×2</span>` : "";
  return `<span class="card-top"><span class="card-type">${typeLabel}</span><span class="card-cost">${cost}</span></span>
          <span class="card-name">${card.name}</span>
          <span class="card-desc">${cardDescParts(card)}</span>${mark}`;
}

/** 卡面说明：分组，每组里再切几段短的。
 *  短的才不会被折断，宽的才不会被挤出卡面。 */
function cardDescGroups(card) {
  const g = [];
  if (card.dmg) g.push([`${card.dmg} 伤害${card.hits > 1 ? "×" + card.hits : ""}`]);
  if (card.block) g.push([`格挡 ${card.block}`]);
  if (card.qish) g.push([`气势 +${card.qish}`]);
  if (card.draw) g.push([`抽 ${card.draw} 张`]);
  if (card.pierce) g.push(["破甲"]);
  if (card.counter) g.push([`反伤 ${card.counter}`]);
  if (card.discard) g.push([`弃 ${card.discard} 张`]);
  if (card.reshuffle) g.push(["重洗手牌"]);
  if (card.copyLastAttack) g.push(["复制", "上次攻击"]);
  if (card.skipIntent) g.push([`跳过 ${card.skipIntent} 回合`]);
  if (card.selfDmgNext) g.push(["本回合", `受伤 +${card.selfDmgNext}`]);
  if (card.onTurnStart) {
    const e = card.onTurnStart;
    if (e.qi) g.push(["每回合", `灵气 +${e.qi}`]);
    if (e.qish) g.push(["每回合", `气势 +${e.qish}`]);
    if (e.block) g.push(["每回合", `格挡 +${e.block}`]);
  }
  if (card.bond) g.push(["同名牌", "×2"]);
  return g.length ? g : [["无效果"]];
}

/** 短语之间不断开，组与组之间用间隔点隔开 */
function cardDescParts(card) {
  const out = [];
  cardDescGroups(card).forEach((grp, gi) => {
    if (gi > 0) out.push('<span class="sep">·</span>');
    out.push('<span class="grp">' + grp.map(t => `<span>${t}</span>`).join("") + "</span>");
  });
  return out.join("");
}

/* ---------------- 特效 ---------------- */

function playFx(b, cardId, ehpBefore, qishBefore) {
  const card = CARDS[cardId];
  const layer = $("fx-layer");
  if (!card || !layer) return;
  const foeEl = document.querySelector(".foe");
  const rect = foeEl ? foeEl.getBoundingClientRect() : { left: 300, top: 150, width: 200, height: 80 };
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const isBond = card.bond && b.bonded.includes(cardId);

  // 大招：一剑霜寒
  if (b.log.some(l => l.indexOf("一剑霜寒") >= 0) && b.log.length !== qishLogLen) {
    spawn(layer, "fx-ult", cx, cy - 30, "一剑霜寒");
    wash(layer);
  }
  qishLogLen = b.log.length;

  const dealt = ehpBefore - b.enemyHp;
  if (dealt > 0) {
    spawn(layer, "fx-dmg" + (isBond ? " gold" : ""), cx, cy, "−" + dealt);
    if (foeEl) {
      foeEl.classList.remove("foe-hit");
      void foeEl.offsetWidth;
      foeEl.classList.add("foe-hit");
    }
  }
}
let qishLogLen = 0;

function spawn(layer, cls, x, y, text) {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = text;
  d.style.left = x + "px";
  d.style.top = y + "px";
  layer.appendChild(d);
  setTimeout(() => d.remove(), 1500);
}

function wash(layer) {
  const d = document.createElement("div");
  d.className = "fx-wash";
  layer.appendChild(d);
  setTimeout(() => d.remove(), 600);
}

/* ---------------- 侧栏小件 ---------------- */

/** 侧栏里的一块键值表 */
function railRows(el, title, rows) {
  const sec = document.createElement("section");
  sec.className = "block";
  const h = document.createElement("h2");
  h.className = "block-label";
  h.textContent = title;
  const dl = document.createElement("dl");
  dl.className = "kv-list";
  for (const r of rows) {
    const row = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = r[0];
    const dd = document.createElement("dd");
    if (r[2]) {
      const b = document.createElement("b");
      b.textContent = r[1];
      dd.appendChild(b);
      const s = document.createElement("span");
      s.className = "of";
      s.textContent = r[2];
      dd.appendChild(s);
    } else {
      dd.textContent = r[1];
    }
    row.appendChild(dt);
    row.appendChild(dd);
    dl.appendChild(row);
  }
  sec.appendChild(h);
  sec.appendChild(dl);
  el.appendChild(sec);
}

/** 侧栏里的一块记录 */
function railLog(el, title, lines, emptyText) {
  const sec = document.createElement("section");
  sec.className = "block block-log";
  const h = document.createElement("h2");
  h.className = "block-label";
  h.textContent = title;
  const box = document.createElement("div");
  box.className = "log";
  if (!lines.length) {
    const p = document.createElement("p");
    p.textContent = emptyText;
    box.appendChild(p);
  } else {
    lines.slice(-8).forEach(msg => {
      const p = document.createElement("p");
      p.textContent = msg;
      box.appendChild(p);
    });
  }
  sec.appendChild(h);
  sec.appendChild(box);
  el.appendChild(sec);
}

/** 牌组构成：攻击 / 技能 / 能力各几张 */
function railDeckMix(el) {
  const counts = { attack:0, skill:0, power:0 };
  for (const id of run.deck) { const c = CARDS[id]; if (c) counts[c.type] = (counts[c.type] || 0) + 1; }
  railRows(el, "牌组构成", [
    ["攻击", counts.attack], ["技能", counts.skill], ["能力", counts.power],
  ]);
}

/* ---------------- 异闻（事件） ---------------- */

function renderEvent() {
  const panel = $("event-panel");
  const node = eventNode();
  if (!node) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  $("event-title").textContent = node.event.name;
  $("event-desc").textContent = `血量 ${run.hp}／${run.maxHp}，金币 ${run.gold}。你该如何抉择？`;

  const rail = $("event-rail");
  rail.innerHTML = "";
  railRows(rail, "我方", [
    ["血量", run.hp, "／" + run.maxHp],
    ["金币", run.gold],
    ["遗物", run.relics.length, " 件"],
  ]);
  railDeckMix(rail);
  railLog(rail, "记录", run.log, "刚上路。");

  const opts = $("event-opts");
  opts.innerHTML = "";
  (node.event.opts || []).forEach((opt, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = opt.label;
    const notes = [];
    if (opt.cost && opt.cost.gold) notes.push("−" + opt.cost.gold + " 金");
    if (opt.hp) notes.push("−" + Math.abs(opt.hp) + " 血");
    if (opt.gain && opt.gain.gold) notes.push("+" + opt.gain.gold + " 金");
    if (opt.gain && opt.gain.hp) notes.push("+" + opt.gain.hp + " 血");
    if (opt.gain && opt.gain.relic) notes.push("得遗物");
    if (opt.gain && opt.gain.cards) notes.push("得 " + opt.gain.cards + " 张卡");
    if (opt.gain && opt.gain.qishCap) notes.push("气势上限 +2");
    if (opt.gain && opt.gain.cardChoice) notes.push("选一张卡");
    if (opt.gain && opt.gain.buffNextBattle) notes.push("下一战占先");
    if (notes.length) {
      const n = document.createElement("span");
      n.className = "choice-note";
      n.textContent = notes.join("　");
      btn.appendChild(n);
    }
    btn.onclick = () => {
      const res = RUN.resolveEvent(run, i);
      if (!res.ok) { flash(res.why); return; }
      render();
    };
    li.appendChild(btn);
    opts.appendChild(li);
  });
}

/* ---------------- 战利品 ---------------- */

function renderReward() {
  const panel = $("reward-panel");
  if (!hasReward()) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  const cards = $("reward-cards");
  cards.innerHTML = "";
  for (const cardId of run.rewardCards) {
    const card = CARDS[cardId];
    if (!card) continue;
    const btn = document.createElement("button");
    btn.className = "card " + card.type;
    btn.dataset.card = cardId;
    btn.innerHTML = cardMarkup(null, cardId);
    btn.onclick = () => { RUN.pickRewardCard(run, cardId); render(); };
    cards.appendChild(btn);
  }
  if (run.rewardRelic) {
    const r = RELICS[run.rewardRelic];
    $("reward-relic").textContent = `遗物 · ${r.name}　${r.desc}`;
  } else {
    $("reward-relic").textContent = "";
  }
  const rail = $("reward-rail");
  rail.innerHTML = "";
  railRows(rail, "随身", [
    ["牌组", run.deck.length, " 张"],
    ["遗物", run.relics.length, " 件"],
    ["血量", run.hp, "／" + run.maxHp],
  ]);
  railDeckMix(rail);
  railLog(rail, "记录", run.log, "刚上路。");
}

/* ---------------- 篝火 ---------------- */

function renderCampfire() {
  const panel = $("campfire-panel");
  if (!atFire) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  const canPay = run.gold >= 50;
  const rest = $("btn-campfire");
  const skip = $("btn-campfire-skip");
  rest.disabled = !canPay;
  rest.textContent = canPay ? "歇息（−50 金，+20 血）" : "歇息（还差 " + (50 - run.gold) + " 金）";
  // 钱不够时，别让那颗按不了的按钮占着主位
  rest.classList.toggle("is-primary-now", canPay);
  skip.classList.toggle("is-primary-now", !canPay);
  skip.classList.toggle("primary", !canPay);
  skip.classList.toggle("ghost", canPay);
  // 把代价说清楚：满血时歇息就是白花钱
  const healed = Math.min(20, run.maxHp - run.hp);
  $("fire-note").textContent = canPay
    ? (healed > 0
        ? `火还旺着。歇一会儿能换回 ${healed} 点血量，代价是 50 金币。也可以什么都不做，直接上路。`
        : "火还旺着，但你的血已经满了。歇息只能白花 50 金币，换不回一点血。直接上路更划算。")
    : `火还旺着，可你只有 ${run.gold} 金币，歇息要 50。直接上路吧。`;
  const rail = $("campfire-rail");
  rail.innerHTML = "";
  railRows(rail, "我方", [
    ["血量", run.hp, "／" + run.maxHp],
    ["金币", run.gold],
    ["遗物", run.relics.length, " 件"],
  ]);
  railDeckMix(rail);
  railLog(rail, "记录", run.log, "刚上路。");
}

/* ---------------- 结算 ---------------- */

function renderEnd() {
  const panel = $("end-panel");
  if (run.status === "playing") { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  const win = run.status === "win";
  $("end-title").textContent = win ? "斩开生路" : "妖雾吞噬";
  $("end-desc").textContent = win
    ? `你斩开了妖雾，重见人间。这一趟走过 ${run.nodeIndex} 段路，历经 ${run.battleCount} 场战斗。`
    : `妖雾漫过山门，你倒在第 ${run.nodeIndex + 1} 段路。这一趟历经 ${run.battleCount} 场战斗。下一次，也许能走得更远。`;

  // 这一趟捡到的遗物
  const list = $("end-relics");
  list.innerHTML = "";
  if (!run.relics.length) {
    const li = document.createElement("li");
    const b = document.createElement("b");
    b.textContent = "什么也没有";
    const s = document.createElement("span");
    s.textContent = "这一趟没捡到遗物。";
    li.appendChild(b); li.appendChild(s);
    list.appendChild(li);
  } else {
    for (const id of run.relics) {
      const r = RELICS[id];
      if (!r) continue;
      const li = document.createElement("li");
      const b = document.createElement("b");
      b.textContent = r.name;
      const s = document.createElement("span");
      s.textContent = r.desc;
      li.appendChild(b); li.appendChild(s);
      list.appendChild(li);
    }
  }

  const rail = $("end-rail");
  rail.innerHTML = "";
  railRows(rail, "这一趟", [
    ["走过的路", run.nodeIndex, " 段"],
    ["打过的仗", run.battleCount, " 场"],
    ["遗物", run.relics.length, " 件"],
    ["牌组", run.deck.length, " 张"],
    ["血量", run.hp, "／" + run.maxHp],
  ]);
  railDeckMix(rail);
  railLog(rail, "记录", run.log, "什么也没有发生。");
}

/* ---------------- 日志 ---------------- */

function renderLog() {
  const box = $("battle-log");
  if (!box) return;
  const logs = (run.battle ? run.battle.log : []).concat(run.log.slice(0, 5));
  box.innerHTML = "";
  if (!logs.length) {
    const p = document.createElement("p");
    p.textContent = "尚无战况。";
    box.appendChild(p);
    return;
  }
  logs.slice(-20).forEach(msg => {
    const p = document.createElement("p");
    p.textContent = msg;
    box.appendChild(p);
  });
}

function flash(msg) {
  const box = $("battle-log");
  if (box) {
    const p = document.createElement("p");
    p.className = "log-warn";
    p.textContent = msg;
    box.appendChild(p);
    box.scrollTop = box.scrollHeight;
  }
}

global.YOUYE_UI = { init, render, newGame, _get: () => run, _set: (r) => { run = r; render(); } };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
})(window);
