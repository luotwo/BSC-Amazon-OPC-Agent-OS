
// ═══════════════════════════════════════════════════════════════
// Listing Audit (Listing 分析)
// ═══════════════════════════════════════════════════════════════
var AUDIT_STATE = { data: null, loading: false, tab: 'overview' };

function switchAuditTab(tab) {
  AUDIT_STATE.tab = tab;
  var labels = {overview:'总览', title:'标题', bullets:'五点', images:'图片',aplus:'A+', reviews:'评论', keywords:'关键词', category:'类目', pricing:'定价'};
  document.querySelectorAll('#auditSubTabs .expert-tab').forEach(function(t){
    t.classList.remove('active');
    if (t.textContent.indexOf(labels[tab]) !== -1) t.classList.add('active');
  });
  if (!AUDIT_STATE.data) return;
  var twoCol = document.getElementById('auditTwoCol');
  var fullPanel = document.getElementById('auditFullPanel');
  if (tab === 'overview') {
    if (twoCol) twoCol.style.display = 'flex';
    if (fullPanel) fullPanel.style.display = 'none';
    renderAuditSidebar(AUDIT_STATE.data);
    renderAuditDetail(AUDIT_STATE.data, 'overview');
  } else {
    if (twoCol) twoCol.style.display = 'none';
    if (fullPanel) fullPanel.style.display = 'block';
    renderAuditDetail(AUDIT_STATE.data, tab);
  }
}

function updateAuditSourceBadges(cfg) {
  cfg = cfg || {};
  function setBadge(id, label, enabled, hasCreds) {
    var el = document.getElementById(id); if (!el) return;
    el.classList.remove('active', 'warn');
    if (enabled && hasCreds) { el.classList.add('active'); el.textContent = label + '：已连接'; }
    else if (hasCreds && !enabled) { el.classList.add('warn'); el.textContent = label + '：已配置/未开启'; }
    else if (enabled && !hasCreds) { el.classList.add('warn'); el.textContent = label + '：缺密钥/链接'; }
    else { el.textContent = label + '：未配置'; }
  }
  var sif = cfg.sif_mcp || {};
  var st = cfg.sorftime_mcp || {};
  var ss = cfg.sellersprite_mcp || {};
  setBadge('auditSrcSif', 'SIF MCP', sif.enabled, !!(sif.endpoint && sif.api_key));
  setBadge('auditSrcSt', 'Sorftime MCP', st.enabled, !!(st.endpoint && st.api_key));
  setBadge('auditSrcSs', 'SellerSprite MCP', ss.enabled, !!(ss.endpoint && ss.api_key));
}

async function getAuditSettings() {
  var res = await fetch('/api/settings');
  var cfg = await res.json();
  updateAuditSourceBadges(cfg);
  return cfg;
}

async function startListingAudit() {
  var asin = document.getElementById('auditAsin').value.trim();
  var marketplace = document.getElementById('auditMarketplace').value;
  if (!marketplace) { showToast('请选择站点'); return; }
  if (!asin) { showToast('请输入目标 ASIN'); return; }
  if (!/^[A-Za-z0-9]{5,15}$/.test(asin)) { showToast('ASIN 格式错误（5-15 位字母数字）'); return; }

  try { await getAuditSettings(); } catch(e) {}
  AUDIT_STATE.loading = true;
  auditShowLoading();
  showToast('正在调用 MCP 数据源进行全面分析，预计 15-30 秒，请耐心等待…', 'info');

  var btn = document.querySelector('#mainTabListingAudit .btn-mkt-start');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 分析中...'; }

  var jobId = 'audit' + Date.now().toString(36) + Math.random().toString(36).substr(2,6);
  var qs = '?asin=' + encodeURIComponent(asin) +
           '&marketplace=' + encodeURIComponent(marketplace);

  fetch('/api/listing-audit/' + jobId + qs)
    .then(function(r){ return r.json(); })
    .then(function(data){
      AUDIT_STATE.loading = false;
      AUDIT_STATE.data = data;
      if (btn) { btn.disabled = false; btn.textContent = '🔍 开始分析'; }
      if (data.error) { showToast('审核失败：' + data.error); auditShowError(data.error); return; }
      auditRenderAll(data);
    })
    .catch(function(err){
      AUDIT_STATE.loading = false;
      if (btn) { btn.disabled = false; btn.textContent = '🔍 开始分析'; }
      showToast('请求失败：' + err.message);
      auditShowError(err.message);
    });
}

