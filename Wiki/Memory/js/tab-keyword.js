// ═══════════════════════════════════════════════════════════════════════════
// tab-keyword.js — 关键词词库 Tab
// ═══════════════════════════════════════════════════════════════════════════

let KW_STATE = { jobId: null, asin: null, country: null, data: null, currentTab: 'overview' };

// ── 核心入口 ──────────────────────────────────────────────────────────────

async function startKeywordLibrary() {
  const siteSel = document.getElementById('kwMarketplace');
  const asinEl = document.getElementById('kwAsin');
  const marketplace = (siteSel?.value || '').trim().toUpperCase();
  const asin = (asinEl?.value || '').trim();

  if (!marketplace) { showToast('请选择站点'); return; }
  if (!asin) { showToast('请输入 ASIN'); return; }

  KW_STATE.asin = asin;
  KW_STATE.country = marketplace;
  try { await getKeywordLibrarySettings(); } catch(e) {}
  showToast('正在查询关键词数据...');

  try {
    const resp = await fetch(`/api/keyword-library/kw_${Date.now()}?asin=${encodeURIComponent(asin)}&country=${encodeURIComponent(marketplace)}`);
    const data = await resp.json();
    if (data.error) {
      showToast(data.error);
      return;
    }
    KW_STATE.data = data;
    KW_STATE.jobId = data.job_id;
    renderKeywordLibrary(data);
    showToast('关键词数据加载完成');
  } catch (e) {
    showToast('查询失败: ' + (e.message || '网络错误'));
  }
}

function switchKwTab(tab) {
  KW_STATE.currentTab = tab;
  ['overview','demand','competition','featureWords','adStructure','adPlan'].forEach(t => {
    const el = document.getElementById('kwTab_' + t);
    if (el) el.style.display = (t === tab) ? 'block' : 'none';
  });
  document.querySelectorAll('#kwSubTabs .expert-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-kw-tab') === tab);
  });
}

// ── 总渲染入口 ────────────────────────────────────────────────────────────

function renderKeywordLibrary(data) {
  const n = data.normalized || {};
  renderKwOverview(n.overview_tab || {});
  renderKwDemand(n.demand_tab || {});
  renderKwCompetition(n.competition_tab || {});
  renderKwFeatureWords(n.feature_words_tab || {});
  renderKwAdStructure(n.ad_structure_tab || {});
  renderKwAdPlan(n.ad_structure_tab || {}, data.asin || '', data.country || '');
}

// ── Tab1: 词库总览 ────────────────────────────────────────────────────────

