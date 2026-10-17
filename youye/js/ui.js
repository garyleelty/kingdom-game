// js/ui.js — UI 层（浏览器端），依赖 window.KingdomGame
(function (global) {
"use strict";
const KG = global.KingdomGame;
const CARDS = KG.CARDS;
const RELICS = KG.RELICS;
const ENEMIES = KG.ENEMIES;
const E = KG;
const RUN = KG.run;

const $ = (id) => document.getElementById(id);
let run = null;

function init() {
  $("btn-restart").onclick = () => newGame();
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
    render();
  };
  $("btn-campfire-skip").onclick = () => {
    if (!run) return;
    advanceNode(run);
    render();
  };
  newGame();
}

function newGame() {
  run = RUN.newRun(Math.floor(Math.random() * 100000));
  render();
}

function advanceNode(r) {
  // 前进到下一个节点
  const node = r.map[r.nodeIndex];
  if (node && !node.done) {
    node.done = true;
    r.nodeIndex++;
  }
  if (r.nodeIndex >= r.map.length) r.status = "win";
  // 尝试进入新节点
  if (r.status === "playing") RUN.resolveNode(r);
}

function render() {
  if (!run) return;
  renderTopbar();
  renderMap();
  renderBattle();
  renderEvent();
  renderReward();
  renderEnd();
  renderLog();
}

function renderTopbar() {
  $("hp-display").textContent = `🩸 ${run.hp}/${run.maxHp}`;
  $("gold-display").textContent = `🪙 ${run.gold}`;
  $("node-display").textContent = `节点 ${Math.min(run.nodeIndex + 1, run.map.length)}/${run.map.length}`;
}

function renderMap() {
  const panel = $("map-panel");
  // 战斗中隐藏地图
  if (run.battle || run.status !== "playing") { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  const nodes = $("map-nodes");
  nodes.innerHTML = "";
  run.map.forEach((node, i) => {
    const div = document.createElement("div");
    const cls = ["node"];
    if (node.done) cls.push("done");
    if (i === run.nodeIndex && !node.done) cls.push("current");
    div.className = cls.join(" ");
    const icon = { battle:"⚔️", event:"❓", elite:"💀", boss:"👑" }[node.type] || "❔";
    const label = node.type === "battle" ? "战斗" : node.type === "event" ? "事件" : node.type === "elite" ? "精英" : "Boss";
    const name = node.enemy ? node.enemy.name : node.event ? node.event.name : "";
    div.innerHTML = `<span>${icon} ${label} ${name ? "· " + name : ""}</span>`;
    nodes.appendChild(div);
  });

  // 当前节点操作
  const actions = $("map-actions");
  actions.innerHTML = "";
  const node = run.map[run.nodeIndex];
  if (node && !node.done) {
    if (node.type === "battle" || node.type === "elite" || node.type === "boss") {
      const btn = document.createElement("button");
      btn.className = "primary";
      btn.textContent = node.type === "boss" ? "⚔ 挑战妖王·夜叉" : node.type === "elite" ? "⚔ 挑战精英" : "⚔ 开始战斗";
      btn.onclick = () => { RUN.resolveNode(run); render(); };
      actions.appendChild(btn);
    } else if (node.type === "event") {
      $("map-desc").textContent = "下方处理事件";
    } else {
      // 篝火（非节点，手动触发）
    }
  }
  const desc = $("map-desc");
  if (node && !node.done) {
    desc.textContent = node.type === "event" ? "点击下方按钮处理事件" :
      node.type === "boss" ? "最终决战，胜即通关" :
      node.type === "elite" ? "精英强敌，胜后必得遗物" :
      `遭遇【${node.enemy?.name || ""}】`;
  } else {
    desc.textContent = "";
  }
}

function renderBattle() {
  const panel = $("battle-panel");
  if (!run.battle) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  const b = run.battle;
  $("enemy-name").textContent = b.enemy.name;
  const pct = Math.max(0, Math.min(100, (b.enemyHp / b.enemy.maxHp) * 100));
  $("enemy-hp-fill").style.width = pct + "%";
  $("enemy-hp-text").textContent = `${Math.max(0, b.enemyHp)}/${b.enemy.maxHp}`;
  // 意图（预显示当前意图）
  const intent = E.previewIntent(b);
  $("enemy-intent").textContent = intent ? intentIcon(intent) : "";
  // 玩家状态
  $("energy-num").textContent = b.energy;
  $("qish-num").textContent = `${b.qish}/${b.qishCap}`;
  $("block-num").textContent = b.block;
  $("hp-battle-num").textContent = b.playerHp;
  renderHand(b);
  renderPlayed(b);
  $("btn-end-turn").disabled = b.status !== "playing";
  $("btn-discard").disabled = b.status !== "playing" || b.discardUsed || b.hand.length === 0;
}

function intentIcon(intent) {
  if (intent.dmg) return `⚔ ${intent.dmg}${intent.hits > 1 ? "×" + intent.hits : ""}`;
  if (intent.block) return `🛡 ${intent.block}`;
  if (intent.heal) return `❤ ${intent.heal}`;
  if (intent.mirror) return "🔁 镜反";
  return "❔";
}

/** 本回合已打出区：同名牌连成一体（昆特 Bond 的增强视觉版） */
function renderPlayed(b) {
  const area = $("played-cards");
  if (!area) return;
  area.innerHTML = "";
  const played = b.playedThisTurn || [];
  if (!played.length) return;

  // 按分组渲染：同名牌相邻，中间加连接线
  const groups = [];
  const countMap = {};
  for (const c of played) {
    countMap[c] = (countMap[c] || 0) + 1;
    if (countMap[c] === 1) groups.push({ id: c, count: 1 });
    else groups[groups.length - 1].count++;
  }
  for (let gi = 0; gi < groups.length; gi++) {
    if (gi > 0) {
      const link = document.createElement("div");
      link.className = "bond-link";
      area.appendChild(link);
    }
    const grp = groups[gi];
    const isBonded = grp.count > 1;
    for (let k = 0; k < grp.count; k++) {
      const div = document.createElement("div");
      const cardId = grp.id;
      if (cardId === "__rest__") {
        div.className = "card rest" + (isBonded ? " bonded" : "");
        div.innerHTML = `<div class="cost">0</div><div class="name">调息</div><div class="desc">气势+1</div>`;
      } else {
        const card = CARDS[cardId];
        if (!card) continue;
        div.className = `card ${card.type}` + (isBonded ? " bonded" : "");
        const typeLabel = { attack:"攻", skill:"技", power:"能" }[card.type];
        const desc = cardDesc(card);
        const doubled = isBonded ? "<div class='desc' style='color:var(--qian)'>×2 同名牌连发</div>" : "";
        div.innerHTML = `
          <div class="cost">${E.cardCost(b, cardId)}</div>
          <div class="name">${card.name}</div>
          <div class="desc">${desc}<br><small>${typeLabel}</small></div>
          ${doubled}
        `;
      }
      area.appendChild(div);
    }
  }
}

function renderHand(b) {
  const hand = $("hand");
  hand.innerHTML = "";
  for (const cardId of b.hand) {
    const div = document.createElement("div");
    if (cardId === "__rest__") {
      div.className = "card rest";
      div.innerHTML = `<div class="cost">0</div><div class="name">调息</div><div class="desc">气势+1</div>`;
    } else {
      const card = CARDS[cardId];
      if (!card) continue;
      div.className = `card ${card.type}`;
      const typeLabel = { attack:"攻", skill:"技", power:"能" }[card.type];
      const desc = cardDesc(card);
      div.innerHTML = `
        <div class="cost">${E.cardCost(b, cardId)}</div>
        <div class="name">${card.name}</div>
        <div class="desc">${desc}<br><small>${typeLabel}</small></div>
      `;
    }
    if (b.status === "playing") {
      div.onclick = () => {
        const res = E.playCard(b, cardId);
        if (!res.ok) flash(res.why);
        render();
      };
    }
    hand.appendChild(div);
  }
  if (b.hand.length === 0 && b.status === "playing") {
    const d = document.createElement("div");
    d.style.cssText = "width:100%;text-align:center;color:var(--ink-soft);padding:20px;";
    d.textContent = "手牌已空，请结束回合。";
    hand.appendChild(d);
  }
}

function cardDesc(card) {
  const parts = [];
  if (card.dmg) parts.push(`${card.dmg}伤害${card.hits > 1 ? "×" + card.hits : ""}`);
  if (card.block) parts.push(`格挡${card.block}`);
  if (card.draw) parts.push(`抽${card.draw}`);
  if (card.qish) parts.push(`气势+${card.qish}`);
  if (card.pierce) parts.push("破甲");
  if (card.selfDmgNext) parts.push("本回合受伤+" + card.selfDmgNext);
  if (card.onTurnStart) {
    const e = card.onTurnStart;
    const bits = [];
    if (e.qi) bits.push(`灵气+${e.qi}`);
    if (e.qish) bits.push(`气势+${e.qish}`);
    if (e.block) bits.push(`格挡+${e.block}`);
    if (bits.length) parts.push("每回合 " + bits.join(" "));
  }
  return parts.join("，") || "无效果";
}

function renderEvent() {
  const panel = $("event-panel");
  if (run.battle || run.status !== "playing") { panel.classList.add("hidden"); return; }
  const node = run.map[run.nodeIndex];
  if (!node || node.type !== "event" || node.done) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  $("event-title").textContent = node.event.name;
  $("event-desc").textContent = `（当前：血量 ${run.hp}/${run.maxHp}，金币 ${run.gold}）你该如何抉择？`;
  const opts = $("event-opts");
  opts.innerHTML = "";
  (node.event.opts || []).forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.textContent = opt.label;
    // 显示代价/收益
    const notes = [];
    if (opt.cost && opt.cost.gold) notes.push(`−${opt.cost.gold}金`);
    if (opt.hp) notes.push(`−${opt.hp}血`);
    if (opt.gain && opt.gain.gold) notes.push(`+${opt.gain.gold}金`);
    if (opt.gain && opt.gain.hp) notes.push(`+${opt.gain.hp}血`);
    if (opt.gain && opt.gain.relic) notes.push("得遗物");
    if (opt.gain && opt.gain.cards) notes.push(`得${opt.gain.cards}张卡`);
    if (opt.gain && opt.gain.qishCap) notes.push("气势上限+2");
    if (notes.length) btn.textContent += ` 【${notes.join(" ")}】`;
    btn.onclick = () => {
      const res = RUN.resolveEvent(run, i);
      if (!res.ok) { flash(res.why); return; }
      if (res.dead) { render(); return; }
      render();
    };
    opts.appendChild(btn);
  });
}

