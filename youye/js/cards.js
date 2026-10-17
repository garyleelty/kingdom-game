// js/cards.js — 数据表（纯数据）
// 同时支持 Node (module.exports) 与浏览器 (window.KingdomGame.CARDS)
(function (global) {
"use strict";

const CARDS = {
  // ---- 基础 12 张 ----
  zhan:      { name:"斩",    type:"attack", cost:1, tier:"base", dmg:6 },
  jizhan:    { name:"疾斩",  type:"attack", cost:1, tier:"base", dmg:4, draw:1 },
  pojun:     { name:"破军",  type:"attack", cost:2, tier:"base", dmg:11 },
  xushi:     { name:"蓄势",  type:"skill",  cost:0, tier:"base", qish:2 },
  shoushi:   { name:"守势",  type:"skill",  cost:1, tier:"base", block:5 },
  yunyin:    { name:"云隐",  type:"skill",  cost:1, tier:"base", block:3, draw:1 },
  huiqi:     { name:"回气",  type:"skill",  cost:1, tier:"base", draw:2 },
  huaying:   { name:"化影",  type:"skill",  cost:2, tier:"base", block:8 },
  duannian:  { name:"断念",  type:"skill",  cost:0, tier:"base", discard:1, draw:2 },
  lingxi:    { name:"灵犀",  type:"power",  cost:2, tier:"base", onTurnStart:{qi:+1} },
  jianyi:    { name:"剑意",  type:"power",  cost:2, tier:"base", onTurnStart:{qish:+1} },
  gushou:    { name:"固守",  type:"power",  cost:1, tier:"base", onTurnStart:{block:+3} },

  // ---- 升级 20 张 ----
  jiangang:    { name:"剑罡",     type:"attack", cost:1, tier:"upgrade", dmg:8, qish:4 },
  sanlianshi:  { name:"三连式",   type:"attack", cost:2, tier:"upgrade", dmg:5, hits:3 },
  xueqi:       { name:"血契",     type:"attack", cost:0, tier:"upgrade", dmg:4, selfDmgNext:2 },
  duanyue:     { name:"断岳",     type:"attack", cost:3, tier:"upgrade", dmg:16, pierce:true },
  jianqi:      { name:"剑气纵横", type:"attack", cost:1, tier:"upgrade", dmg:6, allAttackBonus:6 },
  jieying:     { name:"借影",     type:"skill",  cost:0, tier:"upgrade", copyLastAttack:0.5 },
  pojia:       { name:"破甲",     type:"skill",  cost:1, tier:"upgrade", pierce:true },
  juqi:        { name:"聚气",     type:"skill",  cost:1, tier:"upgrade", qish:4, draw:1 },
  fanshou:     { name:"反手",     type:"skill",  cost:1, tier:"upgrade", block:6, counter:3 },
  xipai:       { name:"洗牌",     type:"skill",  cost:1, tier:"upgrade", reshuffle:true },
  fengyao:     { name:"封妖",     type:"skill",  cost:2, tier:"upgrade", skipIntent:1 },
  yihua:       { name:"移花接木", type:"skill",  cost:2, tier:"upgrade", randomIntent:true },
  yaoqi:       { name:"妖气入体", type:"power",  cost:2, tier:"upgrade", onEnemyTurn:{heal:3} },
  pojunshi:    { name:"破军之势", type:"power",  cost:3, tier:"upgrade", global:{attackDmg:+2} },
  lingmai:     { name:"灵脉",     type:"power",  cost:2, tier:"upgrade", onTurnStart:{draw:+1} },
  wulou:       { name:"无漏",     type:"power",  cost:2, tier:"upgrade", onTurnStart:{block:+5} },
  jiandan:     { name:"剑胆",     type:"power",  cost:1, tier:"upgrade", global:{qishPerAttack:+1} },
  yaoyan:      { name:"妖眼",     type:"power",  cost:2, tier:"upgrade", revealIntent:true },
  jingang:     { name:"金刚身",   type:"power",  cost:3, tier:"upgrade", onEnemyTurn:{reduceDmg:1} },
  dazhao:      { name:"大招强化", type:"power",  cost:3, tier:"upgrade", global:{ultDmg:+6} },
};

const ENEMIES = {
  youhun:  { name:"游魂",  hp:35, intents:[{dmg:8},{dmg:6,drawSelf:1},{heal:5}] },
  yaohou:  { name:"妖猴",  hp:40, intents:[{dmg:9},{dmg:7,stealQi:1}] },
  zhiyuan: { name:"纸鸢妖",hp:38, intents:[{block:6},{dmg:7,blockSelf:4}] },
  shigui:  { name:"石鬼",  hp:52, intents:[{dmg:11},{block:8},{dmg:14,charge:true}] },
  yexiao:  { name:"夜枭",  hp:42, intents:[{dmg:7,hits:2},{dmg:9,stealQish:3}] },
  shenv:   { name:"蛇女",  hp:46, intents:[{dmg:8,poison:4},{block:5,drawSelf:1},{dmg:12}] },
  jingyao: { name:"镜妖",  hp:40, intents:[{mirror:true},{dmg:8},{block:7}] },
  baigu:   { name:"白骨",  hp:48, intents:[{dmg:9,lifesteal:true},{dmg:7,hits:2},{revive:1}] },
};

const ELITES = {
  shanxiao: { name:"山魈",   hp:65, mechanic:"rageEvery4", mechanicDmg:+3, belowPct:0.30, belowDmg:14 },
  shenlou:  { name:"蜃楼主", hp:62, mechanic:"copyLastCard", belowPct:0.40, doubleIntent:true },
};

const BOSS = {
  name:"妖王·夜叉",
  phase1:{ hp:110,
    intents:[{dmg:10},{dmg:8,drawSelf:2},{block:9,stealQish:3}],
    everyNTurn:3, specialDmg:16 },
  phase2:{ pct:0.45,
    intents:[{dmg:14},{dmg:6,hits:3},{block:11,clearQish:true}],
    everyNTurn:2, specialDmg:20 },
};

const RELICS = {
  tongqian:    { name:"铜钱串",   desc:"每场战斗开局+5金币",          effect:{goldOnStart:+5} },
  duanjian:    { name:"断剑穗",   desc:"攻击牌气势+1",                effect:{qishPerAttack:+1} },
  luopan:      { name:"罗盘碎片", desc:"每3回合抽1张额外牌",          effect:{extraDrawEvery:3} },
  jiudeng:     { name:"旧灯笼",   desc:"第一场战斗敌人伤害-3",        effect:{firstBattleReduce:3} },
  fuzhi:       { name:"符纸囊",   desc:"战斗胜利后回5血",             effect:{healAfterBattle:5} },
  banjuan:     { name:"半卷妖经", desc:"能力牌费用-1(最低0)",         effect:{powerCost:1} },
  yexing:      { name:"夜行披风", desc:"每回合首张格挡牌效果+2",      effect:{firstBlock:2} },
  poshan:      { name:"破山令",   desc:"大招伤害12→16",               effect:{ultDmg:16} },
};

const EVENTS = {
  wumian:  { name:"荒庙遇无面人", opts:[
      { label:"献上1金币", cost:{gold:1}, gain:{relic:true} },
      { label:"摇头拒绝", },
      { label:"拔剑相向", hp:-8, gain:{gold:15} } ] },
  gujing:  { name:"夜雨古井", opts:[
      { label:"下井一探", hp:-10, gain:{cards:2} },
      { label:"路过", },
      { label:"投石问路", gain:{gold:10} } ] },
  chaopeng:{ name:"茶棚老妪", opts:[
      { label:"喝茶", cost:{gold:15}, gain:{hp:15} },
      { label:"拒绝", },
      { label:"付30金求符", cost:{gold:30}, gain:{relic:"jiudeng"} } ] },
  shangren:{ name:"夜行商人", opts:[
      { label:"买断剑穗", cost:{gold:25}, gain:{relic:"duanjian"} },
      { label:"只买一张卡", cost:{gold:20}, gain:{cardChoice:1} },
      { label:"离开", } ] },
  haitong: { name:"迷路的孩童", opts:[
      { label:"护送他回家", gain:{buffNextBattle:{reduceDmg:3}} },
      { label:"给10金让他走", cost:{gold:10} },
      { label:"无视", hp:-3, gain:{buffNextBattle:{qishStart:2}} } ] },
  bewen:   { name:"古祠碑文", opts:[
      { label:"参拜", gain:{qishCap:8} },
      { label:"拓印", gain:{relic:"banjuan"} },
      { label:"转身离开", } ] },
};

const exports_ = { CARDS, ENEMIES, ELITES, BOSS, RELICS, EVENTS };

if (typeof module !== "undefined" && module.exports) module.exports = exports_;
if (typeof global !== "undefined") {
  global.KingdomGame = global.KingdomGame || {};
  global.KingdomGame.CARDS = CARDS;
  global.KingdomGame.ENEMIES = ENEMIES;
  global.KingdomGame.ELITES = ELITES;
  global.KingdomGame.BOSS = BOSS;
  global.KingdomGame.RELICS = RELICS;
  global.KingdomGame.EVENTS = EVENTS;
}
})(typeof globalThis !== "undefined" ? globalThis : this);