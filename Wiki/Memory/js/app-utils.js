// ── State ──
var currentJobId = null;
var currentAsin = null;
var selectedPrototype = null;
var expertData = null;
var genCount = {};
var eventSource = null;

/* ── Tab Permissions & Sidebar State ── */
var ALLOWED_TABS = [];
var SIDEBAR_COLLAPSED = localStorage.getItem('sidebarCollapsed') === '1';
var TREE_GROUPS_COLLAPSED = {};
try { TREE_GROUPS_COLLAPSED = JSON.parse(localStorage.getItem('treeGroupsCollapsed') || '{}'); } catch(e) {}

var ALL_TABS_META = [
  {id:'market', label:'市场分析', group:'analysis', icon:'📈'},
  {id:'adAnalysis', label:'广告分析', group:'analysis', icon:'📢'},
  {id:'reviewIntel', label:'评论洞察', group:'analysis', icon:'📝'},
  {id:'trafficAnomaly', label:'流量诊断', group:'analysis', icon:'📉'},
  {id:'listingAudit', label:'Listing分析', group:'analysis', icon:'📋'},
  {id:'keywordLibrary', label:'关键词词库', group:'analysis', icon:'🔤'},
  {id:'compete', label:'竞争&出单率', group:'analysis', icon:'🥊'},
  {id:'expert', label:'Alexa for Shopping', group:'content', icon:'🧠'},
  {id:'material', label:'产品素材生成', group:'content', icon:'🎨'},
  {id:'tiktok', label:'TikTok竞品', group:'supply', icon:'🎵'},
  {id:'supplyChain', label:'供应链分析', group:'supply', icon:'🏭'},
  {id:'replenishment', label:'补货计划', group:'supply', icon:'📦'},
  {id:'packaging', label:'包装建议', group:'supply', icon:'📐'},
  {id:'kanban', label:'执行看板', group:'ops', icon:'📋'},
  {id:'calc', label:'运营工具', group:'ops', icon:'💰'},
  {id:'patent', label:'商标查询', group:'ops', icon:'🔍'}
];