function auditShowLoading() {
  var ph = document.getElementById('auditPlaceholder');
  var tc = document.getElementById('auditTwoCol');
  var fp = document.getElementById('auditFullPanel');
  if (ph) ph.style.display = 'none';
  if (tc) tc.style.display = 'none';
  if (fp) fp.style.display = 'none';
  var left = document.getElementById('auditOverviewLeft');
  if (left) left.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在采集...</div></div>';
}

function auditShowError(msg) {
  var ph = document.getElementById('auditPlaceholder');
  var tc = document.getElementById('auditTwoCol');
  var fp = document.getElementById('auditFullPanel');
  if (ph) { ph.style.display = 'block'; ph.innerHTML = '<div class="mkt-empty-card" style="color:var(--red);border-color:var(--red)">采集失败：' + escHtml(msg || '未知错误') + '</div>'; }
  if (tc) tc.style.display = 'none';
  if (fp) fp.style.display = 'none';
}

function auditRenderAll(data) {
  AUDIT_STATE.data = data;
  var ph = document.getElementById('auditPlaceholder');
  if (ph) ph.style.display = 'none';
  // Always render sidebar (used when overview tab is active)
  renderAuditSidebar(data);
  // Show appropriate panel for current tab
  switchAuditTab(AUDIT_STATE.tab || 'overview');
}

// ── Helper: compact audit check row ──
function _auditCheckCard(c) {
  var iconMap = {pass: '&#x2705;', fail: '&#x274C;', warn: '&#x26A0;', na: '&#x2014;'};
  var clsMap = {pass: 'mkt-pass', fail: 'mkt-fail', warn: 'mkt-warn', na: ''};
  var icon = iconMap[c.result] || '?';
  var sug = (c.result === 'fail' || c.result === 'warn')
    ? '<div style="font-size:.68rem;color:var(--accent2);margin-top:3px;padding-left:22px">\u2192 ' + escHtml(c.suggestion || '') + '</div>' : '';
  return '<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:.72rem">' +
    '<span class="' + (clsMap[c.result] || '') + '" style="margin-right:4px">' + icon + '</span>' +
    '<strong>' + escHtml(c.label || '') + '</strong>' +
    ' <span style="color:var(--muted);font-size:.65rem">[' + escHtml(c.confidence || '') + ' ' + escHtml(c.data_source || '') + ']</span>' +
    '<div style="padding-left:22px;color:var(--text)">' + escHtml(c.description || '') + '</div>' + sug + '</div>';
}

function _renderAuditDim(data, tabKey, title, weight) {
  var vm = _mktVm(data, tabKey) || {};
  var checks = vm.checks || [];
  var summary = vm.summary || {};
  var sc = summary.score;
  var gr = summary.grade || '\u2014';
  var grColor = sc >= 80 ? 'var(--green)' : (sc >= 60 ? 'var(--accent2)' : 'var(--red)');
  var html = _mktSummaryBanner(data);
  html += '<div class="mkt-section-title">' + title + ' \u2014 权重 ' + weight + '%</div>';
  html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;background:var(--bg2);border-radius:6px;border:1px solid var(--border);margin-bottom:10px;font-size:.72rem">' +
    '<span style="font-weight:700">得分</span><span style="font-size:1.2rem;font-weight:800;color:' + grColor + '">' + (sc != null ? sc : '\u2014') + '</span>' +
    '<span style="color:var(--muted)">/100</span>' +
    '<span style="font-weight:700;color:' + grColor + ';padding:1px 8px;border:1px solid ' + grColor + ';border-radius:3px">' + gr + '</span>' +
    '<span style="color:var(--muted);margin-left:auto">' + (summary.passed || 0) + '/' + (summary.total || 0) + ' 通过</span></div>';
  if (checks.length) { checks.forEach(function(c){ html += _auditCheckCard(c); }); }
  else { html += '<div class="mkt-empty-card">检查项将在评估引擎中生成</div>'; }
  return html;
}

