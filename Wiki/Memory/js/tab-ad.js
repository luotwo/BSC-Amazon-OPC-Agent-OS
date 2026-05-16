// ── Ai Sub-tab Switch ──
function switchAiTab(level) {
  document.getElementById('aiSubTabs').style.display = 'flex';
  ['aiPanelL1','aiPanelL2','aiPanelL3'].forEach(function(id,i){ document.getElementById(id).style.display = (i+1===level)?'block':'none'; });
  ['aiTabBtnL1','aiTabBtnL2','aiTabBtnL3'].forEach(function(bid,i){ var b=document.getElementById(bid); b.classList.toggle('active',i+1===level); });
  ['aiTabBtnL2','aiTabBtnL3'].forEach(function(bid,i){ document.getElementById(bid).style.display = (i+1 < level || AD_INSPECT_STATE['level'+(i+2)+'_data']) ? 'inline-flex' : 'none'; });
}

// ── Ad Analysis Tab ──
function switchAdTab(tab) {
  document.querySelectorAll('#adSubTabs .expert-tab').forEach(function(t){t.classList.remove('active');});
  var panelIds = ['adTabDashboard','adTabCampaign','adTabKeyword','adTabSearchterm','adTabBidbudget','adTabPlacement','adTabCompete','adTabInspect'];
  panelIds.forEach(function(id){ document.getElementById(id).style.display = 'none'; });
  var tabMap = {dashboard:'adTabDashboard', campaign:'adTabCampaign', keyword:'adTabKeyword', searchterm:'adTabSearchterm', bidbudget:'adTabBidbudget', placement:'adTabPlacement', compete:'adTabCompete', inspect:'adTabInspect'};
  var labels = {dashboard:'绩效概览', campaign:'广告活动', keyword:'投放关键词', searchterm:'搜索词', bidbudget:'竞价预算', placement:'广告位', compete:'竞品广告', inspect:'查广告'};
  var btns = document.querySelectorAll('#adSubTabs .expert-tab');
  for (var i = 0; i < btns.length; i++) { if (btns[i].textContent.indexOf(labels[tab]) !== -1) btns[i].classList.add('active'); }
  document.getElementById(tabMap[tab]).style.display = 'block';
}

function updateAdSourceBadges(cfg) {
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
  setBadge('adSrcSif', 'SIF MCP', sif.enabled, !!(sif.endpoint && sif.api_key));
  setBadge('adSrcSt', 'Sorftime MCP', st.enabled, !!(st.endpoint && st.api_key));
  setBadge('adSrcSs', 'SellerSprite MCP', ss.enabled, !!(ss.endpoint && ss.api_key));
}

async function getAdSettings() {
  try {
    var r = await fetch('/api/settings'); if (!r.ok) return;
    var cfg = await r.json();
    updateAdSourceBadges(cfg);
  } catch(e) {}
}

async function startAdAnalysis() {
  var asin = document.getElementById('adAsin').value.trim();
  var country = document.getElementById('adCountry').value;
  if (!country) { showToast('请选择站点'); return; }
  if (!asin) { showToast('请输入 ASIN'); return; }
  if (!/^[A-Za-z0-9]{5,15}$/.test(asin)) { showToast('ASIN 格式错误（5-15 位字母数字）'); return; }

  try { await getAdSettings(); } catch(e) {}
  adShowLoading();

  var jobId = 'ad' + Date.now().toString(36) + Math.random().toString(36).substr(2,6);
  var qs = '?asin=' + encodeURIComponent(asin) +
           '&country=' + encodeURIComponent(country);

  fetch('/api/ad-analysis/' + jobId + qs)
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (data.error) { showToast('分析失败：' + data.error); adShowError(data.error); return; }
      adRenderAll(data);
    })
    .catch(function(err){
      showToast('请求失败：' + err.message);
      adShowError(err.message);
    });
}

function adShowLoading() {
  var html = '<div class="mkt-loading">' +
    '<div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>' +
    '<div style="margin-top:10px">正在按设置中的 MCP 开关采集广告数据...</div>' +
    '<small style="color:var(--muted)">站点 + ASIN/关键词 → SIF / Sorftime / SellerSprite，预计 10-30s</small></div>';
  ['adTabDashboard','adTabCampaign','adTabKeyword','adTabSearchterm','adTabBidbudget','adTabPlacement','adTabCompete','adTabInspect'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.innerHTML = html;
  });
}