// ── Helpers ──
function escHtml(s) { return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
// SVG curve chart — replaces _aiBar. rows=[{label,value,color}|{label,segs:[{value,color,label}]}]
function _aiBar(rows, opts) {
  opts = opts || {};
  var maxVal = opts.maxVal || 0;
  if (!maxVal) rows.forEach(function(r){ var t=0; (r.segs||[{value:r.value}]).forEach(function(s){ t+=s.value||0; }); if(t>maxVal)maxVal=t; });
  maxVal = maxVal || 1;
  var ch = (opts.h || 80) * 2, bw = (opts.bw || 12) * 2, gap = (opts.gap || 3) * 2;
  var n = rows.length;
  var totalW = Math.max(n * (bw + gap) + 40, 300);

  var hasSegs = rows.some(function(r){ return r.segs && r.segs.length; });
  var series = [];
  if (hasSegs) {
    var segKeys = {};
    rows.forEach(function(r){ (r.segs||[]).forEach(function(s){ segKeys[s.label||''] = s.color || 'var(--accent)'; }); });
    series = Object.keys(segKeys).map(function(k){ return {label: k, color: segKeys[k], points: []}; });
  }

  var pts = rows.map(function(r, i){
    var x = 24 + (i / Math.max(n-1, 1)) * (totalW - 48);
    if (!hasSegs) {
      return {x: x, val: r.value || 0, label: r.label||'', color: r.color||'var(--accent)'};
    }
    var pt = {x: x, label: r.label||'', vals: {}};
    series.forEach(function(ser){
      var found = (r.segs||[]).filter(function(s){ return (s.label||'') === ser.label; });
      pt.vals[ser.label] = found.length ? found[0].value || 0 : 0;
    });
    return pt;
  });

  var padB = 20, padT = 8;
  var svgH = ch + padB + padT;
  var y0 = ch + padT;

  var svg = '<svg width="' + totalW + '" height="' + svgH + '" style="display:block;margin:0 auto;">';

  // Grid lines
  for (var g = 0; g <= 3; g++) {
    var gy = y0 - (g/3) * ch;
    svg += '<line x1="24" y1="' + gy.toFixed(1) + '" x2="' + (totalW-24) + '" y2="' + gy.toFixed(1) + '" stroke="var(--bg3)" stroke-width="0.5"/>';
  }

  if (!hasSegs) {
    var linePts = pts.map(function(p){ var y = y0 - (p.val/maxVal)*ch; return p.x.toFixed(1)+','+y.toFixed(1); }).join(' ');
    var areaD = 'M' + pts[0].x.toFixed(1) + ',' + y0 + ' L' + linePts + ' L' + pts[n-1].x.toFixed(1) + ',' + y0 + ' Z';
    svg += '<polygon points="' + areaD + '" fill="' + (pts[0].color || 'var(--accent)') + '" opacity="0.08"/>';
    svg += '<polyline points="' + linePts + '" fill="none" stroke="' + (pts[0].color || 'var(--accent)') + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    pts.forEach(function(p){
      var y = y0 - (p.val/maxVal)*ch;
      svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.5" fill="' + (p.color||'var(--accent)') + '"/>';
    });
  } else {
    series.forEach(function(ser){
      var lp = pts.map(function(p){ var y = y0 - ((p.vals[ser.label]||0)/maxVal)*ch; return p.x.toFixed(1)+','+y.toFixed(1); }).join(' ');
      svg += '<polyline points="' + lp + '" fill="none" stroke="' + ser.color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
      pts.forEach(function(p){
        var y = y0 - ((p.vals[ser.label]||0)/maxVal)*ch;
        if ((p.vals[ser.label]||0) > 0) svg += '<circle cx="' + p.x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" fill="' + ser.color + '"/>';
      });
    });
  }

  var step = Math.max(1, Math.floor(n / 8));
  pts.forEach(function(p, i){
    if (i % step === 0 || i === n-1) {
      svg += '<text x="' + p.x.toFixed(1) + '" y="' + (svgH-3) + '" text-anchor="middle" font-size="10" fill="var(--muted)">' + escHtml(String(p.label||'').substring(0,8)) + '</text>';
    }
  });

  svg += '</svg>';
  return '<div style="overflow-x:auto;margin:4px 0">' + svg + '</div>';
}
function showToast(msg, type) {
  var t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'toast'; t.className = 'toast';
    document.querySelector('.oa-main').appendChild(t);
  }
  t.textContent = msg;
  t.style.background = type==='success'?'var(--green)':type==='error'?'var(--red)':'var(--accent)';
  t.style.opacity = '1';
  clearTimeout(t._tid);
  t._tid = setTimeout(function(){t.style.opacity='0';},5000);
}

