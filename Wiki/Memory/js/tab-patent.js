
// ═══════════════════════════════════════════════════════════════
// Patent / Trademark Analysis (SellerSprite global/brand REST API)
// ═══════════════════════════════════════════════════════════════

var PT_STATE = { data: null, jobId: null, subTab: 'search' };

function updatePatentSourceBadges(cfg) {
  cfg = cfg || {};
  var ss = cfg.sellersprite_mcp || {};
  var el = document.getElementById('ptSrcSs');
  if (!el) return;
  var hasCreds = !!(ss.endpoint && ss.api_key);
  var enabled = !!ss.enabled;
  var cls = enabled && hasCreds ? 'mkt-src-on' : enabled ? 'mkt-src-incomplete' : 'mkt-src-off';
  var icon = enabled && hasCreds ? '✅' : enabled ? '⚠️' : '⛔';
  el.textContent = icon + ' SellerSprite 全球商标库：' + (enabled ? (hasCreds ? '已开启' : '缺Key') : '未开启');
  el.className = 'mkt-src-tag ' + cls;
}

async function getPatentSettings() {
  try {
    var r = await fetch('/api/settings'); if (!r.ok) return;
    updatePatentSourceBadges(await r.json());
  } catch(e) {}
}

function switchPatentTab(tab) {
  PT_STATE.subTab = tab;
  ['search','detail','stats'].forEach(function(t) {
    var el = document.getElementById('patentTab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  var tabs = document.querySelectorAll('#patentSubTabs .expert-tab');
  tabs.forEach(function(btn) { btn.classList.remove('active'); });
  var activeBtn = document.querySelector('#patentSubTabs [onclick*="' + tab + '"]');
  if (activeBtn) activeBtn.classList.add('active');
}

async function startPatentAnalysis() {
  var keyword = document.getElementById('ptKeyword').value.trim();
  var office = document.getElementById('ptOffice').value;
  var page = parseInt(document.getElementById('ptPage').value) || 1;
  if (!keyword) { showToast('请输入品牌名或关键词'); return; }

  try { await getPatentSettings(); } catch(e) {}
  var loadingEl = document.getElementById('patentTabSearch');
  loadingEl.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在查询全球商标库...</div></div>';
  switchPatentTab('search');

  PT_STATE.jobId = 'pt' + Date.now().toString(36) + Math.random().toString(36).substr(2,6);
  var qs = '?keyword=' + encodeURIComponent(keyword) + '&office=' + encodeURIComponent(office) + '&page=' + page + '&size=20';
  var url = '/api/patent-analysis/' + PT_STATE.jobId + qs;

  try {
    var r = await fetch(url); var data = await r.json();
    if (data.errors && data.errors._all) { loadingEl.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">' + escHtml(data.errors._all) + '</div>'; return; }
    PT_STATE.data = data;
    renderPatentSearch(data);
    renderPatentStats(data);
  } catch(e) {
    loadingEl.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">请求失败：' + escHtml(e.message) + '</div>';
  }
}

// ── Tab 1: Trademark Search ──

function renderPatentSearch(data) {
  var el = document.getElementById('patentTabSearch');
  if (!el) return;
  var items = (data.brand_list && data.brand_list.items) || [];
  var total = (data.brand_list && data.brand_list.total) || 0;
  var page = (data.brand_list && data.brand_list.page) || 1;

  if (!items.length) {
    var errMsg = (data.errors && data.errors.list) || '未找到商标记录';
    el.innerHTML = '<div class="mkt-empty-card">' + escHtml(errMsg) + '</div>';
    return;
  }

  var rows = items.map(function(it, i) {
    var logoHtml = it.logoUrl
      ? '<img src="' + escHtml(it.logoUrl) + '" style="width:40px;height:40px;object-fit:contain;border-radius:4px;background:var(--bg)" onerror="this.style.display=\'none\'">'
      : '—';
    var brandName = (it.brandName && it.brandName.length) ? it.brandName.join(', ') : '—';
    var applicant = (it.applicant && it.applicant.length) ? it.applicant.join(', ') : '—';
    var statusColor = it.status === 'Registered' ? 'var(--green)' : it.status === 'Pending' ? '#f59e0b' : 'var(--text-muted)';
    var niceClass = (it.niceClass && it.niceClass.length) ? it.niceClass.join(', ') : '—';
    return '<tr>' +
      '<td>' + logoHtml + '</td>' +
      '<td style="font-weight:600">' + escHtml(brandName) + '</td>' +
      '<td>' + escHtml(applicant) + '</td>' +
      '<td><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.65rem;background:' + statusColor + ';color:#fff">' + escHtml(it.status || '—') + '</span></td>' +
      '<td>' + escHtml(niceClass) + '</td>' +
      '<td>' + escHtml(it.applicationDate || '—') + '</td>' +
      '<td>' + escHtml(it.registrationNumber || '—') + '</td>' +
      '<td><button class="btn-edit" onclick="patentLoadDetail(\'' + escHtml(it.id) + '\',\'' + escHtml(it.office || data.query.office) + '\')" style="font-size:0.7rem;padding:2px 8px">详情</button></td>' +
      '</tr>';
  }).join('');

  el.innerHTML =
    '<div class="mkt-card"><div class="mkt-card-head">商标列表 <small>共 ' + total + ' 条</small></div>' +
    '<div class="table-responsive"><table class="mkt-filter-table"><thead><tr>' +
    '<th>Logo</th><th>品牌名</th><th>申请人</th><th>状态</th><th>尼斯分类</th><th>申请日期</th><th>注册号</th><th>操作</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div></div>';
}

// ── Tab 2: Trademark Detail ──

async function patentLoadDetail(brandId, office) {
  var el = document.getElementById('patentTabDetail');
  if (!el) return;
  el.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在加载商标详情...</div></div>';
  switchPatentTab('detail');

  try {
    var detailJobId = 'ptd' + Date.now().toString(36);
    var qs = '?keyword=' + encodeURIComponent(PT_STATE.data.query.keyword || '') + '&office=' + encodeURIComponent(office || 'US') + '&brand_id=' + encodeURIComponent(brandId);
    var r = await fetch('/api/patent-analysis/' + detailJobId + qs);
    var detail = await r.json();
    renderPatentDetail(detail);
  } catch(e) {
    el.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">加载失败：' + escHtml(e.message) + '</div>';
  }
}

function renderPatentDetail(detail) {
  var el = document.getElementById('patentTabDetail');
  if (!el) return;
  var d = detail.detail || detail;
  if (!d || !d.id) { el.innerHTML = '<div class="mkt-empty-card">商标详情不可用</div>'; return; }

  var brandName = (d.brandName && d.brandName.length) ? d.brandName.join(', ') : '—';
  var applicant = (d.applicant && d.applicant.length) ? d.applicant.join(', ') : '—';
  var niceClass = (d.niceClass && d.niceClass.length) ? d.niceClass.join(', ') : '—';
  var logoHtml = d.logoUrl ? '<img src="' + escHtml(d.logoUrl) + '" style="max-width:120px;max-height:120px;object-fit:contain;border-radius:8px;background:var(--bg)">' : '';

  var statusColor = d.status === 'Registered' ? 'var(--green)' : d.status === 'Pending' ? '#f59e0b' : 'var(--text-muted)';

  var eventsHtml = '';
  if (d.events && d.events.length) {
    eventsHtml = d.events.map(function(ev) {
      return '<div style="padding:4px 0;border-bottom:1px solid var(--border)"><b>' + escHtml(ev.date || '') + '</b> ' + escHtml(ev.officeKind || ev.gbdKind || '') + '</div>';
    }).join('');
  }

  var markDescHtml = '';
  if (d.markDescriptionDetails && d.markDescriptionDetails.length) {
    markDescHtml = d.markDescriptionDetails.map(function(md) {
      return '<div style="padding:2px 0">' + escHtml(md.text || '') + ' <small>(' + escHtml(md.languageCode || '') + ')</small></div>';
    }).join('');
  }

  el.innerHTML =
    '<div class="mkt-card"><div class="mkt-card-head">' + logoHtml + ' ' + escHtml(brandName) + ' <small>' + escHtml(d.id || '') + '</small></div>' +
    '<div class="mkt-metric-row">' +
    _metric('申请人', applicant) +
    _metric('状态', '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.75rem;background:' + statusColor + ';color:#fff">' + escHtml(d.status || '—') + '</span>') +
    _metric('商标种类', escHtml(d.markFeature || '—')) +
    _metric('类型', escHtml(d.type || '—')) +
    _metric('申请日期', escHtml(d.applicationDate || '—')) +
    _metric('注册号', escHtml(d.registrationNumber || '—')) +
    _metric('注册日期', escHtml(d.registrationDate || '—')) +
    _metric('过期日期', escHtml(d.expiryDate || '—')) +
    _metric('尼斯分类', escHtml(niceClass)) +
    _metric('知识产权局', escHtml(d.office || '—')) +
    _metric('申请编号', escHtml(d.applicationNumber || '—')) +
    _metric('状态更新', escHtml(d.statusDate || '—')) +
    '</div></div>' +
    (eventsHtml ? '<div class="mkt-card"><div class="mkt-card-head">事件时间线</div>' + eventsHtml + '</div>' : '') +
    (markDescHtml ? '<div class="mkt-card"><div class="mkt-card-head">商标描述</div>' + markDescHtml + '</div>' : '');
}

// ── Tab 3: Statistics ──

function renderPatentStats(data) {
  var el = document.getElementById('patentTabStats');
  if (!el) return;
  var stats = data.stats || {};
  if (!stats || Object.keys(stats).length === 0) {
    el.innerHTML = '<div class="mkt-empty-card">' + escHtml((data.errors && data.errors.stats) || '暂无统计数据') + '</div>';
    return;
  }

  var dims = [
    {key: 'office', label: '知识产权局分布'},
    {key: 'status', label: '状态分布'},
    {key: 'brandName', label: '品牌名分布'},
    {key: 'applicant', label: '申请人分布'},
    {key: 'niceClass', label: '尼斯分类分布'},
    {key: 'applicationYear', label: '申请年份分布'},
    {key: 'expiryYear', label: '过期年份分布'}
  ];

  var cards = dims.map(function(dim) {
    var items = stats[dim.key] || [];
    if (!items.length) return '';
    var rows = items.slice(0, 15).map(function(it) {
      var label = it.label || it.key || '';
      if (dim.key === 'niceClass' && it.label) label = it.key + ' (' + it.label + ')';
      return '<tr><td>' + escHtml(label) + '</td><td style="text-align:right;font-weight:600">' + (it.count || 0) + '</td></tr>';
    }).join('');
    return '<div class="mkt-card"><div class="mkt-card-head">' + dim.label + ' <small>(' + items.length + ' 项)</small></div>' +
      '<table class="mkt-filter-table"><thead><tr><th>名称</th><th style="text-align:right">数量</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  }).filter(Boolean).join('');

  el.innerHTML = cards || '<div class="mkt-empty-card">暂无统计数据</div>';
}

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  getPatentSettings();
});