function adShowError(msg) {
  var html = '<div class="mkt-empty-card" style="color:var(--red);border-color:var(--red)">采集失败：' + escHtml(msg || '未知错误') + '</div>';
  ['adTabDashboard','adTabCampaign','adTabKeyword','adTabSearchterm','adTabBidbudget','adTabPlacement','adTabCompete','adTabInspect'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.innerHTML = html;
  });
}

function adRenderAll(data) {
  renderAdDashboard(data);
  renderAdCampaign(data);
  renderAdKeyword(data);
  renderAdSearchterm(data);
  renderAdBidbudget(data);
  renderAdPlacement(data);
  renderAdCompete(data);
}
// ── Ad Tab 1: 仪表盘 ──
function renderAdDashboard(data) {
  var panel = document.getElementById('adTabDashboard');
  if (!panel) return;
  var d = data.dashboard || data;
  var html = '';

  // Stage badge + 9 metrics
  var stage = d.stage || '—';
  var stageLabel = stage === 'cold_start' ? '冷启动(0-30天)' : (stage === 'growing' ? '成长期(30-90天)' : (stage === 'mature' ? '成熟期(90天+)' : '—'));
  html += '<div class="mkt-section-title">&#x1F4CA; 仪表盘 <span class="badge" style="margin-left:8px;background:var(--accent);color:#fff">' + escHtml(stageLabel) + '</span></div>';

  // 9 KPI cards with colored accents
  var metrics = d.metrics || {};
  var m = [
    {k:'ACOS', v:metrics.acos, fmt:'pct', target:'<15%', good:15, warn:30},
    {k:'TACOS', v:metrics.tacos, fmt:'pct', target:'<5%', good:5, warn:10},
    {k:'自然占比', v:metrics.natural_ratio, fmt:'pct', target:'70%+', good:70, warn:40},
    {k:'广告CVR', v:metrics.ad_cvr, fmt:'pct', target:'>15%', good:15, warn:8},
    {k:'CTR', v:metrics.ctr, fmt:'pct', target:'>0.6%', good:0.6, warn:0.3},
    {k:'核心词自然位', v:metrics.core_rank, fmt:'raw', target:'首页'},
    {k:'BSR', v:metrics.bsr, fmt:'raw', target:'Top20'},
    {k:'评论数', v:metrics.reviews, fmt:'num', target:'100+'},
    {k:'评分', v:metrics.rating, fmt:'raw', target:'4.5+'}
  ];
  html += '<div class="mkt-col-grid" style="grid-template-columns:repeat(3,1fr);gap:8px">';
  m.forEach(function(item){
    var val = item.v !== undefined && item.v !== null ? item.v : null;
    var display = val !== null ? val : '—';
    if (item.fmt === 'pct' && typeof val === 'number') display = _fmtPct(val);
    else if (item.fmt === 'num' && typeof val === 'number') display = _fmtNum(val);
    var statusCls = '';
    if (item.good !== undefined && typeof val === 'number') {
      if (item.k === 'ACOS' || item.k === 'TACOS') statusCls = val <= item.good ? 'good' : (val <= item.warn ? 'warn' : 'bad');
      else statusCls = val >= item.good ? 'good' : (val >= item.warn ? 'warn' : 'bad');
    }
    var borderColors = {good:'var(--green)', warn:'var(--accent2)', bad:'var(--red)'};
    var bgColors = {good:'rgba(34,197,94,.06)', warn:'rgba(245,158,11,.06)', bad:'rgba(239,68,68,.06)'};
    var bc = borderColors[statusCls] || 'var(--border)';
    var bg = bgColors[statusCls] || 'var(--bg2)';
    html += '<div class="mkt-card" style="padding:8px 10px;border-left:3px solid ' + bc + ';background:' + bg + ';margin:0">' +
      '<div style="font-size:.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px">' + escHtml(item.k) + '</div>' +
      '<div style="font-size:1.1rem;font-weight:700;color:' + bc + '">' + escHtml(String(display)) + '</div>' +
      '<div style="font-size:.58rem;color:var(--muted);margin-top:2px">目标: ' + escHtml(item.target) + '</div>' +
      '</div>';
  });
  html += '</div>';

  // ACOS/TACOS matrix + Diagnostic
  var matrix = d.acos_tacos_matrix || '';
  var diag = d.diagnostic_chain || '';
  if (matrix || diag) {
    html += '<div class="mkt-col-grid" style="grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">';
    if (matrix) html += '<div class="mkt-card" style="margin:0"><div class="mkt-card-head" style="font-size:.72rem">&#x1F4CA; ACOS/TACOS 矩阵</div><div style="font-size:.7rem;padding:4px 0">' + escHtml(matrix) + '</div></div>';
    if (diag) html += '<div class="mkt-card" style="margin:0"><div class="mkt-card-head" style="font-size:.72rem">&#x1F50D; 五步诊断</div><div style="font-size:.7rem;padding:4px 0">' + escHtml(diag) + '</div></div>';
    html += '</div>';
  }

  // Channel breakdown
  var ch = d.channel_breakdown || {};
  if (Object.keys(ch).length) {
    html += '<div class="mkt-card"><div class="mkt-card-title">渠道拆解</div><div class="mkt-col-grid">';
    ['SP','SB','SBV','SD'].forEach(function(c){ if (ch[c] !== undefined) html += '<div class="mkt-metric"><span class="mkt-metric-label">' + c + '</span><span class="mkt-metric-value">' + _fmtPct(ch[c]) + '</span></div>'; });
    html += '</div></div>';
  }

  // Top campaigns
  var topCampaigns = _mktList(d.top_campaigns) || [];
  if (topCampaigns.length) {
    html += '<div class="mkt-card"><div class="mkt-card-title">Campaign 贡献 Top5</div><table class="mkt-filter-table"><tr><th>Campaign</th><th>类型</th><th>贡献等级</th><th>占比</th></tr>';
    topCampaigns.slice(0,5).forEach(function(c){
      html += '<tr><td>' + escHtml(c.name || c.campaign_display_id || c.campaign_id || '—') + '</td><td>' + escHtml(c.ad_type || '—') + '</td><td>' + escHtml(c.contribution_tier || '—') + '</td><td>' + (c.share !== undefined ? _fmtPct(c.share) : '—') + '</td></tr>';
    });
    html += '</table></div>';
  }

  // "Don't touch ads" warnings
  var warnings = Array.isArray(d.dont_touch_warnings) ? d.dont_touch_warnings : [];
  if (warnings.length) {
    html += '<div class="mkt-card" style="border-color:var(--accent2)"><div class="mkt-card-title" style="color:var(--accent2)">&#x26A0;&#xFE0F; 建议不动广告</div><ul style="margin:4px 0 0 16px;font-size:.72rem">';
    warnings.forEach(function(w){ html += '<li>' + escHtml(w) + '</li>'; });
    html += '</ul></div>';
  }

  panel.innerHTML = html;
}