// ── Tab Navigation ──
function switchMainTab(tab) {
  // ── Permission guard ──
  if (ALLOWED_TABS.length > 0 && ALLOWED_TABS.indexOf(tab) === -1) {
    showToast('该模块未授权，请联系客服升级', 'error');
    return;
  }

  // ── Sync tree node ──
  document.querySelectorAll('.tree-item').forEach(function(el){el.classList.remove('active');});
  var treeItem = document.querySelector('.tree-item[data-tab="' + tab + '"]');
  if (treeItem) {
    treeItem.classList.add('active');
    var children = treeItem.closest('.tree-group-children');
    if (children && children.classList.contains('collapsed')) {
      children.classList.remove('collapsed');
      var hdr = children.parentElement.querySelector('.tree-group-header');
      if (hdr) hdr.classList.remove('collapsed');
    }
  }

  // ── Sync horizontal tab ──
  document.querySelectorAll('.main-tab').forEach(function(t){t.classList.remove('active');});
  var buttons = document.querySelectorAll('.main-tab');
  for (var i = 0; i < buttons.length; i++) {
    var oc = buttons[i].getAttribute('onclick') || '';
    if (oc.indexOf("'" + tab + "'") >= 0) { buttons[i].classList.add('active'); break; }
  }

  // ── Switch panel ──
  document.querySelectorAll('.main-tab-panel').forEach(function(p){p.classList.remove('active');});
  var tabMap = {market:'mainTabMarket', adAnalysis:'mainTabAdAnalysis', reviewIntel:'mainTabReviewIntel', trafficAnomaly:'mainTabTrafficAnomaly', listingAudit:'mainTabListingAudit', keywordLibrary:'mainTabKeywordLibrary', compete:'mainTabCompete', patent:'mainTabPatent', tiktok:'mainTabTiktok', supplyChain:'mainTabSupplyChain', replenishment:'mainTabReplenishment', packaging:'mainTabPackaging', kanban:'mainTabKanban', material:'mainTabMaterial', expert:'mainTabExpert', calc:'mainTabCalc'};
  document.getElementById(tabMap[tab]).classList.add('active');

  // ── Lazy-load settings ──
  if (tab === 'market') getMarketSettings().catch(function(){});
  if (tab === 'adAnalysis') getAdSettings().catch(function(){});
  if (tab === 'reviewIntel') getRISettings().catch(function(){});
  if (tab === 'trafficAnomaly') getTrafficAnomalySettings().catch(function(){});
  if (tab === 'listingAudit') getAuditSettings().catch(function(){});
  if (tab === 'patent') getPatentSettings().catch(function(){});
  if (tab === 'tiktok') { fetch('/api/settings').then(function(r){return r.json();}).then(function(cfg){updateTiktokSourceBadge(cfg);}).catch(function(){}); }
  if (tab === 'supplyChain') getSupplyChainSettings().catch(function(){});
  if (tab === 'replenishment') updateReplSourceBadges();
  if (tab === 'packaging') updatePackSourceBadges();
  if (tab === 'kanban') updateKanbanSourceBadges();
  if (tab === 'compete') updateCompSourceBadges();
  if (tab === 'expert') updateExpertSourceBadges();
}

/* ── updateTabVisibility ── */
function updateTabVisibility(allowedTabs) {
  ALLOWED_TABS = allowedTabs || [];

  if (ALLOWED_TABS.length === 0) {
    // No license — hide everything
    document.querySelectorAll('.main-tab').forEach(function(btn){btn.style.display='none';});
    document.querySelectorAll('.tree-item').forEach(function(el){el.style.display='none';});
    document.querySelectorAll('.tree-group').forEach(function(g){g.style.display='none';});
    document.querySelectorAll('.main-tab-panel').forEach(function(p){p.classList.remove('active');});
    return;
  }

  // Track which groups have at least one visible item
  var groupVisible = {};

  // Horizontal tabs: hide unauthorized
  document.querySelectorAll('.main-tab').forEach(function(btn){
    var oc = btn.getAttribute('onclick') || '';
    var m = oc.match(/switchMainTab\('(\w+)'\)/);
    if (m && ALLOWED_TABS.indexOf(m[1]) === -1) { btn.style.display = 'none'; }
    else { btn.style.display = ''; }
  });

  // Tree items: hide unauthorized; track group visibility
  document.querySelectorAll('.tree-item').forEach(function(el){
    var tab = el.getAttribute('data-tab');
    var group = el.closest('.tree-group');
    var groupId = group ? group.id : '';
    if (tab && ALLOWED_TABS.indexOf(tab) === -1) {
      el.style.display = 'none';
    } else {
      el.style.display = '';
      if (groupId) groupVisible[groupId] = true;
    }
  });

  // Tree groups: hide if all children hidden
  document.querySelectorAll('.tree-group').forEach(function(g){
    if (groupVisible[g.id]) {
      g.style.display = '';
    } else {
      g.style.display = 'none';
    }
  });

  // If current active tab is hidden, switch to first allowed
  var activeItem = document.querySelector('.tree-item.active');
  if (!activeItem || activeItem.style.display === 'none') {
    var first = document.querySelector('.tree-item[style*="display:"][style*="display:"]');
    // Need to find first visible tree item
    var allItems = document.querySelectorAll('.tree-item');
    var found = false;
    for (var i = 0; i < allItems.length; i++) {
      if (allItems[i].style.display !== 'none') {
        var ft = allItems[i].getAttribute('data-tab');
        if (ft) { switchMainTab(ft); found = true; break; }
      }
    }
    if (!found) {
      document.querySelectorAll('.main-tab-panel').forEach(function(p){p.classList.remove('active');});
    }
  }
}

