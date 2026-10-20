/* ============================================================
   北极星学习屋 · 全局底部导航
   所有子页面统一加这一条：← 返回  /  🏠 首页
   用法：在 </body> 前加 <script src="nav.js"></script>
   ============================================================ */
(function () {
  if (document.getElementById('pnav')) return;

  var css = ''
    + '.pnav{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:9999;'
    + 'display:flex;gap:8px;padding:6px;border-radius:999px;'
    + 'background:rgba(255,255,255,.92);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);'
    + 'box-shadow:0 8px 28px rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.75)}'
    + '.pnav button,.pnav a{border:none;text-decoration:none;font-family:inherit;font-weight:800;'
    + 'font-size:14px;padding:10px 18px;border-radius:999px;cursor:pointer;min-height:42px;'
    + 'display:inline-flex;align-items:center;justify-content:center;gap:5px;'
    + '-webkit-tap-highlight-color:transparent;transition:transform .1s;white-space:nowrap}'
    + '.pnav button:active,.pnav a:active{transform:scale(.94)}'
    + '.pnav .back{background:#eef1ef;color:#3d6350;box-shadow:0 3px 0 #d5ddd8}'
    + '.pnav .back:active{box-shadow:0 1px 0 #d5ddd8}'
    + '.pnav .home{background:#2E9E5B;color:#fff;box-shadow:0 3px 0 #1F7A45}'
    + '.pnav .home:active{box-shadow:0 1px 0 #1F7A45}'
    + '@media (max-width:380px){.pnav button,.pnav a{font-size:13px;padding:9px 14px}}'
    + 'body{height:auto !important;min-height:100vh !important;padding-bottom:88px !important;'
    + '-webkit-user-select:text;user-select:text}'
    + '.pnav button,.pnav a{-webkit-user-select:none;user-select:none}';
  var st = document.createElement('style');
  st.id = 'pnav-style';
  st.textContent = css;
  document.head.appendChild(st);

  var nav = document.createElement('div');
  nav.className = 'pnav';
  nav.id = 'pnav';
  nav.innerHTML = '<button type="button" class="back" id="pnavBack">← 返回</button>'
                + '<a class="home" href="index.html">🏠 首页</a>';
  document.body.appendChild(nav);

  /* 游戏页 body 是 flex + align-items:center：内容比屏幕高时，
     溢出部分滚不到、父元素 padding 也被吞掉，底部按钮会被导航条永久挡住。
     直接把 body 改回块级布局（顶部对齐、正常滚动），卡片用 margin:auto 保持水平居中 */
  var cs = getComputedStyle(document.body);
  if (cs.display === 'flex' && cs.alignItems === 'center') {
    document.body.style.display = 'block';
    document.body.style.paddingTop = '16px';
    var appEl = document.getElementById('app');
    if (appEl) {
      appEl.style.margin = '0 auto';
      appEl.style.width = '100%';
      appEl.style.maxWidth = '560px';
    }
  }

  document.getElementById('pnavBack').onclick = function () {
    if (window.history.length > 1) window.history.back();
    else window.location.href = 'index.html';
  };
})();
