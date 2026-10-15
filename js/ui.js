/**
 * 边塞王国 · UI 层
 * 只负责渲染与事件绑定，所有规则来自 KingdomGame（js/game.js）。
 */
(function () {
  "use strict";
  const G = window.KingdomGame;
  const $ = (id) => document.getElementById(id);

  let state = G.newState(Date.now() % 100000);

  /* ---------- 渲染 ---------- */

  function render() {
    const s = state;
    $("turn-label").textContent = `第 ${s.turn} / ${s.totalTurns} 季`;
    const threat = G.raiderThreat(s);
    $("threat-label").textContent = threat > 0 ? `⚠️ 马匪威胁 ${threat}（我方 ${G.totalDefense(s)}）` : "";
    $("threat-label").style.color = G.totalDefense(s) < threat ? "var(--red)" : "var(--dim)";

    const inc = G.income(s, s.tax);
    $("r-gold").textContent = Math.floor(s.gold);
    $("r-food").textContent = Math.floor(s.food);
    $("r-wood").textContent = Math.floor(s.wood);
    $("r-stone").textContent = Math.floor(s.stone);
    $("r-pop").textContent = `${s.pop} / ${G.popCap(s)}`;
    $("r-army").textContent = s.army;
    $("r-def").textContent = G.totalDefense(s);
    $("r-net").textContent = `${G.fmtDelta(inc.gold)} / ${G.fmtDelta(inc.food)}`;

    const lb = $("loyalty-bar");
    lb.style.width = clampPct(s.loyalty) + "%";
    lb.style.background = s.loyalty >= 60 ? "var(--green)" : s.loyalty >= 30 ? "var(--gold)" : "var(--red)";
    $("loyalty-val").textContent = Math.round(s.loyalty);
    $("loyalty-hint").textContent =
      s.loyalty >= 70 ? "民心归附，人口将持续增长。" :
      s.loyalty >= 50 ? "尚可，人口有增长。" :
      s.loyalty >= 30 ? "怨气渐生，需留意税制与庆典。" :
      "濒临暴动！忠诚归零即亡国。";

    renderTax();
    renderTrade();
    renderBuild();
    renderEvent();
    renderLog();

    const over = s.status !== "playing";
    $("btn-end-turn").disabled = over;
    $("btn-feast").disabled = over || s.gold < 50;
    $("btn-recruit").disabled = over || s.gold < 30 || s.pop < 5;

    if (over) showOverlay(); else hideOverlay();
  }

  function clampPct(v) { return Math.max(0, Math.min(100, v)); }

  function renderTax() {
    const box = $("tax-btns");
    if (!box.dataset.init) {
      G.TAX_LEVELS.forEach((t) => {
        const b = document.createElement("button");
        b.textContent = t.name;
        b.dataset.key = t.key;
        b.onclick = () => { G.setTax(state, t.key); render(); };
        box.appendChild(b);
      });
      box.dataset.init = "1";
    }
    [...box.children].forEach((b) => b.classList.toggle("active", b.dataset.key === state.tax));
    const t = G.TAX_LEVELS.find((x) => x.key === state.tax);
    $("tax-hint").textContent = `${t.name}：税收 ×${t.goldMul}，每季忠诚 ${G.fmtDelta(t.loyaltyDelta)}`;
  }

  function renderTrade() {
    const box = $("trade-btns");
    $("trade-left").textContent = `本季余 ${state.tradeLeft} 单`;
    if (!box.dataset.init) {
      for (const res of Object.keys(G.TRADE)) {
        const t = G.TRADE[res];
        const buy = document.createElement("button");
        buy.textContent = `买${t.name} ${t.lot}`;
        buy.dataset.dir = "buy"; buy.dataset.res = res;
        buy.onclick = () => { const r = G.trade(state, "buy", res); if (!r.ok) flash(r.why); render(); };
        const sell = document.createElement("button");
        sell.textContent = `卖${t.name} ${t.lot}`;
        sell.dataset.dir = "sell"; sell.dataset.res = res;
        sell.onclick = () => { const r = G.trade(state, "sell", res); if (!r.ok) flash(r.why); render(); };
        box.append(buy, sell);
      }
      box.dataset.init = "1";
    }
    const over = state.status !== "playing";
    [...box.children].forEach((b) => {
      const t = G.TRADE[b.dataset.res];
      if (b.dataset.dir === "buy") b.disabled = over || state.tradeLeft <= 0 || state.gold < t.lot * t.buyRate;
      else b.disabled = over || state.tradeLeft <= 0 || state[b.dataset.res] < t.lot;
    });
  }

  function costHtml(cost) {
    const map = { gold: "🪙", wood: "🪵", stone: "🪨", food: "🌾" };
    return Object.entries(cost)
      .map(([k, v]) => {
        const lack = state[k] < v ? "lack" : "";
        return `<span class="${lack}">${map[k]}${v}</span>`;
      })
      .join(" ");
  }

  function renderBuild() {
    const list = $("build-list");
    list.innerHTML = "";
    for (const [id, def] of Object.entries(G.BUILDINGS)) {
      const owned = state.buildings[id] || 0;
      const afford = G.canAfford(state, def.cost);
      const card = document.createElement("div");
      card.className = "bcard" + (afford ? "" : " locked") + (def.wonder ? " wonder-card" : "");
      card.innerHTML = `
        <div><span class="bname">${def.name}</span> <span class="bcount">×${owned}</span></div>
        <div class="bdesc">${def.desc}</div>
        <div class="bcost">${costHtml(def.cost)}</div>`;
      if (afford && state.status === "playing") {
        card.onclick = () => {
          const r = G.build(state, id);
          if (!r.ok) flash(r.why);
          render();
        };
      }
      list.appendChild(card);
    }
  }

  function renderEvent() {
    const box = $("event-box");
    if (!state.lastEvent) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden");
    $("event-text").textContent = state.lastEvent.text;
    $("event-extra").textContent = state.lastEvent.extra || "";
  }

  function renderLog() {
    const ul = $("log-list");
    ul.innerHTML = "";
    for (const item of state.log) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="t">S${item.turn}</span>${escapeHtml(item.msg)}`;
      ul.appendChild(li);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function flash(msg) {
    const box = $("event-box");
    box.classList.remove("hidden");
    $("event-text").textContent = "⚠ " + msg;
    $("event-extra").textContent = "";
  }

  function showOverlay() {
    const win = state.status === "win";
    $("overlay").classList.remove("hidden");
    $("overlay-title").textContent = win ? "🏆 王国长存" : "💀 王朝倾覆";
    $("overlay-title").style.color = win ? "var(--gold)" : "var(--red)";
    $("overlay-reason").textContent =
      state.endReason + ` （历经 ${state.turn} 季，人口 ${state.pop}，忠诚 ${Math.round(state.loyalty)}）`;
  }
  function hideOverlay() { $("overlay").classList.add("hidden"); }

  /* ---------- 绑定 ---------- */

  $("btn-end-turn").onclick = () => { G.endTurn(state); render(); };
  $("btn-feast").onclick = () => { const r = G.feast(state); if (!r.ok) flash(r.why); render(); };
  $("btn-recruit").onclick = () => { const r = G.recruit(state); if (!r.ok) flash(r.why); render(); };
  $("btn-restart").onclick = () => restart();
  $("overlay-again").onclick = () => restart();

  function restart() {
    state = G.newState(Date.now() % 100000);
    render();
  }

  render();
})();