/* ── toggleSidebar ── */
var SIDEBAR_WIDTH = parseInt(localStorage.getItem('sidebarWidth')) || 270;
function toggleSidebar() {
  var sb = document.getElementById('mainSidebar');
  var btn = document.getElementById('navSidebarToggle');
  SIDEBAR_COLLAPSED = !SIDEBAR_COLLAPSED;
  if (SIDEBAR_COLLAPSED) {
    sb.style.width = '';  // clear inline width so CSS width:36px applies
    sb.classList.add('collapsed');
    if (btn) btn.textContent = '»';
  } else {
    sb.classList.remove('collapsed');
    sb.style.width = SIDEBAR_WIDTH + 'px';
    if (btn) btn.textContent = '«';
  }
  localStorage.setItem('sidebarCollapsed', SIDEBAR_COLLAPSED ? '1' : '0');
}

/* ── Sidebar drag resize ── */
(function(){
  var handle, sidebar, startX, startW, minW = 180, maxW = 500;
  function onMouseDown(e) {
    sidebar = document.getElementById('mainSidebar');
    if (!sidebar || sidebar.classList.contains('collapsed')) return;
    handle = e.target;
    handle.classList.add('active');
    startX = e.clientX;
    startW = sidebar.offsetWidth;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  }
  function onMouseMove(e) {
    if (!sidebar) return;
    var w = startW + (e.clientX - startX);
    w = Math.max(minW, Math.min(maxW, w));
    sidebar.style.width = w + 'px';
    SIDEBAR_WIDTH = w;
  }
  function onMouseUp(e) {
    handle && handle.classList.remove('active');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    localStorage.setItem('sidebarWidth', SIDEBAR_WIDTH);
  }
  // Attach after DOM ready
  setTimeout(function(){
    var h = document.getElementById('navResizeHandle');
    if (h) h.addEventListener('mousedown', onMouseDown);
  }, 100);
})();

/* ── toggleTreeGroup ── */
function toggleTreeGroup(groupId) {
  if (SIDEBAR_COLLAPSED) { toggleSidebar(); setTimeout(function(){_doToggleGroup(groupId);},220); return; }
  _doToggleGroup(groupId);
}
function _doToggleGroup(groupId) {
  var cap = groupId.charAt(0).toUpperCase() + groupId.slice(1);
  var children = document.getElementById('treeChildren' + cap);
  var header = document.querySelector('#treeGroup' + cap + ' .tree-group-header');
  if (!children) return;
  var closed = children.classList.contains('collapsed');
  if (closed) { children.classList.remove('collapsed'); if(header)header.classList.remove('collapsed'); }
  else { children.classList.add('collapsed'); if(header)header.classList.add('collapsed'); }
  TREE_GROUPS_COLLAPSED[groupId] = !closed;
  localStorage.setItem('treeGroupsCollapsed', JSON.stringify(TREE_GROUPS_COLLAPSED));
}

/* ── initSidebarState ── */
function initSidebarState() {
  // Immediately hide all tab panels — only license check unlocks them
  document.querySelectorAll('.main-tab-panel').forEach(function(p){p.classList.remove('active');});
  // Restore sidebar width
  var sb = document.getElementById('mainSidebar');
  if (sb && SIDEBAR_WIDTH && !SIDEBAR_COLLAPSED) { sb.style.width = SIDEBAR_WIDTH + 'px'; }
  // Restore collapsed state
  if (SIDEBAR_COLLAPSED) {
    if (sb) sb.classList.add('collapsed');
    var btn = document.getElementById('navSidebarToggle');
    if (btn) btn.textContent = '»';  // »
  }
  for (var gid in TREE_GROUPS_COLLAPSED) {
    if (TREE_GROUPS_COLLAPSED[gid]) {
      var cap = gid.charAt(0).toUpperCase() + gid.slice(1);
      var ch = document.getElementById('treeChildren' + cap);
      var hd = document.querySelector('#treeGroup' + cap + ' .tree-group-header');
      if (ch) ch.classList.add('collapsed');
      if (hd) hd.classList.add('collapsed');
    }
  }
}
initSidebarState();