// ── Audit Tab 1: 总览 ──
// ── Left Sidebar (overview tab only) ──
function renderAuditSidebar(data) {
  var vm = _mktVm(data, 'overview_tab') || {};
  var summary = vm.summary || {};
  var dimensions = data.view_model ? (data.view_model.dimensions || {}) : {};
  var sc = summary.overall_score || 0;
  var gr = summary.overall_grade || '—';
  var grColor = sc >= 80 ? 'var(--green)' : (sc >= 60 ? 'var(--accent2)' : 'var(--red)');

  var html = _mktSummaryBanner(data);

  // Score card with progress bar
  html += '<div style="padding:12px;margin-bottom:10px;background:var(--bg2);border-radius:8px;border:1px solid var(--border)">' +
    '<div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px">' +
      '<span style="font-size:2.4rem;font-weight:800;color:' + grColor + ';line-height:1">' + sc + '</span>' +
      '<span style="font-size:.7rem;color:var(--muted)">/ 100</span>' +
      '<span style="margin-left:auto;font-size:.85rem;font-weight:700;color:' + grColor + ';padding:2px 10px;border:2px solid ' + grColor + ';border-radius:4px">' + gr + '</span>' +
    '</div>' +
    '<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">' +
      '<div style="height:100%;width:' + Math.min(sc,100) + '%;background:' + grColor + ';border-radius:2px;transition:width .3s"></div>' +
    '</div>' +
    '<div style="font-size:.6rem;color:var(--muted);margin-top:4px">8 维度加权评分 · 42 项检查</div></div>';

  // Dimension bars (visual progress bars, clickable)
  var dimKeys = ['title','bullets','images','aplus','reviews','keywords','category','pricing'];
  var dimNames = {title:'标题', bullets:'五点', images:'图片', aplus:'A+', reviews:'评论', keywords:'关键词', category:'类目', pricing:'定价'};
  var dimWeights = {title:15, bullets:15, images:15, aplus:10, reviews:15, keywords:10, category:10, pricing:10};
  var bars = '';
  dimKeys.forEach(function(key){
    var d = dimensions[key] || {};
    var s = d.score != null ? d.score : 0;
    var g2 = d.grade || '—';
    var sc2 = Number(s) || 0;
    var color = sc2 >= 80 ? 'var(--green)' : (sc2 >= 60 ? 'var(--accent2)' : 'var(--red)');
    bars += '<div onclick="switchAuditTab(\'' + key + '\')" style="cursor:pointer;padding:7px 0;border-bottom:1px solid var(--border)" onmouseenter="this.style.background=\'var(--bg2)\'" onmouseleave="this.style.background=\'\'">' +
      '<div style="display:flex;align-items:center;margin-bottom:3px">' +
        '<span style="font-weight:600;font-size:.72rem;flex:1">' + escHtml(dimNames[key]) + '</span>' +
        '<span style="font-size:.65rem;color:var(--muted);margin-right:6px">权重 ' + dimWeights[key] + '%</span>' +
        '<span style="font-weight:700;font-size:.75rem;color:' + color + '">' + s + '</span>' +
        '<span style="font-size:.6rem;font-weight:600;color:' + color + ';margin-left:4px;padding:0 5px;border:1px solid ' + color + ';border-radius:3px">' + escHtml(g2) + '</span>' +
      '</div>' +
      '<div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden">' +
        '<div style="height:100%;width:' + Math.min(sc2,100) + '%;background:' + color + ';border-radius:2px"></div>' +
      '</div></div>';
  });
  html += '<div class="mkt-card" style="margin-bottom:10px"><div class="mkt-card-head">📊 维度得分 · 点击切换</div>' +
    '<div style="padding:0 4px">' + bars + '</div></div>';

  document.getElementById('auditOverviewLeft').innerHTML = html;
}