// ── Ad Tab 2: 关键词 ──
function renderAdKeyword(data) {
  var panel = document.getElementById('adTabKeyword');
  if (!panel) return;
  var d = data.keywords || data;
  var html = '';

  // Four-color tier board
  var tiers = d.tier_counts || {};
  html += '<div class="mkt-section-title">&#x1F511; 关键词</div>';
  html += '<div class="mkt-col-grid">';
  [{k:'🔴 竞品主导',v:tiers.red||0,c:'var(--red)'},{k:'🟡 互相争夺',v:tiers.yellow||0,c:'var(--accent2)'},{k:'🟢 我方机会',v:tiers.green||0,c:'var(--green)'},{k:'🔵 蓝海词',v:tiers.blue||0,c:'var(--accent)'}].forEach(function(t){
    html += '<div class="mkt-metric"><span class="mkt-metric-label">' + escHtml(t.k) + '</span><span class="mkt-metric-value" style="color:' + t.c + '">' + t.v + '</span></div>';
  });
  html += '</div>';

  // Check if keyword signals are available
  if (!d.keyword_signals_ok) {
    html += '<div class="mkt-empty-card" style="margin-top:4px">SIF 关键词信号暂不可用<br><small>部分 ASIN 的关键词数据可能需要SIF后台索引完成后才能查询，可稍后重试</small></div>';
  }

  // Primary signals card
  var signals = d.primary_signals || {};
  var declining = _mktList(signals.declining) || [];
  var gaining = _mktList(signals.gaining) || [];
  var rankGaps = _mktList(signals.rank_gaps) || [];
  if (declining.length || gaining.length || rankGaps.length) {
    html += '<div class="mkt-card" style="margin-bottom:8px;border-left:3px solid var(--accent)">';
    html += '<div class="mkt-card-head" style="font-size:.72rem">&#x26A1; 核心信号</div>';
    html += '<div class="mkt-col-grid" style="grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:4px">';
    if (declining.length) html += '<div style="padding:6px 8px;background:rgba(239,68,68,.06);border-radius:6px;font-size:.65rem"><span style="color:var(--red);font-weight:600">&#x1F53B; 下降</span><br>' + declining.slice(0,3).map(function(k){return escHtml((k.keyword||k).substring(0,15))}).join('<br>') + '</div>';
    if (gaining.length) html += '<div style="padding:6px 8px;background:rgba(34,197,94,.06);border-radius:6px;font-size:.65rem"><span style="color:var(--green);font-weight:600">&#x1F53C; 上升</span><br>' + gaining.slice(0,3).map(function(k){return escHtml((k.keyword||k).substring(0,15))}).join('<br>') + '</div>';
    if (rankGaps.length) html += '<div style="padding:6px 8px;background:rgba(245,158,11,.06);border-radius:6px;font-size:.65rem"><span style="color:var(--accent2);font-weight:600">&#x26A0; 断档</span><br>' + rankGaps.slice(0,3).map(function(k){return escHtml((k.keyword||k).substring(0,15))}).join('<br>') + '</div>';
    html += '</div></div>';
  }

  // Keyword list table
  var kwList = _mktList(d.top_keywords) || _mktList(d.keyword_list) || [];
  if (kwList.length) {
    html += '<div class="mkt-filter-table"><table>';
    html += '<tr><th>关键词</th><th>健康度</th><th>排名趋势</th><th>点击份额</th><th>贡献变化</th></tr>';
    kwList.slice(0,20).forEach(function(k){
      var hCls = {core:'mkt-kw-chip core', at_risk:'mkt-kw-chip at_risk', volatile:'mkt-kw-chip volatile', paid_dependent:'mkt-kw-chip paid_dependent', standard:''}[k.keyword_health||k.health] || '';
      html += '<tr><td>' + escHtml(k.keyword || '—') + '</td>' +
        '<td><span class="' + hCls + '">' + escHtml(k.keyword_health || k.health || '—') + '</span></td>' +
        '<td>' + escHtml(k.rank_evolution || '—') + '</td>' +
        '<td>' + (k.click_share !== undefined ? _fmtPct(k.click_share) : '—') + '</td>' +
        '<td>' + (k.contri_change !== undefined ? (k.contri_change > 0 ? '+' : '') + _fmtNum(k.contri_change) : '—') + '</td></tr>';
    });
    html += '</table></div>';
  }

  // Feature word root analysis
  var wordRoots = d.word_root_analysis || '';
  if (wordRoots) html += '<div class="mkt-card" style="margin-top:8px"><div class="mkt-card-head" style="font-size:.72rem">&#x1F9E9; 特征词根分析</div><div style="font-size:.7rem;line-height:1.5">' + escHtml(wordRoots) + '</div></div>';

  panel.innerHTML = html;
}

