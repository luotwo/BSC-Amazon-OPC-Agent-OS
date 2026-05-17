// ═══════════════════════════════════════════════════════════
// Replenishment + Packaging (补货计划 + 包装建议)
// ═══════════════════════════════════════════════════════════
var REPL_STATE = { data: null, tab: 'overview' };

// ═══ Data Source Badges ═══
function updateReplSourceBadges() {
  fetch('/api/settings').then(function(r){return r.json();}).then(function(cfg){
    var sif = cfg.sif_mcp || {};
    var el = document.getElementById('replSrcSif');
    if (el) {
      if (sif.enabled && sif.endpoint && sif.api_key) { el.className = 'mkt-src-tag active'; el.textContent = 'SIF MCP：已连接'; }
      else if (sif.enabled) { el.className = 'mkt-src-tag warn'; el.textContent = 'SIF MCP：缺密钥/链接'; }
      else { el.className = 'mkt-src-off'; el.textContent = 'SIF MCP：未开启'; }
    }
  }).catch(function(){});
}

function updatePackSourceBadges() {
  fetch('/api/settings').then(function(r){return r.json();}).then(function(cfg){
    var st = cfg.sorftime_mcp || {};
    var el = document.getElementById('packSrcSt');
    if (el) {
      if (st.enabled && st.endpoint && st.api_key) { el.className = 'mkt-src-tag active'; el.textContent = 'Sorftime MCP：已连接'; }
      else if (st.enabled) { el.className = 'mkt-src-tag warn'; el.textContent = 'Sorftime MCP：缺密钥/链接'; }
      else { el.className = 'mkt-src-off'; el.textContent = 'Sorftime MCP：未开启'; }
    }
  }).catch(function(){});
}

// ═══ Replenishment ═══
function switchReplSubTab(tab) {
  REPL_STATE.tab = tab;
  document.querySelectorAll('#replSubTabs .expert-tab').forEach(function(t){t.classList.remove('active');});
  var labels = {overview:'补货总览', variants:'变体明细', trend:'销量趋势', plan:'补货计划'};
  var btns = document.querySelectorAll('#replSubTabs .expert-tab');
  for (var i = 0; i < btns.length; i++) { if (btns[i].textContent.indexOf(labels[tab]) !== -1) btns[i].classList.add('active'); }
  ['replSubOverview','replSubVariants','replSubTrend','replSubPlan'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var elMap = {overview:'replSubOverview', variants:'replSubVariants', trend:'replSubTrend', plan:'replSubPlan'};
  var target = document.getElementById(elMap[tab]);
  if (target) target.style.display = 'block';
  if (REPL_STATE.data) renderReplSubTab(tab, REPL_STATE.data);
}

function startReplenishment() {
  var asin = document.getElementById('replAsin').value.trim();
  var mp = document.getElementById('replMarketplace').value;
  if (!mp) { showToast('请选择站点'); return; }
  if (!asin || !/^[A-Za-z0-9]{5,15}$/.test(asin)) { showToast('ASIN格式错误'); return; }
  updateReplSourceBadges();
  showToast('正在分析补货数据，预计 10-20 秒，请耐心等待…', 'info');
  var btn = document.querySelector('#mainTabReplenishment .btn-mkt-start');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 分析中...'; }
  var ph = document.getElementById('replPlaceholder');
  var tabs = document.getElementById('replSubTabs');
  if (ph) ph.style.display = 'none';
  ['replSubOverview','replSubVariants','replSubTrend','replSubPlan'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在计算补货计划...</div></div>';
  });
  if (tabs) tabs.style.display = 'flex';

  fetch('/api/replenishment/repl_' + Date.now().toString(36) + '?asin=' + encodeURIComponent(asin) + '&marketplace=' + encodeURIComponent(mp))
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (btn) { btn.disabled = false; btn.textContent = '▶ 开始分析'; }
      if (data.error) { showToast(data.error); if (ph) { ph.style.display = 'block'; ph.innerHTML = '<div style="color:var(--red);padding:20px">' + escHtml(data.error) + '</div>'; } return; }
      REPL_STATE.data = data;
      ['overview','variants','trend','plan'].forEach(function(t){ renderReplSubTab(t, data); });
      document.getElementById('replSubOverview').style.display = 'block';
    })
    .catch(function(err){
      if (btn) { btn.disabled = false; btn.textContent = '▶ 开始分析'; }
      showToast('请求失败');
    });
}