// ── Render detail panel based on selected tab ──
function renderAuditDetail(data, tab) {
  if (tab === 'overview') {
    var norm = _mktNz(data, 'context_product') || {};
    // KPI row: 4 metric cards
    var kpis = [
      {label:'BSR', val: norm.bsr ? '#' + norm.bsr : '—', sub: norm.bsr_label || '', color:'var(--accent)'},
      {label:'评分', val: norm.rating ? norm.rating + '' : '—', sub: '/ 5.0', color: norm.rating >= 4.5 ? 'var(--green)' : norm.rating >= 4.0 ? 'var(--accent2)' : 'var(--red)'},
      {label:'评论', val: norm.review_count ? _fmtNum(norm.review_count) : '—', sub: '', color:'var(--text)'},
      {label:'月销量', val: norm.monthly_sales ? _fmtNum(norm.monthly_sales) : '—', sub: '', color:'var(--accent)'}
    ];
    var html = '<div style="display:flex;gap:10px;margin-bottom:12px">';
    kpis.forEach(function(kpi){
      html += '<div style="flex:1;text-align:center;padding:10px 8px;background:var(--bg2);border-radius:8px;border:1px solid var(--border)">' +
        '<div style="font-size:.65rem;color:var(--muted);margin-bottom:2px">' + kpi.label + '</div>' +
        '<div style="font-size:1.1rem;font-weight:700;color:' + kpi.color + '">' + kpi.val + '</div>' +
        (kpi.sub ? '<div style="font-size:.6rem;color:var(--muted)">' + kpi.sub + '</div>' : '') +
      '</div>';
    });
    html += '</div>';

    // Product info card
    html += '<div class="mkt-card" style="margin-bottom:10px"><div class="mkt-card-head">📦 产品信息</div>' +
      '<table style="width:100%;font-size:.72rem;border-collapse:collapse">' +
      '<tr><td style="padding:6px 10px;color:var(--muted);width:60px">标题</td>' +
        '<td style="padding:6px 10px">' + escHtml(String(norm.title || '—').substring(0, 120)) + '</td></tr>' +
      '<tr style="background:var(--bg2)"><td style="padding:6px 10px;color:var(--muted)">品牌</td>' +
        '<td style="padding:6px 10px;font-weight:600">' + escHtml(norm.brand || '—') + '</td></tr>' +
      '<tr><td style="padding:6px 10px;color:var(--muted)">LQS</td>' +
        '<td style="padding:6px 10px">' + (norm.lqs || '—') + '</td></tr>' +
      '<tr style="background:var(--bg2)"><td style="padding:6px 10px;color:var(--muted)">配送</td>' +
        '<td style="padding:6px 10px">' + (norm.is_fba ? '<span style="color:var(--green);font-weight:600">✅ FBA</span>' : 'FBM') + '</td></tr>' +
      '</table></div>';

    // Priority fixes (moved to right panel below product info)
    var ov = _mktVm(data, 'overview_tab') || {};
    var fixes = ov.priority_fixes || [];
    if (fixes.length) {
      html += '<div class="mkt-card" style="margin-bottom:10px"><div class="mkt-card-head">🚨 优先修复 (' + fixes.length + ')</div>';
      fixes.forEach(function(f){
        var sev = f.severity === 'critical' ? '🔴' : '🟠';
        html += '<div style="padding:5px 10px;border-bottom:1px solid var(--border);font-size:.7rem;cursor:pointer" onclick="switchAuditTab(\'' + (f.dimension || 'overview') + '\')">' +
          sev + ' <strong>' + escHtml((f.issue || '').substring(0, 80)) + '</strong>' +
          '<div style="color:var(--accent2);padding-left:18px;font-size:.65rem">→ ' + escHtml((f.suggestion || '').substring(0, 80)) + '</div></div>';
      });
      html += '</div>';
    }

    // Provenance
    var provenance = data.provenance || [];
    if (provenance.length) {
      html += '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:.72rem;color:var(--muted)">📡 数据来源（共 ' + provenance.length + ' 次 MCP 调用）</summary>' +
        '<div class="mkt-filter-table" style="margin-top:8px"><table><tr><th>数据源</th><th>工具</th><th>备注</th></tr>' +
        provenance.map(function(p){
          return '<tr><td style="font-weight:600">' + escHtml(p.source_vendor || '') + '</td><td>' + escHtml(p.source_tool || '') + '</td><td style="color:var(--muted);font-size:.65rem">' + escHtml(p.notes || '') + '</td></tr>';
        }).join('') + '</table></div></details>';
    }
    document.getElementById('auditDetailRight').innerHTML = html;
    return;
  }

  // Dimension tabs: full-width panel
  var tabMap = {title:'title_tab', bullets:'bullets_tab', images:'images_tab', aplus:'aplus_tab', reviews:'reviews_tab', keywords:'keywords_tab', category:'category_tab', pricing:'pricing_tab'};
  var titles = {title:'📝 标题审核', bullets:'📋 五点审核', images:'🖼 图片审核', aplus:'⭐ A+审核', reviews:'💬 评论审核', keywords:'🔑 关键词审核', category:'📂 类目审核', pricing:'💰 定价审核'};
  var weights = {title:15, bullets:15, images:15, aplus:10, reviews:15, keywords:10, category:10, pricing:10};
  var tabKey = tabMap[tab];
  if (!tabKey) return;
  var vm = _mktVm(data, tabKey) || {};
  var html = _renderAuditDimContent(data, tabKey, titles[tab], weights[tab]);

  // Tab-specific extras
  if (tab === 'title') {
    var ss = vm.ss || {};
    html += '<div class="mkt-section-title" style="margin-top:10px">参考数据</div>' +
      '<div style="font-size:.7rem;color:var(--muted)">标题长度: <b>' + (ss.title_length || '—') + ' 字符</b> · 品牌位置: <b>' + (ss.brand_position || '—') + '</b> · LQS: <b>' + (ss.lqs || '—') + '</b></div>';
  } else if (tab === 'bullets') {
    var ss2 = vm.ss || {};
    var preview = ss2.bullets_preview || [];
    if (preview.length) {
      html += '<div class="mkt-section-title" style="margin-top:10px">五点原文</div><div class="mkt-card" style="font-size:.7rem">' +
        preview.map(function(b,i){ return '<div style="padding:4px 0;border-bottom:1px solid var(--border)">'+(i+1)+'. '+escHtml(b)+'</div>'; }).join('') + '</div>';
    } else {
      html += '<div style="font-size:.7rem;color:var(--muted);padding:8px 0">五点数量: <b>' + (ss2.bullet_count || '—') + ' 条</b> · LQS: <b>' + (ss2.lqs || '—') + '</b></div>';
    }
  } else if (tab === 'images') {
    var info = vm.info || {};
    html += '<div class="mkt-section-title" style="margin-top:10px">参考数据</div>' +
      '<div style="font-size:.7rem;color:var(--muted)">图片数: <b>' + (info.image_count || '—') + '</b> · 视频: <b>' + (info.video_count || '—') + '</b> · 360: <b>' + (info.has_360_view ? '有' : '无') + '</b></div>';
  } else if (tab === 'reviews') {
    var posList = vm.positives_preview || [];
    var negList = vm.negatives_preview || [];
    if (posList.length || negList.length) {
      html += '<div class="mkt-section-title" style="margin-top:10px">评论采样</div>';
      if (posList.length) html += '<div class="mkt-card" style="margin-bottom:6px"><div class="mkt-card-head" style="color:var(--green)">👍 好评 Top5</div>' +
        posList.map(function(t,i){ return '<div style="padding:3px 0;border-bottom:1px solid var(--border);font-size:.7rem">'+(i+1)+'. '+escHtml(t)+'</div>'; }).join('') + '</div>';
      if (negList.length) html += '<div class="mkt-card" style="margin-bottom:6px"><div class="mkt-card-head" style="color:var(--red)">👎 差评 Top5</div>' +
        negList.map(function(t,i){ return '<div style="padding:3px 0;border-bottom:1px solid var(--border);font-size:.7rem">'+(i+1)+'. '+escHtml(t)+'</div>'; }).join('') + '</div>';
    }
  } else if (tab === 'keywords') {
    var sif = vm.sif || {};
    var healthDist = sif.health_distribution || {};
    var chips = '';
    for (var h in healthDist) {
      if (healthDist[h] > 0) chips += '<span class="mkt-kw-chip ' + h + '" style="margin:2px">' + h + '：' + healthDist[h] + '</span>';
    }
    html += '<div style="padding:6px 0;margin-bottom:6px">' + (chips || '—') + '</div>';
    var topKws = sif.top_keywords || [];
    if (topKws.length) {
      html += '<div class="mkt-section-title">🔑 核心关键词</div><div class="mkt-filter-table"><table>' +
        '<tr><th>关键词</th><th>健康</th><th>排名趋势</th><th>点击份额</th></tr>' +
        topKws.slice(0, 20).map(function(k){
          return '<tr><td>' + escHtml(k.keyword || '') + '</td>' +
            '<td><span class="mkt-kw-chip ' + (k.health || '') + '">' + escHtml(k.health || '') + '</span></td>' +
            '<td>' + escHtml(k.rank_evolution || '') + '</td>' +
            '<td>' + (k.click_share != null ? _fmtPct(k.click_share) : '—') + '</td></tr>';
        }).join('') + '</table></div>';
    }
    var excKws = vm.competitor_exclusive_kws || [];
    if (excKws.length) {
      html += '<div class="mkt-section-title" style="margin-top:10px">⚠ 竞品独占词 (' + excKws.length + ')</div>' +
        '<div class="mkt-filter-table"><table><tr><th>关键词</th><th>竞品 ASIN</th></tr>' +
        excKws.map(function(e){
          return '<tr><td><span class="mkt-kw-chip at_risk">' + escHtml(e.keyword || '') + '</span></td><td>' + escHtml((e.found_on || []).join(', ')) + '</td></tr>';
        }).join('') + '</table></div>';
    }
  } else if (tab === 'category') {
    var cData = vm.data || {};
    var demand = vm.demand || {};
    var subcats = cData.subcategories || [];
    if (subcats.length) {
      html += '<div class="mkt-section-title" style="margin-top:10px">类目路径</div>' +
        '<div style="font-size:.72rem;padding:4px 0">' + escHtml(subcats.join(' → ') || '—') + '</div>';
    }
    html += '<div style="font-size:.7rem;color:var(--muted);padding:4px 0;margin-top:4px">' +
      '需求方向: <b>' + escHtml(demand.direction || '—') + '</b> · ' +
      '生命周期: <b>' + escHtml(demand.lifecycle_stage || '—') + '</b> · ' +
      '动量: <b>' + escHtml(demand.momentum || '—') + '</b></div>';
  } else if (tab === 'pricing') {
    var pData = vm.data || {};
    var competitors = vm.competitors || [];
    html += '<div style="font-size:.7rem;color:var(--muted);padding:4px 0;margin-bottom:6px">' +
      '售价: <b>$' + (pData.price || '—') + '</b> · ' +
      '毛利率: <b>' + (pData.profit_margin != null ? _fmtPct(pData.profit_margin) : '—') + '</b> · ' +
      '历史最低/最高: <b>$' + (pData.price_min || '—') + ' / $' + (pData.price_max || '—') + '</b></div>';
    if (competitors.length) {
      html += '<div class="mkt-section-title" style="margin-top:10px">竞品价格对比</div>' +
        '<div class="mkt-filter-table"><table><tr><th>#</th><th>ASIN</th><th>标题</th><th>价格</th><th>评分</th><th>评论</th></tr>' +
        competitors.map(function(c, i){
          return '<tr><td>' + (i+1) + '</td><td>' + escHtml(c.asin || '') + '</td>' +
            '<td style="font-size:.7rem">' + escHtml((c.title || '').substring(0,35) + ((c.title||'').length>35?'…':'')) + '</td>' +
            '<td>$' + (c.price != null ? c.price : '—') + '</td>' +
            '<td>' + (c.rating != null ? c.rating : '—') + '</td>' +
            '<td>' + (c.review_count != null ? _fmtNum(c.review_count) : '—') + '</td></tr>';
        }).join('') + '</table></div>';
    }
  }

  document.getElementById('auditFullPanel').innerHTML = html;
  document.getElementById('auditFullPanel').scrollTop = 0;
}