// ── Ad Tab 3: 广告活动 ──
function renderAdCampaign(data) {
  var panel = document.getElementById('adTabCampaign');
  if (!panel) return;
  var d = data.campaigns || data;
  var html = '';

  html += '<div class="mkt-section-title">&#x1F4E2; 广告活动</div>';

  // Auto→Manual migration progress
  var migration = d.auto_manual_migration || {};
  if (Object.keys(migration).length) {
    html += '<div class="mkt-card" style="border-left:3px solid var(--accent);margin-bottom:8px">';
    html += '<div class="mkt-card-head" style="font-size:.72rem">&#x1F504; Auto → Manual 迁移</div>';
    var stage = migration.stage || 0; var stageLabels = ['数据收集 Auto100%', '手动测试 Auto70%/Manual30%', '预算转移 Auto50%/Manual50%', '优化收尾 Auto20%/Manual80%'];
    var pct = (stage + 1) * 25;
    html += '<div style="font-size:.7rem;margin:6px 0 4px">' + escHtml(stageLabels[stage] || '—') + '</div>';
    html += '<div style="background:var(--bg3);border-radius:5px;height:8px;overflow:hidden"><div style="width:' + pct + '%;height:100%;background:linear-gradient(90deg,var(--accent),var(--green));border-radius:5px;transition:width .5s"></div></div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:.58rem;color:var(--muted);margin-top:3px">';
    stageLabels.forEach(function(l,i){ html += '<span style="color:' + (i <= stage ? 'var(--accent)' : 'var(--muted)') + '">' + (i+1) + '</span>'; });
    html += '</div>';
    if (migration.can_continue !== undefined) html += '<div style="font-size:.65rem;margin-top:6px;padding:4px 8px;border-radius:4px;background:' + (migration.can_continue ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)') + ';color:' + (migration.can_continue ? 'var(--green)' : 'var(--red)') + ';font-weight:600">' + (migration.can_continue ? '✅ Manual ACOS < Auto×80%, 可继续迁移' : '⏸ 暂不满足迁移条件') + '</div>';
    html += '</div>';
  }

  // Campaign list
  var campList = _mktList(d.campaign_list) || _mktList(d.campaigns) || [];
  if (campList.length) {
    var tierLabels = {dominant:'🏆 主导(≥30%)', major:'⭐ 主要(≥10%)', supporting:'🔄 辅助(≥3%)', minor:'📎 次要(<3%)'};
    html += '<div class="mkt-filter-table"><table>';
    html += '<tr><th>Campaign</th><th>类型</th><th>贡献等级</th><th>占比</th><th>趋势</th></tr>';
    campList.forEach(function(c){
      var tier = c.contribution_tier || '';
      var tierEmoji = tierLabels[tier] || tier;
      var sharePct = c.share != null ? (Number(c.share)*100).toFixed(1) + '%' : '—';
      html += '<tr>' +
        '<td style="font-weight:600">' + escHtml(c.name || c.campaign_display_id || c.campaign_id || '—') + '</td>' +
        '<td>' + escHtml(c.ad_type || '—') + '</td>' +
        '<td>' + escHtml(tierEmoji) + '</td>' +
        '<td><span style="font-weight:600;color:' + (c.share > 0.3 ? 'var(--green)' : c.share > 0.1 ? 'var(--accent2)' : 'var(--muted)') + '">' + sharePct + '</span></td>' +
        '<td>' + escHtml(c.trend || c.overall_direction || '—') + '</td></tr>';
    });
    html += '</table></div>';
  }

  // Architecture health
  var health = d.architecture_health || [];
  if (health.length) {
    html += '<div class="mkt-card" style="margin-top:8px;border-left:3px solid var(--accent2)"><div class="mkt-card-head" style="font-size:.72rem">&#x1F3E5; 架构健康检查</div>';
    html += '<div style="font-size:.68rem;line-height:1.6">' + health.map(function(h,i){return '<div style="padding:3px 0">' + (i+1) + '. ' + escHtml(h) + '</div>';}).join('') + '</div></div>';
  }

  // Weekly rotation reminders
  var rotate = d.weekly_rotation || [];
  if (rotate.length) {
    html += '<div class="mkt-card" style="margin-top:8px;border-left:3px solid var(--accent)"><div class="mkt-card-head" style="font-size:.72rem">&#x1F504; 本周轮换建议</div>';
    html += '<div style="font-size:.68rem;line-height:1.6">' + rotate.map(function(r,i){return '<div style="padding:3px 0">' + (i+1) + '. ' + escHtml(r) + '</div>';}).join('') + '</div></div>';
  }

  panel.innerHTML = html;
}

