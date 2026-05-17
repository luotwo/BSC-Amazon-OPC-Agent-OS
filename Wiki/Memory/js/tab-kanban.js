// ═══════════════════════════════════════════════════════════
// Kanban (执行步骤看板)
// ═══════════════════════════════════════════════════════════

function updateKanbanSourceBadges() {
  fetch('/api/settings').then(function(r){return r.json();}).then(function(cfg){
    [{id:'kanbanSrcSif', key:'sif_mcp'}, {id:'kanbanSrcSt', key:'sorftime_mcp'}, {id:'kanbanSrcSs', key:'sellersprite_mcp'}].forEach(function(item){
      var mcp = cfg[item.key] || {};
      var el = document.getElementById(item.id);
      if (!el) return;
      if (mcp.enabled && mcp.endpoint && mcp.api_key) { el.className = 'mkt-src-tag active'; el.textContent = (item.key === 'sif_mcp' ? 'SIF' : item.key === 'sorftime_mcp' ? 'Sorftime' : 'SellerSprite') + ' MCP：已连接'; }
      else if (mcp.enabled) { el.className = 'mkt-src-tag warn'; el.textContent = (item.key === 'sif_mcp' ? 'SIF' : item.key === 'sorftime_mcp' ? 'Sorftime' : 'SellerSprite') + ' MCP：缺密钥'; }
      else { el.textContent = (item.key === 'sif_mcp' ? 'SIF' : item.key === 'sorftime_mcp' ? 'Sorftime' : 'SellerSprite') + ' MCP：未开启'; }
    });
  }).catch(function(){});
}

function startKanban() {
  var asin = document.getElementById('kanbanAsin').value.trim();
  var mp = document.getElementById('kanbanMarketplace').value;
  if (!mp) { showToast('请选择站点'); return; }
  if (!asin || !/^[A-Za-z0-9]{5,15}$/.test(asin)) { showToast('ASIN格式错误'); return; }
  updateKanbanSourceBadges();
  showToast('正在聚合各模块分析数据，预计 5-15 秒，请耐心等待…', 'info');
  var btn = document.querySelector('#mainTabKanban .btn-mkt-start');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 分析中...'; }
  var ph = document.getElementById('kanbanPlaceholder');
  var resultEl = document.getElementById('kanbanResult');
  if (ph) ph.style.display = 'none';
  if (resultEl) resultEl.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在聚合各分析模块数据...</div><small style="color:var(--muted)">读取市场/广告/Listing/竞争/补货的已缓存 section 数据</small></div>';

  fetch('/api/kanban/kb_' + Date.now().toString(36) + '?asin=' + encodeURIComponent(asin) + '&marketplace=' + encodeURIComponent(mp))
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (btn) { btn.disabled = false; btn.textContent = '▶ 开始分析'; }
      if (data.error) { showToast(data.error); if (ph) { ph.style.display = 'block'; ph.innerHTML = '<div style="color:var(--red);padding:20px">' + escHtml(data.error) + '</div>'; } return; }
      renderKanban(data);
    })
    .catch(function(err){
      if (btn) { btn.disabled = false; btn.textContent = '▶ 开始分析'; }
      showToast('请求失败');
    });
}