function renderReplSubTab(tab, data) {
  var elMap = {overview:'replSubOverview', variants:'replSubVariants', trend:'replSubTrend', plan:'replSubPlan'};
  var el = document.getElementById(elMap[tab]);
  if (!el) return;
  var summary = data.summary || {};
  var variants = data.variants || [];

  if (tab === 'overview') {
    var urgentCnt = summary.urgent_count || 0;
    var soonCnt = summary.soon_count || 0;
    var html = '<div class="metric-cards">';
    html += '<div class="metric-card"><div class="metric-value">' + (summary.total_sold_30d || 0) + '</div><div class="metric-label">近30天销量</div></div>';
    html += '<div class="metric-card"><div class="metric-value">' + (summary.daily_avg || 0) + '</div><div class="metric-label">日均销量</div></div>';
    html += '<div class="metric-card" style="' + (urgentCnt > 0 ? 'border-color:#e74c3c;' : '') + '"><div class="metric-value" style="' + (urgentCnt > 0 ? 'color:#e74c3c;' : '') + '">' + urgentCnt + '</div><div class="metric-label">紧急补货</div></div>';
    html += '<div class="metric-card"><div class="metric-value">' + soonCnt + '</div><div class="metric-label">即将补货</div></div>';
    html += '</div>';
    html += '<div class="mkt-card"><div class="mkt-card-head">补货参数</div>';
    html += '<div style="font-size:.72rem;color:var(--text)">预计货期: <b>' + (summary.lead_time_days || 25) + '天</b> &middot; 安全库存: <b>' + (summary.safety_stock_days || 15) + '天</b> &middot; 建议总补货量: <b>' + (summary.total_recommended_qty || 0) + ' 件</b></div>';
    html += '<div style="font-size:.65rem;color:var(--muted);margin-top:4px">优先级基于销量占比：高流量(>=8%) / 中流量(>=3%) / 常规(<3%)。实际库存水平需在 Seller Central 确认。</div></div>';
    el.innerHTML = html;
  } else if (tab === 'variants') {
    var html = '';
    if (variants.length) {
      html = '<div class="mkt-filter-table"><table><thead><tr><th>ASIN</th><th>30天销量</th><th>日均</th><th>销量占比</th><th>建议补货</th><th>优先级</th></tr></thead><tbody>';
      variants.forEach(function(v){
        var urgColor = v.restock_urgency === 'urgent' ? '#e74c3c' : v.restock_urgency === 'soon' ? '#f5a623' : '#27ae60';
        var urgLabel = {urgent:'高流量', soon:'中流量', ok:'常规'}[v.restock_urgency] || '';
        html += '<tr><td style="font-size:.65rem">' + escHtml(v.asin || '') + '</td><td>' + (v.sold_30d || 0) + '</td><td>' + (v.daily_avg || 0) + '</td><td>' + (v.share_of_total_pct != null ? v.share_of_total_pct + '%' : '—') + '</td><td>' + (v.recommended_qty || 0) + '</td><td style="color:' + urgColor + ';font-weight:600">' + urgLabel + '</td></tr>';
      });
      html += '</tbody></table></div>';
    } else { html = '<div class="empty">暂无变体数据</div>'; }
    el.innerHTML = html;
  } else if (tab === 'trend') {
    var trend = summary.monthly_trend || [];
    var html = '';
    if (trend.length) {
      html = '<div class="mkt-card"><div class="mkt-card-head">月度销量趋势</div><div class="mkt-filter-table"><table><thead><tr><th>月份</th><th>销量</th></tr></thead><tbody>';
      trend.forEach(function(t){ html += '<tr><td>' + escHtml(t.month || '') + '</td><td>' + (t.sales || 0) + '</td></tr>'; });
      html += '</tbody></table></div></div>';
    } else { html = '<div class="empty">暂无趋势数据</div>'; }
    el.innerHTML = html;
  } else if (tab === 'plan') {
    var html = '<div class="mkt-card"><div class="mkt-card-head">FBA 补货计划</div>';
    html += '<div style="font-size:.72rem;color:var(--text)">建议总补货: <b>' + (summary.total_recommended_qty || 0) + ' 件</b></div>';
    html += '<div style="font-size:.72rem;color:var(--muted);margin-top:4px">FBA 90天容量估算: ' + (summary.estimated_fba_capacity || 0) + ' 件</div></div>';
    if (variants.length) {
      var urgent = variants.filter(function(v){ return v.restock_urgency !== 'ok'; });
      if (urgent.length) {
        html += '<div class="mkt-filter-table" style="margin-top:8px"><table><thead><tr><th>ASIN</th><th>补货点</th><th>建议量</th><th>安全库存</th></tr></thead><tbody>';
        urgent.slice(0, 15).forEach(function(v){
          html += '<tr><td style="font-size:.65rem">' + escHtml(v.asin || '') + '</td><td>' + (v.reorder_point || 0) + '</td><td>' + (v.recommended_qty || 0) + '</td><td>' + (v.safety_stock || 0) + '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
    }
    el.innerHTML = html;
  }
}

// ═══ Packaging Suggestions ═══
var PACK_DATA = null;

function startPackaging() {
  var asin = document.getElementById('packAsin').value.trim();
  var mp = document.getElementById('packMarketplace').value;
  if (!mp) { showToast('请选择站点'); return; }
  if (!asin || !/^[A-Za-z0-9]{5,15}$/.test(asin)) { showToast('ASIN格式错误'); return; }
  updatePackSourceBadges();
  showToast('正在分析产品包装方案，预计 10-15 秒，请耐心等待…', 'info');
  var btn2 = document.querySelector('#mainTabPackaging .btn-mkt-start');
  if (btn2) { btn2.disabled = true; btn2.textContent = '⏳ 分析中...'; }
  var ph = document.getElementById('packPlaceholder');
  var resultEl = document.getElementById('packResult');
  if (ph) ph.style.display = 'none';
  if (resultEl) resultEl.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在分析产品包装方案...</div></div>';

  fetch('/api/packaging-suggestions/pack_' + Date.now().toString(36) + '?asin=' + encodeURIComponent(asin) + '&marketplace=' + encodeURIComponent(mp))
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (btn2) { btn2.disabled = false; btn2.textContent = '▶ 开始分析'; }
      if (data.error) { showToast(data.error); if (ph) { ph.style.display = 'block'; ph.innerHTML = '<div style="color:var(--red);padding:20px">' + escHtml(data.error) + '</div>'; } return; }
      PACK_DATA = data;
      renderPackaging(data);
    })
    .catch(function(err){
      if (btn2) { btn2.disabled = false; btn2.textContent = '▶ 开始分析'; }
      showToast('请求失败');
    });
}

function renderPackaging(data) {
  var resultEl = document.getElementById('packResult');
  if (!resultEl) return;
  var suggestions = data.suggestions || [];
  var flags = data.product_type_flags || {};
  var prioColor = {urgent:'#e74c3c', high:'#f5a623', medium:'#3498db', low:'#95a5a6'};
  var prioLabel = {urgent:'紧急', high:'高优', medium:'中优', low:'参考'};
  var html = '';

  // Product type badges
  var badgeMap = {is_metal:'金属材质', is_solar:'太阳能', is_gift:'礼品定位'};
  var badges = [];
  for (var k in badgeMap) { if (flags[k]) badges.push(badgeMap[k]); }
  if (flags.brand) badges.unshift(flags.brand);
  if (badges.length) {
    html += '<div style="padding:8px 12px;margin-bottom:10px;background:var(--bg2);border-radius:8px;border:1px solid var(--border)">';
    html += '<span style="font-size:.72rem;color:var(--muted)">产品类型: </span>';
    badges.forEach(function(b){
      html += '<span style="display:inline-block;margin:2px 3px;padding:2px 8px;background:var(--accent);color:#fff;border-radius:10px;font-size:.68rem">' + escHtml(b) + '</span>';
    });
    html += '</div>';
  }

  if (suggestions.length) {
    var cats = {};
    suggestions.forEach(function(s){ var c = s.category || '其他'; if (!cats[c]) cats[c] = []; cats[c].push(s); });
    var catList = Object.keys(cats);
    catList.sort(function(a,b){
      var pa = Math.min.apply(null, cats[a].map(function(s){ return {urgent:0,high:1,medium:2,low:3}[s.priority] || 2; }));
      var pb = Math.min.apply(null, cats[b].map(function(s){ return {urgent:0,high:1,medium:2,low:3}[s.priority] || 2; }));
      return pa - pb;
    });
    catList.forEach(function(cat){
      var items = cats[cat];
      var catPrio = Math.min.apply(null, items.map(function(s){ return {urgent:0,high:1,medium:2,low:3}[s.priority] || 2; }));
      var catColor = prioColor[['urgent','high','medium','low'][catPrio]] || '#95a5a6';
      html += '<div class="mkt-card" style="margin-bottom:8px"><div class="mkt-card-head" style="color:' + catColor + '">' + escHtml(cat) + '</div>';
      items.forEach(function(s){
        var color = prioColor[s.priority] || '#95a5a6';
        var label = prioLabel[s.priority] || s.priority;
        html += '<div class="kanban-step" style="border-left:3px solid ' + color + '">';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">';
        html += '<span style="font-size:.65rem;background:' + color + ';color:#fff;padding:1px 6px;border-radius:8px;white-space:nowrap">' + label + '</span>';
        html += '<strong style="font-size:.76rem">' + escHtml(s.title || '') + '</strong></div>';
        if (s.detail) html += '<div style="font-size:.7rem;color:var(--muted);margin:2px 0">' + escHtml(s.detail) + '</div>';
        if (s.impact) html += '<div style="font-size:.68rem;color:#27ae60;margin:2px 0">预计效果: ' + escHtml(s.impact) + '</div>';
        if (s.keywords && s.keywords.length) html += '<div style="font-size:.64rem;color:var(--muted);margin:2px 0">关键词: ' + s.keywords.map(function(k){return escHtml(k);}).join(', ') + '</div>';
        html += '</div>';
      });
      html += '</div>';
    });
  } else {
    html += '<div class="empty">暂无包装建议数据</div>';
  }
  resultEl.innerHTML = html;
}