// ── Ad Tab 4: 搜索词 ──
function renderAdSearchterm(data) {
  var panel = document.getElementById('adTabSearchterm');
  if (!panel) return;
  var d = data.search_terms || data;
  var html = '';

  html += '<div class="mkt-section-title">&#x1F50D; 搜索词</div>';

  // Seven-category classification hint
  html += '<div style="font-size:.68rem;color:var(--muted);margin-bottom:8px">七维分类：高转化 / 高出单 / 高流量 / 不出单 / 不相关 / 高ACOS / 低ACOS</div>';

  var stList = _mktList(d.search_term_list) || _mktList(d.items) || [];
  if (stList.length) {
    var catColors = {'高转化':'var(--green)','高出单':'var(--green)','高流量':'var(--accent2)','高ACOS':'var(--red)','低ACOS':'var(--green)','不出单':'var(--red)','不相关':'var(--muted)'};
    html += '<div class="mkt-filter-table"><table>';
    html += '<tr><th>搜索词</th><th>分类</th><th>自然占比</th><th>SP排名</th><th>ABA排名</th><th>贡献变化</th></tr>';
    stList.slice(0,50).forEach(function(s){
      var cColor = catColors[s.category] || '';
      html += '<tr>' +
        '<td>' + escHtml(s.keyword || s.search_term || '—') + '</td>' +
        '<td><span style="' + (cColor ? 'color:' + cColor + ';font-weight:600' : '') + '">' + escHtml(s.category || '—') + '</span></td>' +
        '<td>' + (s.natural_ratio != null ? (Number(s.natural_ratio)*100).toFixed(0) + '%' : '—') + '</td>' +
        '<td>' + escHtml(s.sp_rank || '—') + '</td>' +
        '<td>' + (s.aba_rank != null ? _fmtNum(s.aba_rank) : '—') + '</td>' +
        '<td>' + (s.contri_change != null ? (Number(s.contri_change) >= 0 ? '+' : '') + Number(s.contri_change).toFixed(3) : '—') + '</td>' +
        '</tr>';
    });
    html += '</table></div>';
  } else {
    html += '<div class="mkt-empty-card">暂无搜索词数据<br><small>请确认 SIF MCP 已开启，且 ASIN 有广告投放</small></div>';
  }

  // Negative keyword management
  var negKw = _mktList(d.negative_keywords) || [];
  if (negKw.length) {
    html += '<div class="mkt-card" style="margin-top:10px"><div class="mkt-card-title">否定词库 (' + negKw.length + ')</div>';
    html += '<div style="font-size:.72rem;color:var(--muted);max-height:120px;overflow-y:auto">' + negKw.map(function(n){return escHtml(n.keyword||n)}).join(' &nbsp;|&nbsp; ') + '</div></div>';
  }

  panel.innerHTML = html;
}