function renderKanban(data) {
  var resultEl = document.getElementById('kanbanResult');
  if (!resultEl) return;
  var priorities = data.priorities || [];
  var prioColor = {urgent:'#e74c3c', high:'#f5a623', medium:'#3498db', low:'#95a5a6'};
  var prioLabel = {urgent:'紧急', high:'高优', medium:'中优', low:'参考'};
  var prioNum = {urgent:0, high:1, medium:2, low:3};
  var html = '';

  // Summary banner
  var urgentCnt = data.urgent_count || 0;
  var highCnt = data.high_count || 0;
  var medCnt = priorities.filter(function(p){ return p.priority === 'medium'; }).length;
  var bannerColor = urgentCnt >= 2 ? '#e74c3c' : (urgentCnt >= 1 || highCnt >= 3 ? '#f5a623' : '#27ae60');
  html += '<div style="padding:12px 16px;margin-bottom:12px;background:var(--bg2);border-radius:8px;border-left:4px solid ' + bannerColor + '">';
  html += '<div style="font-size:.82rem;font-weight:600;margin-bottom:6px">' + escHtml(data.summary || '运营优化看板') + '</div>';
  html += '<div style="display:flex;gap:12px;flex-wrap:wrap;font-size:.7rem">';
  if (urgentCnt) html += '<span style="color:#e74c3c;font-weight:600">紧急 ' + urgentCnt + ' 项</span>';
  if (highCnt) html += '<span style="color:#f5a623;font-weight:600">高优 ' + highCnt + ' 项</span>';
  if (medCnt) html += '<span style="color:#3498db">中优 ' + medCnt + ' 项</span>';
  html += '<span style="color:var(--muted)">共 ' + (data.total_actions || 0) + ' 项行动</span>';
  html += '</div>';

  // Data source status — show which tabs contributed
  var ds = data.data_status || {};
  var tabLabels = {market:'市场分析', ad:'广告分析', listing:'Listing审核', competition:'竞争分析', replenishment:'补货计划'};
  var statusHtml = '';
  for (var k in tabLabels) {
    var has = ds[k];
    statusHtml += '<span style="display:inline-block;margin:3px 4px;padding:2px 7px;border-radius:10px;font-size:.62rem;' +
      (has ? 'background:rgba(34,197,94,.15);color:#22c55e' : 'background:rgba(148,163,184,.1);color:#8892a4') + '">' +
      (has ? 'OK ' : '- ') + tabLabels[k] + '</span>';
  }
  html += '<div style="margin-top:6px;font-size:.62rem;color:var(--muted)">数据缓存状态: ' + statusHtml + '</div>';
  html += '</div>';

  // Priority items grouped by category
  if (priorities.length) {
    var groups = {};
    var catMaxPrio = {};
    priorities.forEach(function(p){
      var cat = p.category || '其他';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
      var pn = prioNum[p.priority] !== undefined ? prioNum[p.priority] : 2;
      if (catMaxPrio[cat] === undefined || pn < catMaxPrio[cat]) catMaxPrio[cat] = pn;
    });
    var sortedCats = Object.keys(groups).sort(function(a,b){ return (catMaxPrio[a]||2) - (catMaxPrio[b]||2); });

    sortedCats.forEach(function(cat){
      var items = groups[cat];
      var catColor = prioColor[['urgent','high','medium','low'][catMaxPrio[cat] || 2]] || '#95a5a6';
      html += '<div class="mkt-card" style="margin-bottom:8px"><div class="mkt-card-head" style="color:' + catColor + '">' + escHtml(cat) + ' (' + items.length + ')</div>';
      items.forEach(function(p){
        var color = prioColor[p.priority] || '#95a5a6';
        var label = prioLabel[p.priority] || p.priority;
        html += '<div class="kanban-step" style="border-left:3px solid ' + color + '">';
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">';
        html += '<span style="font-size:.65rem;background:' + color + ';color:#fff;padding:1px 6px;border-radius:8px;white-space:nowrap">' + label + '</span>';
        html += '<strong style="font-size:.76rem">' + escHtml(p.action || '') + '</strong></div>';
        if (p.detail) html += '<div style="font-size:.7rem;color:var(--muted);margin:2px 0">' + escHtml(p.detail) + '</div>';
        if (p.expected_impact) html += '<div style="font-size:.68rem;color:#27ae60;margin:2px 0">预计效果: ' + escHtml(p.expected_impact) + '</div>';
        if (p.data_ref) html += '<div style="font-size:.64rem;color:var(--muted);margin:2px 0;font-style:italic">来源: ' + escHtml(p.data_ref) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    });
  } else {
    html += '<div class="empty">数据采集完成后将自动生成优化清单<br><small>请确保已完成市场、关键词、广告、Listing、补货等数据分析</small></div>';
  }
  resultEl.innerHTML = html;
}