function renderKwOverview(tab) {
  const el = document.getElementById('kwTab_overview');
  if (!el) return;
  const kws = tab.keywords || [];
  const health = tab.health_distribution || {};

  // ── KPI Card ──
  let html = '<div class="mkt-card"><div class="mkt-card-head">📊 关键词健康总览 <span class="mkt-src-pill mkt-pill-sif">SIF</span></div>';
  html += '<div class="mkt-col-grid" style="grid-template-columns:repeat(5,1fr);">';
  const kpiItems = [
    { label: 'Core 核心词', value: health.core || 0, cls: 'green' },
    { label: 'At Risk 风险词', value: health.at_risk || 0, cls: 'red' },
    { label: 'Volatile 波动', value: health.volatile || 0, cls: 'warn' },
    { label: 'Paid Dep. 付费依赖', value: health.paid_dependent || 0, cls: 'warn' },
    { label: 'Standard 标准', value: health.standard || 0, cls: '' },
  ];
  kpiItems.forEach(k => {
    html += _metric(k.label, k.value, k.cls);
  });
  html += '</div></div>';

  // ── Primary Signals Card ──
  if ((tab.declining || []).length || (tab.gaining || []).length || (tab.rank_gaps || []).length) {
    html += '<div class="mkt-card" style="margin-top:10px;"><div class="mkt-card-head">📡 核心信号变化 <span class="mkt-src-pill mkt-pill-sif">SIF</span></div>';
    html += '<div class="mkt-col-grid" style="grid-template-columns:repeat(3,1fr);">';
    // declining
    html += '<div><div style="font-size:0.7rem;color:var(--muted);margin-bottom:4px;">↓ 流量下降</div>';
    (tab.declining || []).forEach(d => {
      html += '<div style="font-size:0.78rem;color:#ef4444;margin:2px 0;">' + escHtml((d.keyword||'').substring(0,28)) + '</div>';
      html += '<div style="font-size:0.65rem;color:var(--muted);">' + (d.contri_change||0).toFixed(4) + '</div>';
    });
    if (!(tab.declining||[]).length) html += '<div style="color:var(--muted);font-size:0.75rem;">—</div>';
    html += '</div>';
    // gaining
    html += '<div><div style="font-size:0.7rem;color:var(--muted);margin-bottom:4px;">↑ 流量上升</div>';
    (tab.gaining || []).forEach(g => {
      html += '<div style="font-size:0.78rem;color:#22c55e;margin:2px 0;">' + escHtml((g.keyword||'').substring(0,28)) + '</div>';
      html += '<div style="font-size:0.65rem;color:var(--muted);">+' + (g.contri_change||0).toFixed(4) + '</div>';
    });
    if (!(tab.gaining||[]).length) html += '<div style="color:var(--muted);font-size:0.75rem;">—</div>';
    html += '</div>';
    // rank_gaps
    html += '<div><div style="font-size:0.7rem;color:var(--muted);margin-bottom:4px;">⚠ 排名断档</div>';
    (tab.rank_gaps || []).forEach(r => {
      html += '<div style="font-size:0.78rem;color:#f59e0b;margin:2px 0;">' + escHtml((r.keyword||'').substring(0,28)) + '</div>';
      html += '<div style="font-size:0.65rem;color:var(--muted);">' + escHtml(r.gap_severity||'') + '</div>';
    });
    if (!(tab.rank_gaps||[]).length) html += '<div style="color:var(--muted);font-size:0.75rem;">—</div>';
    html += '</div>';
    html += '</div></div>';
  }

  // ── Keyword Table Card ──
  html += '<div class="mkt-card" style="margin-top:10px;"><div class="mkt-card-head">📋 关键词列表 (' + kws.length + ' 词) <span class="mkt-src-pill mkt-pill-sif">SIF</span></div>';
  if (kws.length > 0) {
    html += '<div style="overflow-x:auto;"><table class="mkt-filter-table" style="font-size:0.78rem;">';
    html += '<thead><tr><th>关键词</th><th>搜索量</th><th>ABA</th><th>流量%</th><th>自然%</th><th>CPC</th><th>自然排</th><th>SP排</th><th>健康</th><th>趋势</th></tr></thead><tbody>';
    kws.forEach(kw => {
      const hc = healthColor(kw.keyword_health);
      html += '<tr>';
      html += '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="' + escHtml(kw.keyword||'') + '">' + escHtml((kw.keyword||'').substring(0,40)) + '</td>';
      html += '<td>' + _fmtNum(kw.search_volume) + '</td>';
      html += '<td>' + _fmtNum(kw.aba_rank) + '</td>';
      html += '<td>' + ((kw.traffic_share||0)*100).toFixed(1) + '%</td>';
      html += '<td>' + ((kw.natural_ratio||0)*100).toFixed(0) + '%</td>';
      html += '<td>' + (kw.cpc_median != null ? '$' + Number(kw.cpc_median).toFixed(2) : '—') + '</td>';
      html += '<td style="font-size:0.7rem;">' + escHtml(kw.organic_rank||'—') + '</td>';
      html += '<td style="font-size:0.7rem;">' + escHtml(kw.sp_rank||'—') + '</td>';
      html += '<td><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:600;background:' + hc + ';color:#fff;">' + escHtml(kw.keyword_health||'') + '</span></td>';
      html += '<td>' + escHtml(kw.rank_evolution||'') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }
  html += '</div>';

  el.innerHTML = html;
}

function healthColor(h) {
  const map = { core: '#22c55e', at_risk: '#ef4444', volatile: '#f59e0b', paid_dependent: '#f97316', standard: '#6b7280' };
  return map[h] || '#6b7280';
}

// ── Tab2: 需求分析 ────────────────────────────────────────────────────────

function renderKwDemand(tab) {
  const el = document.getElementById('kwTab_demand');
  if (!el) return;
  const profiles = tab.profiles || [];
  const hist = tab.history_series;
  const root = tab.root_trend || {};

  let html = '';

  // ── Demand Profiles Card ──
  html += '<div class="mkt-card"><div class="mkt-card-head">📈 需求强度分析 <span class="mkt-src-pill mkt-pill-sif">SIF</span></div>';
  if (profiles.length > 0) {
    html += '<table class="mkt-filter-table" style="font-size:0.78rem;">';
    html += '<thead><tr><th>关键词</th><th>搜索量</th><th>趋势</th><th>动量</th><th>同比</th><th>诊断</th><th>行动阶段</th><th>距旺季</th></tr></thead><tbody>';
    profiles.forEach(p => {
      const trendCls = p.trend_direction === 'growing' ? 'green' : (p.trend_direction === 'declining' ? 'red' : '');
      html += '<tr>';
      html += '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;" title="' + escHtml(p.keyword||'') + '">' + escHtml((p.keyword||'').substring(0,28)) + '</td>';
      html += '<td>' + _fmtNum(p.search_volume) + '</td>';
      html += '<td class="' + trendCls + '" style="font-weight:600;">' + escHtml(p.trend_direction||'') + '</td>';
      html += '<td>' + escHtml(p.trend_momentum||'') + '</td>';
      html += '<td>' + (p.yoy_change!=null ? ((p.yoy_change>=0?'+':'')+(p.yoy_change*100).toFixed(1)+'%') : '—') + '</td>';
      html += '<td style="font-size:0.7rem;">' + escHtml(p.diagnosis||'') + '</td>';
      html += '<td>' + escHtml(p.action_phase||'') + '</td>';
      html += '<td>' + (p.weeks_to_peak!=null ? p.weeks_to_peak+'周' : '—') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
  } else {
    html += '<div class="mkt-empty-card">暂无需求数据</div>';
  }
  html += '</div>';

  // ── History Chart Card ──
  if (hist && hist.dates && hist.volumes) {
    html += '<div class="mkt-card" style="margin-top:10px;"><div class="mkt-card-head">📉 搜索量趋势 — ' + escHtml(hist.keyword||'') + ' <span class="mkt-src-pill mkt-pill-sif">SIF</span></div>';
    html += '<div id="kwDemandChart" style="width:100%;height:220px;"></div></div>';
    setTimeout(() => {
      const chartEl = document.getElementById('kwDemandChart');
      if (chartEl && hist.dates && hist.volumes) {
        const rows = hist.volumes.slice(-52).map((v, i) => ({
          label: (hist.dates.slice(-52)[i]||'').substring(5),
          value: v || 0
        }));
        chartEl.innerHTML = _aiBar(rows, { height: 220, color: '#3b82f6' });
      }
    }, 100);
  }

  // ── Root Trend Card ──
  if (root.coverage_ratio != null) {
    html += '<div class="mkt-card" style="margin-top:10px;"><div class="mkt-card-head">🔍 需求边界 — 精确词 vs 词根总市场 <span class="mkt-src-pill mkt-pill-sif">SIF</span></div>';
    html += '<div class="mkt-col-grid" style="grid-template-columns:repeat(3,1fr);">';
    html += _metric('精确词搜索量', _fmtNum(root.keyword_search_volume), '');
    html += _metric('词根总市场', _fmtNum(root.ext_search_volume), '');
    html += _metric('需求集中度', ((root.coverage_ratio||0)*100).toFixed(1) + '%', root.coverage_ratio > 0.6 ? 'green' : (root.coverage_ratio < 0.3 ? 'warn' : ''));
    html += '</div></div>';
  }

  el.innerHTML = html;
}

// ── Tab3: 竞争格局 ────────────────────────────────────────────────────────

function renderKwCompetition(tab) {
  const el = document.getElementById('kwTab_competition');
  if (!el) return;

  let html = '';

  // ── Position Card ──
  html += '<div class="mkt-card"><div class="mkt-card-head">⚔️ 竞争格局 — ' + escHtml(tab.keyword||'') + ' <span class="mkt-src-pill mkt-pill-sif">SIF</span></div>';
  html += '<div class="mkt-col-grid" style="grid-template-columns:repeat(3,1fr);">';
  html += _metric('竞争位置', tab.competition_position||'—',
    tab.competition_position==='opportunity'?'green':(tab.competition_position==='blocked'?'red':''));
  html += _metric('排名层级', tab.my_rank_tier||'—', '');
  html += _metric('策略判断', tab.verdict||'—', tab.verdict==='go'?'green':(tab.verdict==='no'?'red':'warn'));
  html += _metric('可进入性', tab.enterability||'—', tab.enterability==='高'?'green':'');
  html += _metric('可沉淀性', tab.sustainability||'—', '');
  html += _metric('可持续性', tab.durability||'—', '');
  html += '</div>';
  // concentration
  html += '<div class="mkt-col-grid" style="grid-template-columns:repeat(3,1fr);margin-top:4px;">';
  html += _metric('Top3 点击集中度', tab.top3_click_share!=null?(tab.top3_click_share*100).toFixed(1)+'%':'—', tab.top3_click_share>0.5?'red':'');
  html += _metric('Top3 转化集中度', tab.top3_conversion_share!=null?(tab.top3_conversion_share*100).toFixed(1)+'%':'—', '');
  html += _metric('领袖分化', tab.leader_diverge?'是 (点击≠转化)':'否', tab.leader_diverge?'warn':'');
  html += '</div>';
  html += '</div>';

  // ── Insight Card ──
  if (tab.key_insight || tab.primary_angle) {
    html += '<div class="mkt-card" style="margin-top:10px;"><div class="mkt-card-head">💡 策略洞察</div>';
    if (tab.key_insight) html += '<div style="font-size:0.8rem;margin-bottom:6px;">' + escHtml(tab.key_insight) + '</div>';
    if (tab.primary_angle) html += '<div style="font-size:0.78rem;color:var(--accent);">🎯 ' + escHtml(tab.primary_angle) + '</div>';
    html += '</div>';
  }

  // ── Competitors Card ──
  const comps = tab.top_competitors || [];
  if (comps.length > 0) {
    html += '<div class="mkt-card" style="margin-top:10px;"><div class="mkt-card-head">🏆 Top ' + comps.length + ' 竞品 <span class="mkt-src-pill mkt-pill-sif">SIF</span></div>';
    html += '<table class="mkt-filter-table" style="font-size:0.78rem;">';
    html += '<thead><tr><th>#</th><th>ASIN</th><th>价格</th><th>评分</th><th>评论</th><th>月销</th><th>总占比</th><th>模式</th></tr></thead><tbody>';
    comps.forEach((c, i) => {
      html += '<tr>';
      html += '<td>' + (c.rank || i+1) + '</td>';
      html += '<td style="font-family:monospace;font-size:0.7rem;">' + escHtml((c.asin||'').substring(0,10)) + '</td>';
      html += '<td>' + (c.price!=null?'$'+Number(c.price).toFixed(2):'—') + '</td>';
      html += '<td>' + (c.rating!=null?'⭐'+c.rating:'—') + '</td>';
      html += '<td>' + _fmtNum(c.review_count) + '</td>';
      html += '<td>' + escHtml(c.monthly_orders||'—') + '</td>';
      html += '<td>' + (c.total_share!=null?(c.total_share*100).toFixed(1)+'%':'—') + '</td>';
      html += '<td style="font-size:0.7rem;">' + escHtml(c.competition_mode||'') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  el.innerHTML = html;
}

// ── Tab4: 特征词分析 ──────────────────────────────────────────────────────

function renderKwFeatureWords(tab) {
  const el = document.getElementById('kwTab_featureWords');
  if (!el) return;
  tab = tab || {};
  let html = '<div class="mkt-section-title">🔬 特征词分析</div>';
  html += '<div class="mkt-card" style="padding:16px;">';
  html += '<p>上传亚马逊广告 <strong>Search Term Report</strong> (CSV)，自动拆词聚合 + 四级判断。</p>';
  html += '<input type="file" id="kwStFile" accept=".csv" style="margin:8px 0;"> ';
  html += '<button class="btn-mkt-start" onclick="uploadSearchTermReport()" style="margin:8px 0;">📤 上传分析</button>';
  html += '<div id="kwStResult"></div>';
  html += '</div>';

  // Target CPC calculator
  html += '<div class="mkt-section-title" style="margin-top:16px;">🧮 目标 CPC 计算器</div>';
  html += '<div class="mkt-card" style="padding:16px;">';
  html += '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">';
  html += '<div><label style="font-size:0.8rem;">目标 ACOS%</label><br><input id="kwCalcAcos" type="number" step="1" value="25" style="width:80px;">%</div>';
  html += '<div><label style="font-size:0.8rem;">售价 $</label><br><input id="kwCalcPrice" type="number" step="0.01" value="19.99" style="width:90px;"></div>';
  html += '<div><label style="font-size:0.8rem;">CVR%</label><br><input id="kwCalcCvr" type="number" step="0.1" value="5" style="width:80px;">%</div>';
  html += '<div><button class="btn-mkt-start" onclick="calculateTargetCpc()">计算</button></div>';
  html += '</div>';
  html += '<div id="kwCalcResult" style="margin-top:10px;font-weight:600;"></div>';
  html += '</div>';
  el.innerHTML = html;
}

// ── Tab5: 广告结构 ────────────────────────────────────────────────────────

function renderKwAdStructure(tab) {
  const el = document.getElementById('kwTab_adStructure');
  if (!el) return;
  tab = tab || {};
  const campaigns = tab.campaigns || [];

  let html = '<div class="mkt-section-title">🏗️ 广告结构规划</div>';

  if (tab.summary) {
    html += '<div class="mkt-card" style="margin-bottom:12px;padding:10px;">📋 ' + escHtml(tab.summary) + '</div>';
  }

  if (campaigns.length === 0) {
    html += '<div class="mkt-empty-card">暂无足够关键词生成广告结构</div>';
    el.innerHTML = html;
    return;
  }

  // Budget allocation bar
  html += '<div class="mkt-section-title">💰 预算分配建议</div>';
  html += '<div style="display:flex;height:24px;border-radius:4px;overflow:hidden;margin-bottom:16px;">';
  const colors = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
  campaigns.forEach((c, i) => {
    html += '<div title="' + escHtml(c.campaign_name) + ': ' + c.budget_pct + '%" style="flex:' + c.budget_pct + ';background:' + colors[i % colors.length] + ';min-width:2px;"></div>';
  });
  html += '</div>';

  // Campaign structure tree
  html += '<div class="mkt-section-title">🌲 Campaign 结构</div>';
  campaigns.forEach((c, ci) => {
    html += '<div class="mkt-card" style="margin-bottom:10px;padding:10px;border-left:4px solid ' + (colors[ci % colors.length]) + ';">';
    html += '<div style="font-weight:700;margin-bottom:4px;">📁 ' + escHtml(c.campaign_name) + '</div>';
    html += '<div style="font-size:0.72rem;color:var(--muted);margin-bottom:8px;">';
    html += '搜索量: ' + _fmtNum(c.total_search_volume) + ' | 预算: ' + c.budget_pct + '% | ';
    html += 'Top1: ' + c.concentration.top1_pct + '% | Top3: ' + c.concentration.top3_pct + '% | ';
    html += '<span style="color:var(--accent2);">' + escHtml(c.split_recommendation) + '</span>';
    html += '</div>';

    (c.ad_groups || []).forEach(ag => {
      html += '<div style="margin-left:16px;padding:4px 0;font-size:0.8rem;">';
      html += '📂 ' + escHtml(ag.ad_group_name) + ' <span style="color:var(--muted);">[' + escHtml(ag.match_type) + ']</span>';
      if (ag.bid_suggestion) html += ' <span style="color:var(--accent);">CPC $' + ag.bid_suggestion.toFixed(2) + '</span>';
      html += '<div style="font-size:0.7rem;color:var(--muted);margin-left:12px;">';
      (ag.keywords || []).forEach(k => {
        html += escHtml(k.keyword) + ' (SV:' + _fmtNum(k.search_volume) + ') · ';
      });
      html += '</div></div>';
    });
    html += '</div>';
  });

  el.innerHTML = html;
}

// ── 特征词上传 ────────────────────────────────────────────────────────────

async function uploadSearchTermReport() {
  const fileEl = document.getElementById('kwStFile');
  const file = fileEl?.files?.[0];
  if (!file) { showToast('请选择 CSV 文件'); return; }
  const statusEl = document.getElementById('kwStResult');
  statusEl.innerHTML = '<div style="color:var(--accent);">⏳ 正在分析...</div>';
  const form = new FormData();
  form.append('file', file);
  form.append('asin', KW_STATE.asin || '');
  try {
    const r = await fetch('/api/keyword-library/upload-search-term-report', { method: 'POST', body: form });
    const d = await r.json();
    if (d.error) { statusEl.innerHTML = '<div style="color:var(--red);">❌ ' + escHtml(d.error) + '</div>'; return; }

    // Level distribution
    const ld = d.level_distribution || {};
    let html = '<div class="mkt-card" style="margin-top:10px;"><div class="mkt-card-head">📊 四级判断分布</div>';
    html += '<div class="mkt-col-grid" style="grid-template-columns:repeat(4,1fr);">';
    html += _metric('高价值词', ld['高价值']||0, 'green');
    html += _metric('潜力词', ld['潜力']||0, '');
    html += _metric('吸引弱词', ld['吸引弱']||0, 'warn');
    html += _metric('低效词', ld['低效']||0, 'red');
    html += '</div><div style="font-size:0.7rem;color:var(--muted);margin-top:4px;">总行数: ' + (d.total_rows||0) + ' | 单词: ' + (d.single_words_count||0) + ' | 双词组: ' + (d.bi_grams_count||0) + '</div></div>';

    // Single words table
    const sw = d.single_words || [];
    html += '<div class="mkt-card" style="margin-top:10px;"><div class="mkt-card-head">🔤 单词维度 (' + sw.length + ' 词)</div>';
    html += '<div style="overflow-x:auto;"><table class="mkt-filter-table" style="font-size:0.72rem;"><thead><tr>';
    ['词根','Impr','Clicks','Spend','Sales','Orders','CPC','CTR','CVR','ACOS','CPA','级别','行动'].forEach(h => html += '<th>' + h + '</th>');
    html += '</tr></thead><tbody>';
    sw.forEach(s => {
      html += '<tr>';
      html += '<td>' + escHtml(s.word) + '</td>';
      html += '<td>' + _fmtNum(s.impressions) + '</td><td>' + _fmtNum(s.clicks) + '</td>';
      html += '<td>$' + (s.spend||0).toFixed(2) + '</td><td>$' + (s.sales||0).toFixed(2) + '</td><td>' + (s.orders||0) + '</td>';
      html += '<td>$' + (s.cpc||0).toFixed(2) + '</td><td>' + ((s.ctr||0)*100).toFixed(1) + '%</td><td>' + ((s.cvr||0)*100).toFixed(1) + '%</td>';
      html += '<td>' + ((s.acos||0)*100).toFixed(1) + '%</td><td>$' + (s.cpa||0).toFixed(2) + '</td>';
      const lvlCls = s.level==='高价值'?'green':(s.level==='低效'?'red':(s.level==='潜力'?'':'warn'));
      html += '<td class="' + lvlCls + '">' + escHtml(s.level) + '</td>';
      html += '<td style="font-size:0.65rem;">' + escHtml(s.action||'') + '</td></tr>';
    });
    html += '</tbody></table></div></div>';

    // Bi-grams table
    const bg = d.bi_grams || [];
    if (bg.length > 0) {
      html += '<div class="mkt-card" style="margin-top:10px;"><div class="mkt-card-head">🔗 双词组维度 (' + bg.length + ' 组)</div>';
      html += '<div style="overflow-x:auto;"><table class="mkt-filter-table" style="font-size:0.72rem;"><thead><tr>';
      ['词组','Impr','Clicks','Spend','Sales','Orders','CPC','词1CVR','词1ACOS','词2CVR','词2ACOS'].forEach(h => html += '<th>' + h + '</th>');
      html += '</tr></thead><tbody>';
      bg.forEach(b => {
        html += '<tr><td>' + escHtml(b.bigram) + '</td>';
        html += '<td>' + _fmtNum(b.impressions) + '</td><td>' + _fmtNum(b.clicks) + '</td>';
        html += '<td>$' + (b.spend||0).toFixed(2) + '</td><td>$' + (b.sales||0).toFixed(2) + '</td><td>' + (b.orders||0) + '</td>';
        html += '<td>$' + (b.cpc||0).toFixed(2) + '</td>';
        html += '<td>' + ((b.word1_cvr||0)*100).toFixed(1) + '%</td><td>' + ((b.word1_acos||0)*100).toFixed(1) + '%</td>';
        html += '<td>' + ((b.word2_cvr||0)*100).toFixed(1) + '%</td><td>' + ((b.word2_acos||0)*100).toFixed(1) + '%</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    statusEl.innerHTML = html;
  } catch (e) {
    document.getElementById('kwStResult').innerHTML = '<div style="color:var(--red);">❌ 上传失败: ' + escHtml(e.message||'网络错误') + '</div>';
  }
}

// ── 目标 CPC 计算器 ───────────────────────────────────────────────────────

function calculateTargetCpc() {
  const acos = parseFloat(document.getElementById('kwCalcAcos')?.value) / 100;
  const price = parseFloat(document.getElementById('kwCalcPrice')?.value);
  const cvr = parseFloat(document.getElementById('kwCalcCvr')?.value) / 100;
  if (!acos || !price || !cvr) return;
  const cpc = acos * price * cvr;
  const cpa = cpc / cvr;
  document.getElementById('kwCalcResult').innerHTML =
    '目标 CPC ≤ <strong>$' + cpc.toFixed(2) + '</strong> &nbsp;|&nbsp; 目标 CPA ≤ <strong>$' + cpa.toFixed(2) + '</strong>';
}

// ── 辅助 ──────────────────────────────────────────────────────────────────

// ── Tab6: 广告计划 (CSV 下载) ────────────────────────────────────────────

function renderKwAdPlan(tab, asin, country) {
  const el = document.getElementById('kwTab_adPlan');
  if (!el) return;
  tab = tab || {};
  const campaigns = tab.campaigns || [];

  let html = '<div class="mkt-section-title">📋 广告计划 — 亚马逊批量上传模板</div>';

  if (campaigns.length === 0) {
    html += '<div class="mkt-empty-card">暂无广告结构数据，请先执行「开始分析」</div>';
    el.innerHTML = html;
    return;
  }

  // Summary
  html += '<div class="mkt-card" style="margin-bottom:12px;padding:10px;">';
  html += '<div style="font-size:0.8rem;color:var(--muted);">';
  html += '此 CSV 可直接上传至亚马逊广告后台（批量操作 → 上传电子表格）。<br>';
  html += '包含 Campaign、Ad Group、Keyword、Product Targeting 四种记录类型。<br>';
  html += '上传后请先在后台确认预算和竞价，再启用广告活动。';
  html += '</div></div>';

  // Download button
  const csvContent = buildAdPlanCsv(campaigns, asin, country);
  const blob = new Blob(['﻿' + csvContent], {type: 'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const safeName = (asin || 'bulk').replace(/[^A-Za-z0-9]/g, '_');
  html += '<a class="btn-mkt-start" href="' + url + '" download="Amazon_Ad_Plan_' + safeName + '.csv" style="display:inline-block;text-decoration:none;margin-bottom:16px;">📥 下载 CSV 文件</a>';

  // Preview table
  html += '<div class="mkt-section-title">📄 CSV 预览 (前 30 行)</div>';
  html += '<div style="overflow-x:auto;"><table class="mkt-filter-table" style="font-size:0.7rem;white-space:nowrap;">';
  const lines = csvContent.split('\n');
  const headerLine = lines[0] || '';
  html += '<thead><tr>';
  headerLine.split(',').forEach(h => {
    html += '<th>' + escHtml(h.replace(/"/g, '')) + '</th>';
  });
  html += '</tr></thead><tbody>';
  const previewLines = lines.slice(1, Math.min(lines.length, 31));
  previewLines.forEach(line => {
    if (!line.trim()) return;
    html += '<tr>';
    // Parse CSV respecting quotes
    const cols = parseCsvLine(line);
    cols.forEach(c => { html += '<td>' + escHtml(c) + '</td>'; });
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  // Wiki methodology note
  html += '<div class="mkt-section-title" style="margin-top:16px;">📖 投放策略说明 (来源: Wiki 知识库)</div>';
  html += '<div class="mkt-card" style="padding:10px;font-size:0.78rem;">';
  html += '<p><strong>阶段一：价值验证</strong> — S 级关键词用 Exact + Phrase，小预算启动，验证 CTR/CVR/ACOS。</p>';
  html += '<p><strong>阶段二：流量拓展</strong> — A 级长尾词用 Phrase + Broad，扩大精准流量覆盖。</p>';
  html += '<p><strong>阶段三：流量泛化</strong> — Broad + Auto + 商品投放 + 类目投放，最大化曝光。</p>';
  html += '<p><strong>竞价公式</strong>: CPC = ACOS目标 × 售价 × CVR | <strong>匹配规则</strong>: Exact→高转化 | Phrase→场景/人群 | Broad→探索词</p>';
  html += '<p><strong>集中度拆分</strong>: 单关键词占比≥30% → 独立 Campaign | Top3≥60% → 单独 Ad Group</p>';
  html += '</div>';

  el.innerHTML = html;
}

function buildAdPlanCsv(campaigns, asin, country) {
  // Amazon Bulk Upload CSV format
  const headers = [
    'Record Type', 'Campaign Name', 'Ad Group Name', 'Keyword',
    'Match Type', 'Bid', 'Campaign Daily Budget', 'Campaign Start Date',
    'Campaign Targeting Type', 'Campaign Status', 'Ad Group Status'
  ];
  const rows = [headers.join(',')];

  let campaignIdx = 0;
  campaigns.forEach(c => {
    campaignIdx++;
    const campaignName = 'KW_' + (country || 'US') + '_' + c.root_word + '_C' + campaignIdx;
    const dailyBudget = Math.max(5, Math.round((c.total_search_volume || 10000) / 500));
    const startDate = new Date().toISOString().slice(0, 10);

    // Campaign record
    rows.push([
      '"Campaign"',
      '"' + campaignName + '"',
      '""',
      '""',
      '""',
      '""',
      dailyBudget,
      startDate,
      '"Manual"',
      '"Paused"',
      '""'
    ].join(','));

    // Ad Group + Keyword records
    (c.ad_groups || []).forEach((ag, agIdx) => {
      const agName = 'AG' + (agIdx + 1) + '_' + c.root_word;

      // Ad Group record
      rows.push([
        '"Ad Group"',
        '"' + campaignName + '"',
        '"' + agName + '"',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '""',
        '"Paused"'
      ].join(','));

      // Keyword records
      (ag.keywords || []).forEach(kw => {
        const mt = ag.match_type || 'Phrase';
        const bid = ag.bid_suggestion || 0.50;
        const cleanKw = kw.keyword.replace(/"/g, '""');
        rows.push([
          '"Keyword"',
          '"' + campaignName + '"',
          '"' + agName + '"',
          '"' + cleanKw + '"',
          '"' + mt + '"',
          bid.toFixed(2),
          '""',
          '""',
          '""',
          '""',
          '""'
        ].join(','));
      });

      // Product Targeting row for ASIN targeting (competitor)
      rows.push([
        '"Product Targeting"',
        '"' + campaignName + '"',
        '"' + agName + '"',
        '"asin=' + (asin || 'B0XXXXXXXXXX') + '"',
        '""',
        (ag.bid_suggestion || 0.50).toFixed(2),
        '""',
        '""',
        '""',
        '""',
        '""'
      ].join(','));
    });
  });

  return rows.join('\n');
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function updateKwSourceBadges(cfg) {
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
  setBadge('kwSrcSif', 'SIF MCP', sif.enabled, !!(sif.endpoint && sif.api_key));
  setBadge('kwSrcSt', 'Sorftime MCP', st.enabled, !!(st.endpoint && st.api_key));
  setBadge('kwSrcSs', 'SellerSprite MCP', ss.enabled, !!(ss.endpoint && ss.api_key));
}

async function getKeywordLibrarySettings() {
  try {
    var r = await fetch('/api/settings'); if (!r.ok) return;
    var cfg = await r.json();
    updateKwSourceBadges(cfg);
  } catch(e) {}
}
