/* ============================================================
   北极星学习屋 · 趣味层 fun.js（全站共享）
   绿鳄王养成 + 音效 + 连击 + 卡牌收集 + 成就 + 彩蛋
   铁律：只包在各页面核心逻辑外面，不碰出题/判题/计分/进度 key。
   绿鳄王是阿宝的伙伴：练一次喂一次，它长大进化。
   用法：<script src="fun.js?v=1021h"></script>
   ============================================================ */
(function () {
  if (window.PS) return;

  var ENERGY_KEY = 'polestar-lvw-v1';   /* { e:能量, seen:已展示过的阶段 } */
  var CARD_KEY   = 'polestar-cards-v1'; /* { 卡id: 收到的时间戳 } */
  var ACH_KEY    = 'polestar-ach-v1';   /* { 成就id: 时间戳 } */
  var DAY_KEY    = 'polestar-days-v1';  /* { days: ['2026-10-23', ...] } */

  /* ---- 绿鳄王四阶段（🥚 蛋 → 🐊 小鳄鱼 → 👑🐊 绿鳄王 → 🤖 机器鳄鱼王） ---- */
  var STAGES = [
    { min: 0,  emoji: '🥚',    name: '神秘蛋',     feed: '练 4 局就能孵化' },
    { min: 4,  emoji: '🐊',    name: '小鳄鱼',     feed: '再练 8 局长成绿鳄王' },
    { min: 12, emoji: '👑🐊',  name: '绿鳄王',     feed: '再练 13 局进化机器鳄鱼王' },
    { min: 25, emoji: '🤖🐊',  name: '机器鳄鱼王', feed: '已经会喷火啦，记得天天喂它' }
  ];
  function stageIdx(e){
    var s = 0;
    for (var i = 0; i < STAGES.length; i++) if (e >= STAGES[i].min) s = i;
    return s;
  }

  /* ---- 卡池：宝可梦 / 水浒好汉 / 昆虫（emoji + 名字，不引入真图片） ---- */
  var SETS = [
    { id: 'pokemon', name: '宝可梦', cards: [
      { id: 'greninja',   e: '🥷', n: '甲贺忍蛙' },
      { id: 'snorlax',    e: '🐻', n: '卡比兽' },
      { id: 'grimmsnarl', e: '🧌', n: '长毛巨魔' }
    ]},
    { id: 'shuihu', name: '水浒好汉', cards: [
      { id: 'songjiang', e: '🎖️', n: '宋江' },
      { id: 'linchong',  e: '🐯', n: '林冲' },
      { id: 'wusong',    e: '🐆', n: '武松' },
      { id: 'likui',     e: '🪓', n: '李逵' }
    ]},
    { id: 'insect', name: '昆虫', cards: [
      { id: 'ps-mantis',    e: '🦗', n: '螳螂' },
      { id: 'ps-beetle',    e: '🪲', n: '独角仙' },
      { id: 'ps-bee',       e: '🐝', n: '蜜蜂' },
      { id: 'ps-butterfly', e: '🦋', n: '蝴蝶' }
    ]}
  ];
  var ALL_CARDS = [];
  SETS.forEach(function (s) {
    s.cards.forEach(function (c) { c.set = s.id; c.setName = s.name; ALL_CARDS.push(c); });
  });

  /* ---- 成就（全站一套） ---- */
  var ACHS = {
    first_perfect: { i: '🌟', n: '第一次全对',   d: '一局一道都没错' },
    combo10:       { i: '🔥', n: '十连击',       d: '连续答对 10 题' },
    combo20:       { i: '💥', n: '二十连击',     d: '连续答对 20 题' },
    streak3:       { i: '📅', n: '坚持小达人',   d: '连续 3 天练习' },
    cardset1:      { i: '🎴', n: '集卡高手',     d: '集齐一整套卡' },
    evolve1:       { i: '🐣', n: '破壳而出',     d: '绿鳄王孵化啦' },
    evolve2:       { i: '👑', n: '加冕绿鳄王',   d: '养成真正的绿鳄王' },
    evolve3:       { i: '🤖', n: '机器鳄鱼王',   d: '进化到最终形态' }
  };

  /* ================= 存储 ================= */
  function rd(k){ try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } }
  function wr(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function energy(){ return rd(ENERGY_KEY).e || 0; }

  /* ================= 音效（Web Audio 合成，离线可用） ================= */
  var actx = null;
  function ensureAudio(){
    try {
      if (!actx) { var AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); }
      if (actx && actx.state === 'suspended') actx.resume();
    } catch (e) {}
  }
  function beep(freq, dur, type, delay, vol){
    if (!actx) return;
    try {
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      var t = actx.currentTime + (delay || 0);
      g.gain.setValueAtTime(0.001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }
  /* 连击越高音调越高：每连击升一个半音，最多升一个八度 */
  function pitch(combo){ return Math.pow(2, Math.min(Math.max((combo || 1) - 1, 0), 12) / 12); }
  function sndRight(combo){
    var m = pitch(combo);
    beep(523 * m, .12, 'sine', 0); beep(659 * m, .12, 'sine', .1); beep(784 * m, .18, 'sine', .2);
  }
  function sndWrong(){ beep(320, .15, 'triangle', 0); beep(240, .2, 'triangle', .12); }
  function sndWin(){ [523, 659, 784, 1047].forEach(function (f, i){ beep(f, .2, 'sine', i * .13); }); }
  /* 解锁音效：咔嚓（两个短促波）+ 上扬号角 */
  function sndUnlock(){
    beep(1400, .04, 'square', 0, .09);
    beep(900, .06, 'sawtooth', .05, .07);
    beep(523, .14, 'sine', .16); beep(659, .14, 'sine', .28);
    beep(784, .26, 'sine', .40); beep(1047, .4, 'sine', .54);
  }
  function sndCard(){ beep(660, .1, 'sine', 0); beep(880, .14, 'sine', .09); }

  /* ================= 样式（一次性注入，全部 ps- 前缀） ================= */
  var CSS = ''
    + '.ps-toast{position:fixed;top:18px;left:50%;transform:translateX(-50%) translateY(-16px);'
    + 'background:#2F7D52;color:#FFFDFA;font-weight:900;font-size:16px;padding:9px 20px;'
    + 'border-radius:999px;opacity:0;pointer-events:none;z-index:120;'
    + 'box-shadow:0 6px 18px rgba(30,43,34,.25);transition:opacity .25s,transform .25s;max-width:88vw;text-align:center}'
    + '.ps-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}'
    + '.ps-ov{position:fixed;inset:0;background:rgba(30,43,34,.5);z-index:130;display:flex;'
    + 'align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity .25s}'
    + '.ps-ov.show{opacity:1}'
    + '.ps-pop{background:#FFFDFA;border-radius:24px;padding:26px 22px;text-align:center;max-width:320px;width:100%;'
    + 'box-shadow:0 20px 50px rgba(0,0,0,.35);animation:psIn .4s cubic-bezier(.2,1.2,.4,1) both}'
    + '@keyframes psIn{from{transform:scale(.7) translateY(26px);opacity:0}to{transform:none;opacity:1}}'
    + '.ps-pop .pi{font-size:56px;line-height:1.15}'
    + '.ps-pop .pt{font-size:13px;color:#2F7D52;font-weight:900;letter-spacing:2px;margin-top:8px}'
    + '.ps-pop .pn{font-size:22px;font-weight:900;color:#1E2B22;margin-top:2px}'
    + '.ps-pop .pd{font-size:14px;color:#5F584C;margin-top:8px;line-height:1.6}'
    + '.ps-pop .ps-okbtn{display:inline-flex;align-items:center;justify-content:center;margin-top:16px;'
    + 'min-height:46px;padding:10px 30px;border:none;border-radius:12px;background:#2F7D52;color:#FFFDFA;'
    + 'font-size:15px;font-weight:800;font-family:inherit}'
    + '/* 进化庆祝 */'
    + '.ps-evolve .pi{font-size:88px;animation:psEvoShake .6s ease both,psEvoGrow .6s ease both}'
    + '@keyframes psEvoShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}'
    + '40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}'
    + '@keyframes psEvoGrow{from{transform:scale(.2)}to{transform:scale(1)}}'
    + '.ps-flash{position:fixed;inset:0;background:radial-gradient(circle,#FFF8DC 0%,#FFD70033 45%,transparent 75%);'
    + 'z-index:129;pointer-events:none;animation:psFlash 1s ease both}'
    + '@keyframes psFlash{0%{opacity:0}25%{opacity:1}100%{opacity:0}}'
    + '/* 掉卡 */'
    + '.ps-cardpop .pi{font-size:72px;animation:psCardIn .55s cubic-bezier(.2,1.4,.4,1) both}'
    + '@keyframes psCardIn{from{transform:scale(.1) rotate(-24deg);opacity:0}to{transform:scale(1) rotate(0);opacity:1}}'
    + '.ps-cardtag{display:inline-block;background:#A24E22;color:#FFFDFA;font-size:12px;font-weight:800;'
    + 'border-radius:999px;padding:3px 12px;margin-top:10px;letter-spacing:1px}'
    + '/* 掉卡（非遮挡：飞入后自动消失，不挡点击） */'
    + '.ps-drop{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:126;'
    + 'background:#FFFDFA;border:2px solid #E4DCD0;border-radius:16px;padding:10px 18px;'
    + 'display:flex;align-items:center;gap:10px;box-shadow:0 10px 26px rgba(30,43,34,.22);'
    + 'pointer-events:none;max-width:88vw;'
    + 'animation:psDropIn .5s cubic-bezier(.2,1.3,.4,1) both,psDropOut .45s ease 1.5s both}'
    + '.ps-drop .de{font-size:34px;line-height:1;flex:0 0 auto}'
    + '.ps-drop .dn{font-size:14px;font-weight:900;color:#1E2B22;white-space:nowrap}'
    + '.ps-drop .dt{font-size:11px;color:#A24E22;font-weight:800;white-space:nowrap}'
    + '@keyframes psDropIn{from{transform:translateX(-50%) translateY(60px) scale(.6);opacity:0}'
    + 'to{transform:translateX(-50%) translateY(0) scale(1);opacity:1}}'
    + '@keyframes psDropOut{to{transform:translateX(-50%) translateY(20px);opacity:0}}'
    + '/* 彩蛋 emoji */'
    + '.ps-egg{position:fixed;bottom:26%;font-size:40px;z-index:125;pointer-events:none;'
    + 'animation:psEggUp 1.4s ease-in both}'
    + '@keyframes psEggUp{0%{transform:translateY(0) scale(.6);opacity:0}'
    + '20%{opacity:1}100%{transform:translateY(-140px) scale(1.25) rotate(14deg);opacity:0}}'
    + '/* 首页宠物卡 */'
    + '.ps-petcard{display:flex;align-items:center;gap:14px;background:#FFFDFA;border:1.5px solid #E4DCD0;'
    + 'border-radius:20px;padding:14px 16px;margin:0 0 var(--s4,16px);box-shadow:0 4px 14px rgba(30,43,34,.07)}'
    + '.ps-pet{border:none;background:rgba(47,125,82,.08);border-radius:16px;width:64px;height:64px;'
    + 'font-size:36px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;'
    + 'font-family:inherit;transition:transform .15s;padding:0;flex:0 0 auto}'
    + '.ps-pet:active{transform:scale(.92)}'
    + '.ps-pet.wiggle{animation:psWiggle .5s ease}'
    + '@keyframes psWiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg) scale(1.08)}'
    + '50%{transform:rotate(8deg) scale(1.08)}75%{transform:rotate(-4deg)}}'
    + '.ps-petinfo{flex:1;min-width:0}'
    + '.ps-petname{font-size:15.5px;font-weight:900;color:#1E2B22;display:flex;align-items:center;gap:8px;flex-wrap:wrap}'
    + '.ps-streak{font-size:11.5px;font-weight:800;color:#A24E22;background:rgba(162,78,34,.09);'
    + 'border-radius:999px;padding:2px 9px;white-space:nowrap}'
    + '.ps-ebar{height:10px;background:#EFE9DE;border-radius:99px;overflow:hidden;margin-top:8px}'
    + '.ps-ebar i{display:block;height:100%;background:linear-gradient(90deg,#2F7D52,#58C984);'
    + 'border-radius:99px;transition:width .5s}'
    + '.ps-petnext{font-size:12px;color:#6B6459;margin-top:6px;font-weight:600}'
    + '.ps-petnext b{color:#1D5C39}'
    + '.ps-collbtn{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;'
    + 'min-height:50px;border-radius:12px;border:2px solid #2F7D52;background:#FFFDFA;color:#2F7D52;'
    + 'font-family:inherit;font-size:15px;font-weight:800;cursor:pointer;margin-bottom:var(--s4,16px);'
    + 'transition:transform .15s}'
    + '.ps-collbtn:active{transform:scale(.975)}'
    + '.ps-coll{background:#FFFDFA;border:1.5px solid #E4DCD0;border-radius:20px;padding:16px;'
    + 'margin-bottom:var(--s4,16px)}'
    + '.ps-setname{font-size:13px;font-weight:900;color:#5F584C;letter-spacing:1px;margin:12px 0 8px}'
    + '.ps-setname:first-child{margin-top:0}'
    + '.ps-setname .ok{color:#2F7D52}'
    + '.ps-cgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}'
    + '.ps-citem{background:#FAF7F2;border-radius:10px;padding:10px 6px;text-align:center;min-width:0}'
    + '.ps-citem .ce{font-size:30px;line-height:1.2}'
    + '.ps-citem .cn{font-size:12px;font-weight:800;color:#1E2B22;margin-top:4px}'
    + '.ps-citem.locked .ce{filter:grayscale(1);opacity:.35}'
    + '.ps-citem.locked .cn{color:#6B6459;opacity:.7}'
    + '.ps-achrow{display:flex;align-items:center;gap:10px;padding:8px 0;border-top:1px solid #E4DCD0;'
    + 'font-size:13.5px;color:#1E2B22}'
    + '.ps-achrow:first-of-type{border-top:none}'
    + '.ps-achrow .ai{font-size:22px;flex:0 0 auto}'
    + '.ps-achrow.locked{opacity:.45}'
    + '.ps-achrow b{font-weight:800}'
    + '.ps-achrow small{display:block;font-size:12px;color:#6B6459;margin-top:1px}'
    /* ===== 详情弹层（宠物养成详情 / 卡片详情） ===== */
    + '.ps-detail{position:fixed;inset:0;background:rgba(30,43,34,.55);z-index:140;'
    + 'display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .25s}'
    + '.ps-detail.show{opacity:1}'
    + '.ps-dbox{background:#FFFDFA;border-radius:24px;padding:22px 18px;max-width:360px;width:100%;'
    + 'max-height:86vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,.35);'
    + 'animation:psIn .35s cubic-bezier(.2,1.2,.4,1) both;-webkit-overflow-scrolling:touch}'
    + '.ps-big{font-size:92px;line-height:1.25;text-align:center;cursor:pointer;'
    + '-webkit-user-select:none;user-select:none;animation:psIdle 2.6s ease-in-out infinite}'
    + '@keyframes psIdle{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(2deg)}}'
    + '.ps-big.hop{animation:psHop .45s ease}'
    + '@keyframes psHop{0%{transform:scale(1)}35%{transform:scale(1.18) rotate(-7deg)}70%{transform:scale(.94)}100%{transform:scale(1)}}'
    + '.ps-tl{margin-top:4px}'
    + '.ps-tlrow{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;'
    + 'background:#FAF7F2;margin-bottom:8px;animation:psSlide .45s ease both}'
    + '@keyframes psSlide{from{transform:translateX(-22px)}to{transform:none}}'
    + '.ps-tlrow .te{font-size:32px;flex:0 0 auto;min-width:40px;text-align:center}'
    + '.ps-tlrow.locked .te{filter:grayscale(1);opacity:.4}'
    + '.ps-tlrow .tn{font-size:15px;font-weight:900;color:#1E2B22}'
    + '.ps-tlrow .td{font-size:12px;color:#6B6459;margin-top:2px}'
    + '.ps-tlrow.now{background:rgba(47,125,82,.10);box-shadow:inset 0 0 0 2px #2F7D52}'
    + '.ps-nowtag{display:inline-block;font-size:10.5px;font-weight:900;color:#FFFDFA;'
    + 'background:#2F7D52;border-radius:999px;padding:1px 8px;margin-left:6px;vertical-align:2px}'
    + '.ps-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px}'
    + '.ps-stat{background:#FAF7F2;border-radius:12px;padding:10px 4px;text-align:center;min-width:0}'
    + '.ps-stat b{font-size:22px;font-weight:900;color:#1D5C39;display:block;line-height:1.2}'
    + '.ps-stat span{font-size:11.5px;color:#6B6459}'
    + '.ps-feedrow{display:flex;justify-content:space-between;align-items:center;font-size:13.5px;'
    + 'padding:8px 2px;border-bottom:1px solid #EFE9DE;color:#1E2B22;font-weight:700}'
    + '.ps-feedrow small{color:#6B6459;font-weight:600}'
    + '.ps-cbig{font-size:80px;text-align:center;line-height:1.25;'
    + 'animation:psFlipIn .5s ease both;-webkit-user-select:none;user-select:none}'
    + '@keyframes psFlipIn{from{transform:rotateY(90deg) scale(.7);opacity:0}to{transform:rotateY(0) scale(1);opacity:1}}'
    + '.ps-cname{text-align:center;font-size:20px;font-weight:900;color:#1E2B22;margin-top:6px}'
    + '.ps-cset{text-align:center;font-size:12.5px;color:#A24E22;font-weight:800;margin-top:4px}'
    + '.ps-cbar{height:8px;background:#EFE9DE;border-radius:99px;overflow:hidden;margin-top:12px}'
    + '.ps-cbar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#A24E22,#E8834A);'
    + 'border-radius:99px;transition:width .6s ease}'
    + '.ps-cdate{text-align:center;font-size:12px;color:#6B6459;margin-top:10px;line-height:1.6}'
    + '.ps-x{display:flex;align-items:center;justify-content:center;margin:18px auto 0;'
    + 'min-height:46px;padding:10px 34px;border:none;border-radius:12px;background:#2F7D52;'
    + 'color:#FFFDFA;font-size:15px;font-weight:800;font-family:inherit;cursor:pointer;transition:transform .15s}'
    + '.ps-x:active{transform:scale(.95)}'
    /* ===== iPad 大屏增强 ===== */
    + '@media (min-width:768px){'
    + '.ps-dbox{max-width:440px;padding:26px 24px}'
    + '.ps-big{font-size:110px}'
    + '.ps-cbig{font-size:96px}'
    + '.ps-pet{width:76px;height:76px;font-size:44px;border-radius:18px}'
    + '.ps-petcard{padding:16px 20px;border-radius:22px}'
    + '.ps-petname{font-size:17px}'
    + '.ps-petnext{font-size:13px}'
    + '.ps-collbtn{min-height:56px;font-size:16.5px}'
    + '.ps-cgrid{grid-template-columns:repeat(4,1fr)}'
    + '.ps-citem .ce{font-size:36px}'
    + '.ps-drop{bottom:110px;padding:12px 22px}'
    + '.ps-drop .de{font-size:40px}'
    + '.ps-drop .dn{font-size:16px}'
    + '.ps-drop .dt{font-size:12.5px}'
    + '.ps-x{min-height:52px;font-size:16px}'
    + '.ps-tlrow .te{font-size:38px}'
    + '.ps-stat b{font-size:26px}'
    + '}';
  var stEl = document.createElement('style');
  stEl.id = 'ps-fun-style';
  stEl.textContent = CSS;
  document.head.appendChild(stEl);

  /* ================= 通用小组件 ================= */
  function el(id){ return document.getElementById(id); }

  var toastH = null;
  function toast(msg){
    var t = el('psToast');
    if (!t) { t = document.createElement('div'); t.id = 'psToast'; t.className = 'ps-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'ps-toast show';
    clearTimeout(toastH);
    toastH = setTimeout(function(){ t.className = 'ps-toast'; }, 1100);
  }

  /* 弹窗队列（成就/掉卡/进化共用一个队列，一次弹一个） */
  var popQ = [], popShowing = false;
  function queuePop(opt){ /* {mode:'ach'|'card'|'evolve', icon, tag, name, desc, sound} */
    popQ.push(opt);
    showNextPop();
  }
  function showNextPop(){
    if (popShowing) return;
    var o = popQ.shift();
    if (!o) return;
    popShowing = true;
    var ov = el('psOv');
    if (!ov) { ov = document.createElement('div'); ov.id = 'psOv'; ov.className = 'ps-ov'; document.body.appendChild(ov); }
    if (o.mode === 'evolve') {
      var fl = document.createElement('div');
      fl.className = 'ps-flash';
      document.body.appendChild(fl);
      setTimeout(function(){ if (fl.parentNode) fl.parentNode.removeChild(fl); }, 1100);
    }
    ov.className = 'ps-ov show' + (o.mode === 'evolve' ? ' ps-evolve' : (o.mode === 'card' ? ' ps-cardpop' : ''));
    ov.innerHTML = '<div class="ps-pop">'
      + '<div class="pi">' + o.icon + '</div>'
      + (o.tag ? '<div class="ps-cardtag">' + o.tag + '</div>' : '<div class="pt">' + o.tagText + '</div>')
      + '<div class="pn">' + o.name + '</div>'
      + '<div class="pd">' + o.desc + '</div>'
      + '<button type="button" class="ps-okbtn" id="psOkBtn">' + (o.btn || '太棒了') + '</button></div>';
    if (o.sound === 'unlock') sndUnlock(); else if (o.sound === 'card') sndCard();
    var done = function(){
      ov.className = 'ps-ov'; ov.innerHTML = '';
      popShowing = false;
      setTimeout(showNextPop, 200);
    };
    el('psOkBtn').onclick = done;
    /* 防止卡住：4 秒后自动收起 */
    setTimeout(function(){ if (popShowing && el('psOkBtn')) done(); }, 4000);
  }

  /* 彩蛋：答对时偶尔蹦出一个小 emoji */
  var EGGS = ['⭐', '✨', '🎉', '🍬', '🦄', '🐉', '⚡', '🌟'];
  function egg(){
    var d = document.createElement('div');
    d.className = 'ps-egg';
    d.textContent = EGGS[Math.floor(Math.random() * EGGS.length)];
    d.style.left = (8 + Math.random() * 70) + 'vw';
    document.body.appendChild(d);
    setTimeout(function(){ if (d.parentNode) d.parentNode.removeChild(d); }, 1500);
  }

  /* ================= 卡牌 ================= */
  /* 掉卡提示：非遮挡小卡片，飞入后 1.5s 自动淡出，不挡任何点击（限时模式也不受影响） */
  function showDrop(c){
    var d = document.createElement('div');
    d.className = 'ps-drop';
    d.innerHTML = '<span class="de">' + c.e + '</span>'
      + '<span><span class="dn">' + c.n + '</span><br>'
      + '<span class="dt">🎴 ' + c.setName + '系列 · 已收进卡册</span></span>';
    document.body.appendChild(d);
    sndCard();
    setTimeout(function(){ if (d.parentNode) d.parentNode.removeChild(d); }, 2100);
  }
  function dropCard(){
    try {
      if (Math.random() >= 0.2) return;
      var owned = rd(CARD_KEY);
      var pool = ALL_CARDS.filter(function (c){ return !owned[c.id]; });
      if (!pool.length) return;
      var c = pool[Math.floor(Math.random() * pool.length)];
      owned[c.id] = Date.now();
      wr(CARD_KEY, owned);
      setTimeout(function(){ showDrop(c); }, 450);
      /* 集齐一套？ */
      for (var i = 0; i < SETS.length; i++) {
        var s = SETS[i];
        if (s.id !== c.set) continue;
        var full = s.cards.every(function (x){ return owned[x.id]; });
        if (full) unlock('cardset1', '集齐了一整套「' + s.name + '」');
      }
    } catch (e) {}
  }

  /* ================= 成就 ================= */
  function unlock(id, descOverride){
    try {
      var a = rd(ACH_KEY);
      if (a[id]) return;
      a[id] = Date.now();
      wr(ACH_KEY, a);
      var def = ACHS[id];
      if (!def) return;
      queuePop({ mode: 'ach', icon: def.i, tagText: '🎉 解锁成就', name: def.n,
        desc: descOverride || def.d, sound: 'unlock' });
    } catch (e) {}
  }

  /* ================= 连击（各页面共用一份会话内计数） ================= */
  var combo = 0;

  /* ================= 对外 API ================= */
  var PS = {

    /* 答对时调用。opts.quiet=true 时不放音效不弹连击条、不弹全局连击成就
       （数学两季有自己的音效/连击/成就，只吃掉卡/彩蛋/计数） */
    onRight: function (opts){
      opts = opts || {};
      try {
        ensureAudio();
        combo++;
        if (!opts.quiet) {
          sndRight(combo);
          if (combo >= 2) toast('🔥 ' + combo + ' 连击');
          if (combo >= 10) unlock('combo10');
          if (combo >= 20) unlock('combo20');
        }
        if (Math.random() < 0.12) egg();
        dropCard();
      } catch (e) {}
    },

    /* 答错时调用：连击清零 */
    onWrong: function (opts){
      opts = opts || {};
      try {
        combo = 0;
        if (!opts.quiet) { ensureAudio(); sndWrong(); }
      } catch (e) {}
    },

    /* 完成一局/一轮时调用。info = { subj:'语文', right:对几题, total:共几题 }
       opts.quiet=true（数学两季用）：跳过胜利音效和「第一次全对」弹窗（页面自带同款），
       喂能量 / 进化 / 连续天数照常 */
    finishRound: function (info, opts){
      opts = opts || {};
      try {
        addToday();
        checkStreak();
        var d = rd(ENERGY_KEY);
        var before = stageIdx(d.e || 0);
        d.e = (d.e || 0) + 1;
        var after = stageIdx(d.e);
        /* 养成详情数据源：累计局数 + 最近喂养 + 进化时间（都存在趣味层自己的 key 里） */
        d.n = (d.n || 0) + 1;
        d.feed = d.feed || [];
        d.feed.push({ t: Date.now(), s: (info && info.subj) || '练习' });
        if (d.feed.length > 30) d.feed = d.feed.slice(-30);
        if (after > before) {
          d.hist = d.hist || {};
          d.hist[after] = Date.now();
        }
        wr(ENERGY_KEY, d);
        ensureAudio();
        if (!opts.quiet) sndWin();
        var s = STAGES[after];
        toast('🐊 ' + s.name + ' 吃饱啦，能量 +1');
        if (after > before) {
          queuePop({ mode: 'evolve', icon: s.emoji, tagText: '✨ 进化了！', name: s.name,
            desc: '绿鳄王长大了！继续练，它还能变得更强。', sound: 'unlock', btn: '继续加油' });
          unlock('evolve' + after);
        }
        if (!opts.quiet && info && info.total && info.right != null && info.right >= info.total) unlock('first_perfect');
      } catch (e) {}
    },

    /* 供需要单独放解锁音效的页面用（如昆虫图鉴解锁） */
    sndUnlock: function (){ ensureAudio(); sndUnlock(); },

    /* 首页：渲染绿鳄王 + 卡册 + 成就 */
    renderHome: function (box){
      if (!box) return;
      try {
        var d = rd(ENERGY_KEY);
        var e = d.e || 0;
        var idx = stageIdx(e);
        var s = STAGES[idx];
        var next = STAGES[idx + 1];
        var pct = next
          ? Math.round((e - s.min) / (next.min - s.min) * 100)
          : 100;
        var nDays = streak();
        var cards = rd(CARD_KEY);
        var gotN = ALL_CARDS.filter(function (c){ return cards[c.id]; }).length;
        var achs = rd(ACH_KEY);
        var achN = 0;
        for (var k in ACHS) if (achs[k]) achN++;

        var html = '<section class="ps-petcard" id="psPetCard">'
          + '<button type="button" class="ps-pet" id="psPet" aria-label="绿鳄王">' + s.emoji + '</button>'
          + '<div class="ps-petinfo">'
          + '<div class="ps-petname">' + s.name
          + (nDays >= 2 ? '<span class="ps-streak">🔥 连续练 ' + nDays + ' 天</span>' : '')
          + '<span style="font-size:12px;color:#6B6459;font-weight:700">能量 ' + e + '</span></div>'
          + '<div class="ps-ebar"><i style="width:' + pct + '%"></i></div>'
          + '<div class="ps-petnext">' + (next
              ? '再练 <b>' + (next.min - e) + '</b> 局进化成「' + next.name + '」'
              : '<b>已是最高形态</b>，' + s.feed)
          + '　<a href="javascript:void(0)" style="color:#1D5C39;font-weight:800">详情 ▸</a></div>'
          + '</div></section>'
          + '<button type="button" class="ps-collbtn" id="psCollBtn">🎴 我的卡册 ' + gotN + '/' + ALL_CARDS.length
          + '　·　🏆 成就 ' + achN + '/' + Object.keys(ACHS).length + '</button>'
          + '<div class="ps-coll" id="psColl" hidden>';

        SETS.forEach(function (set) {
          var full = set.cards.every(function (c){ return cards[c.id]; });
          html += '<div class="ps-setname">' + set.name + (full ? ' <span class="ok">✅ 已集齐</span>' : '') + '</div><div class="ps-cgrid">';
          set.cards.forEach(function (c) {
            var got = !!cards[c.id];
            html += '<div class="ps-citem' + (got ? '' : ' locked') + '" data-id="' + c.id
              + '" style="cursor:pointer" title="点开看大卡">'
              + '<div class="ce">' + c.e + '</div>'
              + '<div class="cn">' + (got ? c.n : '？？？') + '</div></div>';
          });
          html += '</div>';
        });

        html += '<div class="ps-setname">🏆 我的成就</div>';
        for (var id in ACHS) {
          var a = ACHS[id], got = !!achs[id];
          html += '<div class="ps-achrow' + (got ? '' : ' locked') + '">'
            + '<span class="ai">' + (got ? a.i : '🔒') + '</span>'
            + '<span><b>' + a.n + '</b><small>' + a.d + '</small></span></div>';
        }
        html += '</div>';

        box.innerHTML = html;

        var pet = el('psPet');
        if (pet) pet.onclick = function () {
          ensureAudio();
          beep(523, .1, 'sine', 0); beep(784, .14, 'sine', .09);
          pet.classList.remove('wiggle');
          void pet.offsetWidth;
          pet.classList.add('wiggle');
          setTimeout(openPetDetail, 380);
        };
        var pc = el('psPetCard');
        if (pc) pc.onclick = function (e){
          if (e.target.closest && e.target.closest('#psPet')) return; /* emoji 自己处理 */
          openPetDetail();
        };
        /* 卡册小卡：点开看大卡面详情 */
        var items = box.querySelectorAll('.ps-citem');
        for (var ci = 0; ci < items.length; ci++) {
          items[ci].onclick = function(){ openCardDetail(this.getAttribute('data-id')); };
        }
        var cb = el('psCollBtn');
        var coll = el('psColl');
        if (cb && coll) cb.onclick = function () {
          coll.hidden = !coll.hidden;
          cb.textContent = (coll.hidden ? '展开' : '收起') + cb.textContent.replace(/^(展开|收起)/, '');
        };
      } catch (e) {}
    }
  };

  /* ================= 练习天数 & 连续天数 ================= */
  function todayStr(){
    var t = new Date();
    return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
  }
  function addToday(){
    var d = rd(DAY_KEY);
    var a = d.days || [];
    if (a.indexOf(todayStr()) < 0) { a.push(todayStr()); d.days = a; wr(DAY_KEY, d); }
  }
  function toDays(s){
    var p = s.split('-');
    return { y: +p[0], m: +p[1], d: +p[2] };
  }
  function gapDays(a, b){ /* b 比 a 晚几天（粗算到日） */
    var ta = new Date(a.y, a.m - 1, a.d).getTime();
    var tb = new Date(b.y, b.m - 1, b.d).getTime();
    return Math.round((tb - ta) / 86400000);
  }
  function streak(){
    var days = (rd(DAY_KEY).days || []).map(toDays);
    if (!days.length) return 0;
    var t = toDays(todayStr());
    days.sort(function (a, b){
      return new Date(b.y, b.m - 1, b.d) - new Date(a.y, a.m - 1, a.d);
    });
    if (gapDays(days[0], t) > 0) return 0; /* 今天还没练 */
    var n = 1;
    for (var i = 1; i < days.length; i++) {
      if (gapDays(days[i], days[i - 1]) === 1) n++;
      else break;
    }
    return n;
  }
  function checkStreak(){
    if (streak() >= 3) unlock('streak3');
  }

  /* ================= 详情弹层（宠物养成详情 / 卡片详情，都在本页打开，不新增页面） ================= */
  function closeDetail(){
    var ov = document.getElementById('psDetail');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }
  function openDetail(inner, after){
    closeDetail();
    var ov = document.createElement('div');
    ov.id = 'psDetail';
    ov.className = 'ps-detail';
    ov.innerHTML = '<div class="ps-dbox">' + inner + '</div>';
    document.body.appendChild(ov);
    /* 下一帧再 .show，让透明度过渡生效 */
    requestAnimationFrame(function(){ ov.classList.add('show'); });
    ov.onclick = function (e){ if (e.target === ov) closeDetail(); };
    var xb = ov.querySelector('.ps-x');
    if (xb) xb.onclick = closeDetail;
    if (after) after(ov);
  }
  function fmtDay(ts){
    var t = new Date(ts), n = new Date();
    var a = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    var b = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    var d = Math.round((a - b) / 86400000);
    if (d === 0) return '今天';
    if (d === 1) return '昨天';
    return (t.getMonth() + 1) + '月' + t.getDate() + '日';
  }
  /* 数字从 0 滚到目标值 */
  function countUp(box){
    var els = box.querySelectorAll('[data-n]');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        var n = parseInt(el.getAttribute('data-n') || '0', 10);
        if (!n) { el.textContent = '0'; return; }
        var st = Date.now();
        var tick = function () {
          var p = Math.min((Date.now() - st) / 700, 1);
          var v = Math.round(n * (1 - Math.pow(1 - p, 2)));
          el.textContent = v;
          if (p < 1 && el.parentNode) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      })(els[i]);
    }
  }

  /* 每个阶段一句不同的鼓励语 */
  var ENCOURAGE = [
    ['练一局，我就能醒啦！', '里面好暖和…不，我想出去看看你！'],
    ['我孵出来啦！多练几局我还要长大！', '今天喂我了吗？练一局就行！'],
    ['我是绿鳄王！陪你冲一百连击！', '下一站：机器鳄鱼王！'],
    ['喷火待命中！全靠你把我养成最帅的鳄鱼！', '谁连击最多？肯定是你！']
  ];

  function petDetailHtml(){
    var d = rd(ENERGY_KEY);
    var e = d.e || 0, idx = stageIdx(e), s = STAGES[idx];
    var feed = (d.feed || []).slice().reverse();
    var hist = d.hist || {};
    var rows = '';
    for (var i = 0; i < STAGES.length; i++) {
      var st = STAGES[i];
      var unlocked = e >= st.min;
      var cls = 'ps-tlrow' + (i === idx ? ' now' : '') + (unlocked ? '' : ' locked');
      var info;
      if (i === idx) info = '当前形态 · 能量 ' + e;
      else if (unlocked) info = hist[i] ? fmtDay(hist[i]) + '进化' : '已进化';
      else info = '再练 ' + (st.min - e) + ' 局解锁';
      rows += '<div class="' + cls + '" style="animation-delay:' + (i * 0.09 + 0.15) + 's">'
        + '<span class="te">' + st.emoji + '</span>'
        + '<span><div class="tn">' + st.name + (i === idx ? '<span class="ps-nowtag">现在</span>' : '') + '</div>'
        + '<div class="td">' + info + '</div></span></div>';
    }
    var feedHtml = '<div class="ps-setname" style="margin-top:14px">🍽️ 最近喂养</div>';
    if (feed.length) {
      for (var k = 0; k < Math.min(feed.length, 5); k++) {
        feedHtml += '<div class="ps-feedrow"><span>' + feed[k].s + '</span><small>' + fmtDay(feed[k].t) + '</small></div>';
      }
    } else {
      feedHtml += '<div class="ps-feedrow"><span>还没喂过，练一局试试</span><small>—</small></div>';
    }
    var enc = ENCOURAGE[idx][Math.floor(Math.random() * ENCOURAGE[idx].length)];
    return '<div class="ps-big" id="psBig">' + s.emoji + '</div>'
      + '<div class="ps-cname">' + s.name + ' · 能量 ' + e + '</div>'
      + '<div class="ps-cset">' + enc + '</div>'
      + '<div class="ps-stats">'
      + '<div class="ps-stat"><b data-n="' + e + '">0</b><span>总能量</span></div>'
      + '<div class="ps-stat"><b data-n="' + streak() + '">0</b><span>连续天数</span></div>'
      + '<div class="ps-stat"><b data-n="' + (d.n || e) + '">0</b><span>累计局数</span></div>'
      + '</div>'
      + '<div class="ps-setname" style="margin-top:14px">🌱 成长时间线</div>'
      + '<div class="ps-tl">' + rows + '</div>'
      + feedHtml
      + '<button type="button" class="ps-x">知道啦</button>';
  }
  function openPetDetail(){
    openDetail(petDetailHtml(), function (ov){
      countUp(ov);
      var big = ov.querySelector('#psBig');
      if (big) big.onclick = function () {
        /* 戳一下：跳 + 音调随能量升高 */
        ensureAudio();
        var m = pitch(Math.min(energy(), 12));
        beep(523 * m, .1, 'sine', 0); beep(659 * m, .12, 'sine', .09); beep(784 * m, .16, 'sine', .18);
        big.classList.remove('hop');
        void big.offsetWidth;
        big.classList.add('hop');
      };
    });
  }

  function cardDetailHtml(c){
    var owned = rd(CARD_KEY);
    var got = !!owned[c.id];
    var set = null;
    for (var i = 0; i < SETS.length; i++) if (SETS[i].id === c.set) set = SETS[i];
    var cnt = 0;
    for (var j = 0; j < set.cards.length; j++) if (owned[set.cards[j].id]) cnt++;
    var pct = Math.round(cnt / set.cards.length * 100);
    var head = got
      ? '<div class="ps-cbig">' + c.e + '</div>'
        + '<div class="ps-cname">' + c.n + '</div>'
        + '<div class="ps-cset">「' + set.name + '」系列 · ' + cnt + '/' + set.cards.length
        + (cnt === set.cards.length ? ' ✅ 已集齐' : '') + '</div>'
      : '<div class="ps-cbig" style="filter:grayscale(1);opacity:.4">' + c.e + '</div>'
        + '<div class="ps-cname">？？？</div>'
        + '<div class="ps-cset">「' + set.name + '」系列 · ' + cnt + '/' + set.cards.length + '</div>';
    return { html: head
      + '<div class="ps-cbar"><i></i></div>'
      + '<div class="ps-cdate">' + (got
        ? (typeof owned[c.id] === 'number' ? fmtDay(owned[c.id]) + '获得这张卡' : '已收进卡册')
        : '答对就有机会掉落这张卡（大约 5 次掉 1 张）') + '</div>'
      + '<button type="button" class="ps-x">' + (got ? '收起' : '去练一局！') + '</button>',
      pct: pct };
  }
  function openCardDetail(cid){
    var c = null;
    for (var i = 0; i < ALL_CARDS.length; i++) if (ALL_CARDS[i].id === cid) c = ALL_CARDS[i];
    if (!c) return;
    var r = cardDetailHtml(c);
    openDetail(r.html, function (ov){
      var bar = ov.querySelector('.ps-cbar i');
      if (bar) setTimeout(function(){ if (bar.parentNode) bar.style.width = r.pct + '%'; }, 100);
    });
  }

  window.PS = PS;
})();