// ── Ad Tab 5: 竞价预算 ──
function renderAdBidbudget(data) {
  var panel = document.getElementById('adTabBidbudget');
  if (!panel) return;
  var d = data.bid_budget || data;
  var html = '';

  html += '<div class="mkt-section-title">&#x1F4B0; 竞价预算</div>';

  // Bid calculator
  var bid = d.bid_calculator || {};
  html += '<div class="mkt-card"><div class="mkt-card-title">竞价计算器</div>';
  html += '<div style="font-size:.72rem;color:var(--muted);margin-bottom:6px">CPC = ACOS × 售价 × CVR</div>';
  if (bid.suggested_cpc === '—' && !d.cpc_from) {
    html += '<div style="font-size:.65rem;color:var(--accent2);margin-bottom:4px">未获取到建议 CPC（SellerSprite traffic_keyword / Sorftime product_traffic_terms 均无数据）。可手动填写竞价。</div>';
  }
  html += '<div class="mkt-col-grid">';
  [{k:'建议 CPC',v:bid.suggested_cpc,fmt:'money'},{k:'保守出价',v:bid.conservative,fmt:'money'},{k:'标准出价',v:bid.standard,fmt:'money'},{k:'激进出价',v:bid.aggressive,fmt:'money'}].forEach(function(b){
    html += '<div class="mkt-metric"><span class="mkt-metric-label">' + escHtml(b.k) + '</span><span class="mkt-metric-value">' + (b.v !== undefined ? '$' + b.v : '—') + '</span></div>';
  });
  html += '</div></div>';

  // Waterfall config
  var waterfall = d.waterfall || {};
  html += '<div class="mkt-card"><div class="mkt-card-title">瀑布流梯度</div>';
  html += '<div style="font-size:.72rem;color:var(--muted);margin-bottom:6px">5-7梯度 (50%-200%) | 352分配：低价30% + 中价50% + 高价20%</div>';
  var grades = _mktList(waterfall.grades) || [];
  if (grades.length) {
    html += '<table class="mkt-filter-table"><tr><th>梯度</th><th>出价倍数</th><th>预算占比</th></tr>';
    grades.forEach(function(g){ html += '<tr><td>' + escHtml(g.level||g.grade||'—') + '</td><td>' + escHtml(g.bid_multiplier||g.multiplier||'—') + '</td><td>' + escHtml(g.budget_share||g.share||'—') + '</td></tr>'; });
    html += '</table>';
  }
  html += '</div>';

  // Dayparting
  var dayparting = d.dayparting || {};
  html += '<div class="mkt-card"><div class="mkt-card-title">分时调度</div>';
  html += '<table class="mkt-filter-table"><tr><th>时段</th><th>系数</th></tr>';
  [{k:'早高峰',v:dayparting.morning||'1.2'},{k:'白天',v:dayparting.daytime||'1.0'},{k:'晚高峰',v:dayparting.evening||'1.3-1.5'},{k:'深夜',v:dayparting.night||'0.8'}].forEach(function(t){
    html += '<tr><td>' + t.k + '</td><td>×' + escHtml(String(t.v)) + '</td></tr>';
  });
  html += '</table><div style="font-size:.68rem;color:var(--muted);margin-top:4px">新品前2周不分时 | 预算最低 $10</div></div>';

  // Budget control rules
  var budget = d.budget_rules || [];
  if (budget.length) {
    html += '<div class="mkt-card"><div class="mkt-card-title">预算管控</div><ul style="margin:4px 0 0 16px;font-size:.72rem">';
    budget.forEach(function(b){ html += '<li>' + escHtml(b) + '</li>'; });
    html += '</ul></div>';
  }

  // Bargain hunting quick reference
  html += '<div class="mkt-card"><div class="mkt-card-title">捡漏速查</div><div style="font-size:.72rem;color:var(--muted)">六法：Auto低价 | Manual Broad赛马 | 多SKU混合 | 低CPC+高TOS% | OOS截流 | 200广告组</div><div style="font-size:.68rem;color:var(--muted);margin-top:2px">规则：10次点击无单→关闭 | 每周复盘一次</div></div>';

  panel.innerHTML = html;
}