// ── Dimension content helper (without summary banner) ──
function _renderAuditDimContent(data, tabKey, title, weight) {
  var vm = _mktVm(data, tabKey) || {};
  var checks = vm.checks || [];
  var summary = vm.summary || {};
  var sc = summary.score;
  var gr = summary.grade || '—';
  var grColor = sc >= 80 ? 'var(--green)' : (sc >= 60 ? 'var(--accent2)' : 'var(--red)');
  var html = '<div class="mkt-section-title">' + title + ' — 权重 ' + weight + '%</div>';
  html += '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;background:var(--bg2);border-radius:6px;border:1px solid var(--border);margin-bottom:10px;font-size:.72rem">' +
    '<span style="font-weight:700">得分</span><span style="font-size:1.2rem;font-weight:800;color:' + grColor + '">' + (sc != null ? sc : '—') + '</span>' +
    '<span style="color:var(--muted)">/100</span>' +
    '<span style="font-weight:700;color:' + grColor + ';padding:1px 8px;border:1px solid ' + grColor + ';border-radius:3px">' + gr + '</span>' +
    '<span style="color:var(--muted);margin-left:auto">' + (summary.passed || 0) + '/' + (summary.total || 0) + ' 通过</span></div>';
  if (checks.length) { checks.forEach(function(c){ html += _auditCheckCard(c); }); }
  else { html += '<div class="mkt-empty-card">检查项将在评估引擎中生成</div>'; }
  return html;
}