function renderReward() {
  const panel = $("reward-panel");
  if (!run.rewardCards.length && !run.rewardRelic) { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  $("reward-title").textContent = "战利品 · 选一张卡加入牌组";
  const cards = $("reward-cards");
  cards.innerHTML = "";
  for (const cardId of run.rewardCards) {
    const card = CARDS[cardId];
    if (!card) continue;
    const div = document.createElement("div");
    div.className = `card ${card.type}`;
    div.innerHTML = `
      <div class="cost">${card.cost}</div>
      <div class="name">${card.name}</div>
      <div class="desc">${cardDesc(card)}</div>
    `;
    div.onclick = () => { RUN.pickRewardCard(run, cardId); render(); };
    cards.appendChild(div);
  }
  if (run.rewardRelic) {
    const r = RELICS[run.rewardRelic];
    $("reward-relic").textContent = `🏺 遗物：${r.name}（${r.desc}）`;
  } else {
    $("reward-relic").textContent = "";
  }
}

function renderEnd() {
  const panel = $("end-panel");
  if (run.status === "playing") { panel.classList.add("hidden"); return; }
  panel.classList.remove("hidden");
  const win = run.status === "win";
  $("end-title").textContent = win ? "🏆 斩开生路" : "💀 妖雾吞噬";
  $("end-title").style.color = win ? "var(--zhu)" : "var(--ink)";
  $("end-desc").textContent = win
    ? `你斩开了妖雾，重见人间。历经 ${run.battleCount} 场战斗，收集 ${run.relics.length} 件遗物，牌组 ${run.deck.length} 张。`
    : `妖雾漫过山门，你倒在最后一夜。历经 ${run.battleCount} 场战斗……但下一次，也许能走得更远。`;
}

function renderLog() {
  const box = $("battle-log");
  if (!box) return;
  const logs = (run.battle ? run.battle.log : []).concat(run.log.slice(0, 5).map(m => "📖 " + m));
  box.innerHTML = "";
  logs.slice(-20).forEach(msg => {
    const d = document.createElement("div");
    d.textContent = msg;
    box.appendChild(d);
  });
}

function flash(msg) {
  const box = $("battle-log");
  if (box) {
    const d = document.createElement("div");
    d.style.color = "var(--zhu)";
    d.textContent = "⚠ " + msg;
    box.appendChild(d);
  }
}

global.YOUYE_UI = { init, render, newGame, _get: () => run, _set: (r) => { run = r; render(); } };

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
})(window);