// ── Ad Tab 6: 广告位 ──
function renderAdPlacement(data) {
  var panel = document.getElementById('adTabPlacement');
  if (!panel) return;
  var d = data.placement || {};
  var html = '';

  html += '<div class="mkt-section-title">&#x1F4CD; 广告位分析</div>';

  // Placement recommendations
  var recs = _mktList(d.recommendations) || _mktList(d.placement_recommendations) || [];
  var multipliers = d.placement_multipliers || {};
  html += '<div class="mkt-card"><div class="mkt-card-title">广告位溢价建议 (TOS > ROS > PP)</div>';
  html += '<div style="font-size:.68rem;color:var(--muted);margin-bottom:6px">来源: Wiki SOP §4.10 | 每个位置至少 5-10 次点击后评估 | 零评论新品不测 TOS</div>';
  html += '<table class="mkt-filter-table"><tr><th>位置</th><th>优先级</th><th>建议溢价</th><th>约束</th></tr>';
  html += '<tr><td>TOS (Top of Search)</td><td>&#x1F534; 最高</td><td>+' + (multipliers.TOS ? ((multipliers.TOS-1)*100).toFixed(0)+'%' : '50%~150%') + '</td><td>至少 5-10 次精准点击后评估</td></tr>';
  html += '<tr><td>ROS (Rest of Search)</td><td>&#x1F7E1; 基线</td><td>0%</td><td>—</td></tr>';
  html += '<tr><td>PP (Product Pages)</td><td>&#x26AA; 最低</td><td>' + (multipliers.PP ? ((multipliers.PP-1)*100).toFixed(0)+'%' : '基线或降低') + '</td><td>零评论新品不测 TOS</td></tr>';
  html += '</table></div>';

  // Variant x Channel matrix (from 流量结构)
  var trafficList = _mktList(d.variant_channel_matrix) || _mktList(d.traffic_structure) || [];
  if (trafficList.length) {
    html += '<div class="mkt-card" style="margin-top:10px"><div class="mkt-card-title">&#x1F4CA; 变体 × 渠道矩阵 (来自 流量结构)</div>';
    html += '<table class="mkt-filter-table"><tr><th>变体 ASIN</th><th>总流量</th><th>自然</th><th>SP常规</th><th>SP推荐</th><th>SB</th><th>SBV</th></tr>';
    trafficList.forEach(function(v){
      html += '<tr><td>' + escHtml(v.asin || '—') + '</td><td>' + (v.totalScore !== undefined ? _fmtNum(v.totalScore) : '—') + '</td><td>' + (v.nfs !== undefined ? _fmtNum(v.nfs) : '—') + '</td><td>' + (v.sps !== undefined ? _fmtNum(v.sps) : '—') + '</td><td>' + (v.recs !== undefined ? _fmtNum(v.recs) : '—') + '</td><td>' + (v.sbs !== undefined ? _fmtNum(v.sbs) : '—') + '</td><td>' + (v.sbvs !== undefined ? _fmtNum(v.sbvs) : '—') + '</td></tr>';
    });
    html += '</table></div>';
  } else {
    html += '<div class="mkt-empty-card">变体流量结构数据待采集<br><small>来自 流量结构，dimension=asin</small></div>';
  }

  // Note about placement-level data
  html += '<div class="mkt-card" style="margin-top:10px;border-color:var(--accent2)"><div class="mkt-card-title" style="color:var(--accent2)">&#x26A0;&#xFE0F; 数据覆盖说明</div><div style="font-size:.72rem">SIF MCP 当前不直接提供 Placement 级数据 (TOS/ROS/PP 分别的 impression/click/conversion)。此 Tab 基于 Wiki 知识库规则 + SIF 变体流量结构的间接推断。完整 Placement 报告需连接 Amazon Ads API。</div></div>';

  panel.innerHTML = html;
}

// ── Ad Tab 7: 竞品广告 ──
function renderAdCompete(data) {
  var panel = document.getElementById('adTabCompete');
  if (!panel) return;
  var d = data.competition || data;
  var html = '';

  html += '<div class="mkt-section-title">&#x2694;&#xFE0F; 竞争对抗</div>';

  // Competitor overview table
  var competitors = _mktList(d.competitors) || _mktList(d.competitor_list) || [];
  if (!competitors.length && d.campaign_fallback) {
    html += '<div class="mkt-card" style="border-color:var(--accent2)"><div class="mkt-card-title">' + escHtml(d.ad_channel_note || '广告渠道信息') + '</div><div style="font-size:.72rem;color:var(--muted)">SIF 关键词信号暂不可用，竞品详情需连接 SIF keyword_signals 或配置 SellerSprite 竞品监控</div></div>';
  }
  if (competitors.length) {
    html += '<div class="mkt-card"><div class="mkt-card-title">竞品概览</div><table class="mkt-filter-table"><tr><th>ASIN</th><th>价格</th><th>BSR</th><th>月销量</th><th>评分</th><th>评论数</th><th>BS标识</th></tr>';
    competitors.forEach(function(c){
      html += '<tr><td>' + escHtml(c.asin || '—') + '</td><td>' + escHtml(c.price || '—') + '</td><td>' + escHtml(c.bsr || '—') + '</td><td>' + (c.monthly_sales !== undefined ? _fmtNum(c.monthly_sales) : '—') + '</td><td>' + escHtml(c.rating || '—') + '</td><td>' + escHtml(c.reviews || '—') + '</td><td>' + escHtml(c.best_seller ? 'BS' : (c.amazon_choice ? 'AC' : '—')) + '</td></tr>';
    });
    html += '</table></div>';
  }

  // Opportunity triggers
  var triggers = _mktList(d.opportunity_triggers) || [];
  if (triggers.length) {
    html += '<div class="mkt-card" style="border-color:var(--green)"><div class="mkt-card-title" style="color:var(--green)">&#x1F7E2; 机会触发器</div><ul style="margin:4px 0 0 16px;font-size:.72rem">';
    triggers.forEach(function(t){ html += '<li>' + escHtml(t.event || t.trigger || t) + (t.action ? ' → ' + escHtml(t.action) : '') + '</li>'; });
    html += '</ul></div>';
  }

  // Strategy recommendation
  var strategy = d.strategy || '';
  if (strategy) html += '<div class="mkt-card"><div class="mkt-card-title">策略推荐</div><div style="font-size:.72rem">' + escHtml(strategy) + '</div></div>';

  // Keyword overlap
  var overlap = d.keyword_overlap || '';
  if (overlap) html += '<div class="mkt-card"><div class="mkt-card-title">竞品关键词重叠度</div><div style="font-size:.72rem">' + escHtml(overlap) + '</div></div>';

  // Negative review mining
  var negReviews = d.competitor_neg_reviews || '';
  if (negReviews) html += '<div class="mkt-card"><div class="mkt-card-title">竞品差评挖掘</div><div style="font-size:.72rem">' + escHtml(negReviews) + '</div></div>';

  panel.innerHTML = html;
}



function togglePwd(fid) {
  var el = document.getElementById(fid);
  el.type = el.type === 'password' ? 'text' : 'password';
}
