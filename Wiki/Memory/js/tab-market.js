// Market Analysis V2 (SOP Phase 1)
// ═══════════════════════════════════════════════════════════════
var MKT_STATE = { st: false, ss: false, data: null, loading: false };

function switchMarketTab(tab) {
  document.querySelectorAll('#mktSubTabs .expert-tab').forEach(function(t){t.classList.remove('active');});
  var ids = ['mktTabSupply','mktTabDifficulty','mktTabFilter','mktTabCompete','mktTabKwopp','mktTabAli1688','mktTabProfit','mktTabPriceband','mktTabReview','mktTabCost'];
  ids.forEach(function(id){ var el = document.getElementById(id); if (el) el.style.display='none'; });
  var tabMap = {
    supply:'mktTabSupply', difficulty:'mktTabDifficulty', filter:'mktTabFilter',
    compete:'mktTabCompete', kwopp:'mktTabKwopp', ali1688:'mktTabAli1688',
    profit:'mktTabProfit', priceband:'mktTabPriceband', review:'mktTabReview', cost:'mktTabCost'
  };
  var labels = {
    supply:'供需比', difficulty:'品类难度', filter:'产品筛选', compete:'竞争扫描',
    kwopp:'关键词机会', ali1688:'1688', profit:'利润测算', priceband:'价格带', review:'评论洞察', cost:'成本估算'
  };
  var btns = document.querySelectorAll('#mktSubTabs .expert-tab');
  for (var i=0;i<btns.length;i++) { if (btns[i].textContent.indexOf(labels[tab])!==-1) btns[i].classList.add('active'); }
  var target = document.getElementById(tabMap[tab]);
  if (target) target.style.display = 'block';
}

function updateMarketSourceBadges(cfg) {
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
  setBadge('mktSrcSif', 'SIF MCP', sif.enabled, !!(sif.endpoint && sif.api_key));
  setBadge('mktSrcSt', 'Sorftime MCP', st.enabled, !!(st.endpoint && st.api_key));
  setBadge('mktSrcSs', 'SellerSprite MCP', ss.enabled, !!(ss.endpoint && ss.api_key));
}

async function getMarketSettings() {
  var res = await fetch('/api/settings');
  var cfg = await res.json();
  updateMarketSourceBadges(cfg);
  return cfg;
}

async function startMarketAnalysis() {
  var asin = document.getElementById('mktAsin').value.trim();
  var keyword = document.getElementById('mktKeyword').value.trim();
  var marketplace = document.getElementById('mktMarketplace').value;
  if (!marketplace) { showToast('请选择站点'); return; }
  if (!asin && !keyword) { showToast('请输入 ASIN 或关键词'); return; }
  if (asin && !/^[A-Za-z0-9]{5,15}$/.test(asin)) { showToast('ASIN 格式错误（5-15 位字母数字）'); return; }

  try { await getMarketSettings(); } catch(e) {}
  var empty = document.getElementById('mktEmpty');
  if (empty) empty.style.display = 'none';
  MKT_STATE.loading = true;
  mktShowLoading();

  var jobId = 'mkt' + Date.now().toString(36) + Math.random().toString(36).substr(2,6);
  var qs = '?asin=' + encodeURIComponent(asin) +
           '&keyword=' + encodeURIComponent(keyword) +
           '&marketplace=' + encodeURIComponent(marketplace);

  fetch('/api/market-analysis-v2/' + jobId + qs)
    .then(function(r){ return r.json(); })
    .then(function(data){
      MKT_STATE.loading = false;
      MKT_STATE.data = data;
      if (data.error) { showToast('分析失败：' + data.error); mktShowError(data.error); return; }
      mktRenderAll(data);
    })
    .catch(function(err){
      MKT_STATE.loading = false;
      showToast('请求失败：' + err.message);
      mktShowError(err.message);
    });
}

function mktShowLoading() {
  var html = '<div class="mkt-loading">' +
    '<div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>' +
    '<div style="margin-top:10px">正在按设置中的 MCP 开关采集...</div>' +
    '<small style="color:var(--muted)">站点 + ASIN/关键词 → SIF / Sorftime / SellerSprite，预计 10-30s</small></div>';
  ['mktTabSupply','mktTabDifficulty','mktTabFilter','mktTabCompete','mktTabKwopp','mktTabAli1688','mktTabProfit','mktTabPriceband','mktTabReview','mktTabCost'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.innerHTML = html;
  });
}

function mktShowError(msg) {
  var html = '<div class="mkt-empty-card" style="color:var(--red);border-color:var(--red)">采集失败：' + escHtml(msg || '未知错误') + '</div>';
  ['mktTabSupply','mktTabDifficulty','mktTabFilter','mktTabCompete','mktTabKwopp','mktTabAli1688','mktTabProfit','mktTabPriceband','mktTabReview','mktTabCost'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.innerHTML = html;
  });
}

function mktRenderAll(data) {
  renderMarketSupply(data);
  renderMarketDifficulty(data);
  renderMarketFilter(data);
  renderMarketCompete(data);
  renderMarketKwopp(data);
  renderMarketAli1688(data);
  renderMarketProfit(data);
  renderMarketPriceBand(data);
  renderMarketReview(data);
  renderMarketCost(data);
}

// Helper: safe nested get
function _mg(obj /*, path...*/) {
  var cur = obj;
  for (var i=1; i<arguments.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[arguments[i]];
  }
  return cur;
}

function _fmtNum(n) {
  if (n == null || n === '') return '—';
  var num = Number(n);
  if (isNaN(num)) return String(n);
  if (num >= 1000000) return (num/1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num/1000).toFixed(1) + 'K';
  return num.toLocaleString();
}

function _fmtPct(n) {
  if (n == null || n === '') return '—';
  var num = Number(n);
  if (isNaN(num)) return String(n);
  if (num > 1) num = num / 100;
  return (num * 100).toFixed(1) + '%';
}

function _mktList(v) {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== 'object') return [];
  return v.list || v.items || v.data || v.asins || v.products || v.rows || [];
}

function _mktVal(obj /*, keys...*/) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (var i=1; i<arguments.length; i++) {
    var key = arguments[i];
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return undefined;
}

function _mktNum(v) {
  if (v == null || v === '') return null;
  var n = Number(String(v).replace(/,/g, '').replace(/\+/g, '').replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function _mktVm(data /*, path...*/) {
  var args = [data && data.view_model ? data.view_model : null];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  return _mg.apply(null, args);
}

function _mktNz(data /*, path...*/) {
  var args = [data && data.normalized ? data.normalized : null];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  return _mg.apply(null, args);
}

function _mktErrMsg(data, key) {
  var err = _mg(data, 'errors', key);
  if (err && typeof err === 'object') return err.message || '';
  if (typeof err === 'string') return err;
  var legacy = _mg(data, 'errors_legacy', key);
  return typeof legacy === 'string' ? legacy : '';
}

function _mktSourceActive(data, vendor) {
  var ds = data && data.data_sources ? data.data_sources : {};
  if (vendor === 'sif') return !!ds.sif_enabled;
  if (vendor === 'sorftime') return !!ds.sorftime_active;
  if (vendor === 'sellersprite') return !!ds.sellersprite_active;
  return false;
}

var _PROV_LABELS = {
  'market_get_keyword_history': '关键词搜索量历史',
  'market_get_keyword_root_trend': '品类需求规模',
  'market_get_keyword_demand': '需求生命周期',
  'market_get_asin_keyword_signals': '关键词流量信号',
  'market_get_keyword_competition': '关键词竞争格局',
  'ops_get_asin_traffic_trend': '流量趋势',
  'ops_get_asin_sales_list': '销量数据',
  'ops_get_listing_traffic_overview': '流量总览',
  'ops_get_listing_traffic_structure': '变体流量结构',
  'ads_get_asin_ad_structure': '广告架构',
  'ads_get_asin_ad_traffic_trend': '广告流量趋势',
  'ads_get_asin_campaign_contribution_overview': '广告活动贡献',
  'ads_get_campaign_structure': '广告活动结构',
  'ads_get_campaign_traffic_trend': '广告活动趋势',
  'product_search': '产品搜索',
  'product_detail': '产品详情',
  'product_traffic_terms': '产品流量词',
  'competitor_lookup': '竞品查询',
  'keyword_research': '关键词调研',
  'market_research': '市场调研',
  'asin_detail': 'ASIN详情',
  'keyword_miner': '关键词挖掘',
  'review': '评论分析',
};

function _mktSummaryBanner(data) {
  var summary = _mktVm(data, 'summary_bar') || {};
  var context = _mktNz(data, 'context_product') || {};
  var warnings = Array.isArray(data && data.warnings) ? data.warnings : [];
  var provenance = Array.isArray(data && data.provenance) ? data.provenance : [];
  var errorMap = data && data.errors && typeof data.errors === 'object' ? data.errors : {};
  var completeness = summary.analysis_completeness || data.analysis_completeness || 'low';
  var completenessLabel = completeness === 'high' ? '高完整度' : (completeness === 'medium' ? '中完整度' : '低完整度');
  var completenessCls = completeness === 'high' ? 'green' : (completeness === 'medium' ? 'warn' : 'red');
  var sourceLabel = summary.source_label || data.mcp_source || '—';
  var keyword = summary.derived_keyword || data.derived_keyword || data.keyword || '';
  var warningCount = Number(summary.warning_count || 0);
  var errorCount = Number(summary.error_count || 0);
  var warnHtml = '';
  if (warnings.length) {
    warnHtml = '<div style="margin-top:8px">' + warnings.map(function(w){
      return '<span class="mkt-kw-chip warn">' + escHtml(w.code || 'WARNING') + '</span>';
    }).join('') + '</div>';
  }
  var note = '<div style="margin-top:8px;font-size:.7rem;color:var(--muted)">警告 ' + warningCount + ' 条，错误 ' + errorCount + ' 条。</div>';
  if (provenance.length) {
    note += '<div style="margin-top:6px;font-size:.68rem;color:var(--muted)">数据来源：' + provenance.map(function(p){
      var toolName = p.source_tool || '';
      var label = _PROV_LABELS[toolName] || toolName;
      var size = p.sample_size != null ? (' · ' + p.sample_size + '条') : '';
      return escHtml(label + size);
    }).join('，') + '</div>';
  }
  var titleLine = context.title ? context.title : '';
  var titleHtml = titleLine
    ? '<div style="margin-top:8px;font-size:.72rem;color:var(--text);font-weight:600;line-height:1.5">' + escHtml(titleLine) + '</div>'
    : '';
  var detailRows = [];
  warnings.forEach(function(w){
    detailRows.push(
      '<tr><td>warning</td><td>' + escHtml(w.code || 'WARNING') + '</td><td>' +
      escHtml(w.source || 'unknown') + '</td><td>' + escHtml(w.message || '') + '</td></tr>'
    );
  });
  Object.keys(errorMap).forEach(function(key){
    var item = errorMap[key] || {};
    detailRows.push(
      '<tr><td>' + escHtml(item.severity || 'error') + '</td><td>' +
      escHtml(item.code || key) + '</td><td>' + escHtml(key) + '</td><td>' +
      escHtml(item.message || '') + '</td></tr>'
    );
  });
  var detailHtml = detailRows.length
    ? '<details style="margin-top:10px"><summary style="cursor:pointer;font-size:.72rem;color:var(--muted)">查看告警 / 错误明细</summary>' +
      '<div class="mkt-filter-table" style="margin-top:8px"><table>' +
      '<tr><th>级别</th><th>代码</th><th>来源键</th><th>说明</th></tr>' +
      detailRows.join('') + '</table></div></details>'
    : '';
  return '<div class="mkt-card" style="margin-bottom:10px">' +
    '<div class="mkt-card-head">分析概览</div>' +
    _metric('ASIN', context.asin || data.asin || '—') +
    _metric('数据组合', sourceLabel) +
    _metric('完整度', completenessLabel, completenessCls) +
    _metric('分析关键词', keyword || '—') +
    _metric('参考价格', context.price != null ? ('$' + Number(context.price).toFixed(2)) : '—') +
    _metric('Warning / Error', warningCount + ' / ' + errorCount) +
    titleHtml +
    warnHtml +
    note +
    detailHtml +
    '</div>';
}

function _mktSourceEmpty(name) {
  return '<div class="mkt-empty-card">' + name + ' 未开启/未配置，按设置窗体 MCP 开关决定</div>';
}

function _mktCol(title, srcType, html) {
  var pillClass = srcType === 'sif' ? 'mkt-pill-sif' : (srcType === 'st' ? 'mkt-pill-st' : 'mkt-pill-ss');
  var pillName = srcType === 'sif' ? 'SIF' : (srcType === 'st' ? 'Sorftime' : 'SellerSprite');
  return '<div class="mkt-card"><div class="mkt-card-head">' +
    escHtml(title) + ' <span class="mkt-src-pill ' + pillClass + '">' + pillName + '</span></div>' +
    (html || '<div class="mkt-empty-card">暂无数据</div>') + '</div>';
}

function _metric(k, v, cls, raw) {
  return '<div class="mkt-metric"><span class="mkt-metric-key">' + escHtml(k) + '</span>' +
    '<span class="mkt-metric-val ' + (cls||'') + '">' + (v == null || v === '' ? '—' : (raw ? String(v) : escHtml(String(v)))) + '</span></div>';
}

// ── Tab 1: 供需比 ──
function renderMarketSupply(data) {
  var vm = _mktVm(data, 'supply_tab') || {};
  var sifVm = vm.sif || {};
  var stVm = vm.sorftime || {};
  var ssVm = vm.sellersprite || {};
  var sifKwHist = _mg(data, 'sif', 'keyword_history') || {};
  var sifRoot = _mg(data, 'sif', 'keyword_root') || {};
  var sifKwArr = sifKwHist.keywords || [];
  var sifLatest = sifKwArr[0] && sifKwArr[0].latest ? sifKwArr[0].latest : {};
  var sifVol = sifVm.search_volume != null ? sifVm.search_volume : sifLatest.volume;
  var sifRank = sifVm.aba_rank != null ? sifVm.aba_rank : sifLatest.rank;
  var sifExtVol = sifVm.root_search_volume != null ? sifVm.root_search_volume : _mg(sifRoot, 'latest', 'ext_search_volume');
  var supplyRatio = sifVm.coverage_ratio != null ? sifVm.coverage_ratio : ((sifVol && sifExtVol) ? (sifVol / sifExtVol) : null);

  var usedKeyword = vm.used_keyword || data.derived_keyword || data.keyword || '';
  var sifHtml = _metric('分析关键词', usedKeyword || '—') +
                _metric('月搜索量', _fmtNum(sifVol)) +
                _metric('ABA 排名', sifRank == 0 ? '未入榜' : _fmtNum(sifRank)) +
                _metric('品类总搜索量(词根)', _fmtNum(sifExtVol)) +
                _metric('精确词覆盖率', supplyRatio != null ? _fmtPct(supplyRatio) : '—');

  var stKwTrend = _mg(data, 'sorftime', 'keyword_trend') || {};
  var stCatRpt = _mg(data, 'sorftime', 'category_report') || {};
  var stVol = stVm.search_volume != null ? stVm.search_volume : (stKwTrend.search_volume || stKwTrend.searchVolume);
  var stCpc = stVm.avg_cpc != null ? stVm.avg_cpc : (stKwTrend.avg_cpc || stKwTrend.avgCpc || stKwTrend.cpc);
  var stTotal = stVm.product_count != null ? stVm.product_count : (stCatRpt.total_products || stCatRpt.totalProducts || stCatRpt.productCount);
  var stListForSupply = _mktList(_mg(data, 'sorftime', 'product_search'));
  var stPool = stVm.sample_pool_size != null ? stVm.sample_pool_size : stListForSupply.length;
  var stRatio = stVm.supply_demand_ratio != null ? stVm.supply_demand_ratio : ((stVol && stTotal) ? (stVol / stTotal) : null);
  var stHtml = _mktSourceActive(data, 'sorftime')
    ? _metric('月搜索量', _fmtNum(stVol)) +
      _metric('商品总数', _fmtNum(stTotal || stPool)) +
      _metric('竞品样本池', stPool ? stPool + ' 个' : '—') +
      _metric('需供比', stRatio != null ? stRatio.toFixed(3) : '—') +
      _metric('平均 CPC', stCpc != null ? '$' + Number(stCpc).toFixed(2) : '—')
    : _mktSourceEmpty('Sorftime');

  var ssKwTrend = _mg(data, 'sellersprite', 'keyword_trend') || {};
  var ssMktRpt = _mg(data, 'sellersprite', 'market_report') || {};
  var ssVol = ssVm.search_volume != null ? ssVm.search_volume : (ssKwTrend.search_volume || ssKwTrend.searchVolume);
  var ssCpc = ssVm.avg_cpc != null ? ssVm.avg_cpc : (ssKwTrend.avg_cpc || ssKwTrend.avgCpc);
  var ssTotal = ssVm.product_count != null ? ssVm.product_count : (ssMktRpt.product_count || ssMktRpt.productCount);
  var ssPool = ssVm.sample_pool_size != null ? ssVm.sample_pool_size : _mktList(_mg(data, 'sellersprite', 'competitor_lookup')).length;
  var ssRatio = ssVm.supply_demand_ratio != null ? ssVm.supply_demand_ratio : ((ssVol && ssTotal) ? (ssVol / ssTotal) : null);
  var ssHtml = _mktSourceActive(data, 'sellersprite')
    ? _metric('月搜索量', _fmtNum(ssVol)) +
      _metric('商品总数', _fmtNum(ssTotal)) +
      _metric('竞品样本池', ssPool ? ssPool + ' 个' : '—') +
      _metric('需供比', ssRatio != null ? ssRatio.toFixed(3) : '—') +
      _metric('平均 CPC', ssCpc != null ? '$' + Number(ssCpc).toFixed(2) : '—')
    : _mktSourceEmpty('SellerSprite');

  // Demand lifecycle card (from SIF keyword_demand)
  var dmd = _mktVm(data, 'demand_tab') || {};
  var lc = dmd.lifecycle || {};
  var dmdHtml = '';
  if (lc.diagnosis) {
    var momColors = {accelerating:'var(--green)', stable:'var(--muted)', peaking_reversing:'var(--accent2)', recovering:'var(--green)', recent_weakening:'var(--red)'};
    var momColor = momColors[lc.trend_momentum] || 'var(--muted)';
    dmdHtml = '<div class="mkt-card" style="margin-bottom:10px;border-left:3px solid var(--green)">' +
      '<div class="mkt-card-head">📈 需求生命周期 · ' + escHtml(lc.diagnosis_cn || lc.diagnosis) + '</div>' +
      _metric('趋势方向', lc.trend_direction === 'growing' ? '📈 增长' : (lc.trend_direction === 'declining' ? '📉 下滑' : '➡ 平稳')) +
      _metric('近期动量', '<span style="color:' + momColor + ';font-weight:600">' + escHtml(lc.trend_momentum || '—') + '</span>') +
      _metric('同比变化', lc.yoy_change != null ? (lc.yoy_change >= 0 ? '+' : '') + (lc.yoy_change * 100).toFixed(1) + '%' : '—') +
      _metric('季节性强弱', lc.seasonality_strength ? ({high:'🔴 强', moderate:'🟡 中', low:'🟢 弱'})[lc.seasonality_strength] || lc.seasonality_strength : '—') +
      _metric('旺季月份', (lc.peak_months || []).join('月、') + '月') +
      _metric('距峰值', lc.weeks_to_peak != null ? lc.weeks_to_peak + ' 周' : '—') +
      _metric('行动建议', lc.action_hint || '—', 'mkt-accent') +
      (lc.interpretation ? '<div style="padding:8px 12px;margin-top:6px;background:var(--bg);border-radius:6px;font-size:.7rem;color:var(--muted)">💬 ' + escHtml(lc.interpretation) + '</div>' : '') +
      '</div>';
  }

  var html = _mktSummaryBanner(data) + dmdHtml +
    '<div class="mkt-section-title">SOP 1.1 供需比分析 — 搜索量 ÷ 商品数 = 进入难度</div>' +
    '<div class="mkt-col-grid">' +
    _mktCol('SIF · 关键词需求', 'sif', sifHtml) +
    _mktCol('Sorftime · 品类供给', 'st', stHtml) +
    _mktCol('SellerSprite · 品类供给', 'ss', ssHtml) +
    '</div>';
  document.getElementById('mktTabSupply').innerHTML = html;
}

// ── Tab 2: 品类难度 ──
function renderMarketDifficulty(data) {
  var vm = _mktVm(data, 'difficulty_tab') || {};
  var sifVm = vm.sif || {};
  var trend = _mg(data, 'sif', 'traffic_trend') || {};
  var sales = _mg(data, 'sif', 'sales_list') || {};
  var dates = trend.dates || [];
  var scores = trend.scores || [];
  if ((!dates.length || !scores.length) && Array.isArray(trend.trend)) {
    dates = trend.trend.map(function(x){return x.date;});
    scores = trend.trend.map(function(x){return x.total || x.score || x.traffic || x.SP || 0;});
  }
  var lastDate = sifVm.last_date || (dates.length ? dates[dates.length-1] : '—');
  var lastScore = sifVm.latest_traffic_score != null ? sifVm.latest_traffic_score : (scores.length ? scores[scores.length-1] : null);
  var avgScore = sifVm.avg_traffic_score != null ? sifVm.avg_traffic_score : (scores.length ? Math.round(scores.reduce(function(a,b){return a+(Number(b)||0);},0) / scores.length) : null);
  var salesItems = _mktList(sales);
  var s0 = salesItems[0] || {};
  var salesNum = sifVm.sales_30d != null ? sifVm.sales_30d : _mktNum(_mktVal(s0, 'boughtInPastMonth', 'bought_in_past_month', 'boughtInMonth'));
  var dailySales = sifVm.daily_sales_estimate != null ? sifVm.daily_sales_estimate : (salesNum ? Math.round(salesNum / 30) : null);

  var sifHtml = _metric('最新流量分数', _fmtNum(lastScore)) +
                _metric('近期平均分数', _fmtNum(avgScore)) +
                _metric('近30天销量', _fmtNum(salesNum)) +
                _metric('日均销量', dailySales != null ? dailySales + ' 单' : '—') +
                _metric('更新日期', lastDate);

  var stList = _mktList(_mg(data, 'sorftime', 'product_search'));
  var stTop = _mktVm(data, 'difficulty_tab', 'sorftime_top1') || stList[0] || {};
  var stHtml = _mktSourceActive(data, 'sorftime')
    ? ((stList.length > 0 || _mktVal(stTop, 'asin', '产品ASIN码', 'ASIN'))
        ? _metric('竞品样本池', stList.length ? stList.length + ' 个' : '—')
          + _metric('Top1 ASIN', _mktVal(stTop, 'asin', '产品ASIN码', 'ASIN') || '—')
          + _metric('Top1 价格', _mktVal(stTop, 'price', '价格') != null ? '$' + _mktVal(stTop, 'price', '价格') : '—')
          + _metric('Top1 评分', _mktVal(stTop, 'rating', '星级', 'star') || '—')
          + _metric('Top1 评论数', _fmtNum(_mktVal(stTop, 'review_count', '评论数', 'reviewCount')))
          + _metric('Top1 月销量', _fmtNum(_mktVal(stTop, 'monthly_sales', '月销量', 'monthlySales', 'sales')))
          + _metric('Top1 上架日期', _mktVal(stTop, 'listing_date', '上架时间', 'listingDate') || '—')
        : '<div class="mkt-empty-card">Sorftime 未返回竞品</div>')
    : _mktSourceEmpty('Sorftime');

  var ssList = _mktList(_mg(data, 'sellersprite', 'competitor_lookup'));
  var ssTop = _mktVm(data, 'difficulty_tab', 'sellersprite_top1') || ssList[0] || {};
  var ssHtml = _mktSourceActive(data, 'sellersprite')
    ? ((ssList.length > 0 || _mktVal(ssTop, 'asin', 'ASIN'))
        ? _metric('竞品样本池', ssList.length ? ssList.length + ' 个' : '—')
          + _metric('Top1 ASIN', _mktVal(ssTop, 'asin', 'ASIN') || '—')
          + _metric('Top1 BSR', _fmtNum(_mktVal(ssTop, 'bsr', 'rank')))
          + _metric('Top1 评分', _mktVal(ssTop, 'rating', 'star') || '—')
          + _metric('Top1 评论数', _fmtNum(_mktVal(ssTop, 'review_count', 'reviewCount', 'reviews')))
          + _metric('Top1 上架日期', _mktVal(ssTop, 'listing_date', 'listed_date', 'listingDate', 'listing_date') || '—')
        : '<div class="mkt-empty-card">SellerSprite 未返回竞品</div>')
    : _mktSourceEmpty('SellerSprite');

  // Traffic channel breakdown
  var traf = _mktVm(data, 'traffic_tab') || {};
  var chLatest = traf.channel_latest || {};
  var chTotal = traf.nf_total + traf.sp_total + traf.sb_total + traf.sbv_total;
  var chHtml = '';
  if (chTotal > 0) {
    chHtml = '<div class="mkt-card" style="margin-top:8px"><div class="mkt-card-head">📊 流量渠道拆解 · 自然占比 ' + (traf.natural_ratio != null ? (traf.natural_ratio * 100).toFixed(0) + '%' : '—') + '</div>' +
      _metric('自然流量(NF)', _fmtNum(traf.nf_total)) +
      _metric('SP广告', _fmtNum(traf.sp_total)) +
      _metric('SB广告', _fmtNum(traf.sb_total)) +
      _metric('SBV广告', _fmtNum(traf.sbv_total)) +
      _metric('广告合计(AD)', _fmtNum(traf.ad_total)) +
      _metric('整体趋势', traf.overall_direction || '—') +
      _metric('近期变化', traf.recent_change || '—') +
      '</div>';
  }

  // Market overview
  var moTab = _mktVm(data, 'market_overview_tab') || {};
  var mo = moTab.sellersprite || {};
  var moHtml = '';
  if (mo.fba_proportion != null || mo.total_products != null) {
    moHtml = '<div class="mkt-card" style="margin-top:8px"><div class="mkt-card-head">🏪 市场概览 · ' + escHtml(mo.node_label_cn || mo.node_label || '') + ' <span class="mkt-src-pill mkt-pill-ss">SS</span></div>' +
      '<div class="mkt-col-grid" style="grid-template-columns:1fr 1fr">' +
      '<div>' + _metric('FBA占比', mo.fba_proportion != null ? Number(mo.fba_proportion).toFixed(0) + '%' : '—') +
      _metric('FBM占比', mo.fbm_proportion != null ? Number(mo.fbm_proportion).toFixed(0) + '%' : '—') +
      _metric('Amazon自营', mo.amazon_self_proportion != null ? Number(mo.amazon_self_proportion).toFixed(0) + '%' : '—') +
      _metric('退货率', mo.return_ratio != null ? Number(mo.return_ratio).toFixed(1) + '%' : '—') + '</div>' +
      '<div>' + _metric('商品总数', _fmtNum(mo.total_products)) +
      _metric('月总销量', _fmtNum(mo.total_units)) +
      _metric('月总销售额', _fmtNum(mo.total_revenue)) +
      _metric('均价', mo.avg_price != null ? '$' + Number(mo.avg_price).toFixed(2) : '—') + '</div>' +
      '</div>' +
      _metric('品牌数', _fmtNum(mo.brands)) +
      _metric('卖家数(均)', mo.avg_sellers != null ? Number(mo.avg_sellers).toFixed(1) : '—') +
      _metric('主要卖家国', (mo.seller_nation || '—') + (mo.seller_proportion != null ? ' (' + Number(mo.seller_proportion).toFixed(0) + '%)' : '')) +
      _metric('平均利润', mo.avg_profit != null ? Number(mo.avg_profit).toFixed(1) + '%' : '—') +
      '</div>';
  }

  var html = '<div class="mkt-section-title">SOP 1.2 品类难度 — 评论量+上架天数+BSR 综合判断推广周期</div>' +
    '<div class="mkt-col-grid">' +
    _mktCol('SIF · 自身/对标流量', 'sif', sifHtml) +
    _mktCol('Sorftime · 竞品样本池(Top1)', 'st', stHtml) +
    _mktCol('SellerSprite · 竞品样本池(Top1)', 'ss', ssHtml) +
    '</div>' + chHtml + moHtml;
  document.getElementById('mktTabDifficulty').innerHTML = html;
}

// ── Tab 3: 产品筛选五条件 ──
function renderMarketFilter(data) {
  var vm = _mktVm(data, 'filter_tab') || {};
  var rowsVm = Array.isArray(vm.rows) ? vm.rows : [];

  function renderJudgeRow(row, idx) {
    var ok = row ? row.result : null;
    var cls = ok === true ? 'mkt-pass' : (ok === false ? 'mkt-fail' : 'mkt-warn');
    var sym = ok === true ? '✓' : (ok === false ? '✗' : '⚠');
    var val = row && row.value != null && row.value !== '' ? row.value : '—';
    return '<tr><td>' + (idx + 1) + ' ' + escHtml(row.label || '—') + '</td><td>' +
      escHtml(row.rule || '—') + '</td><td>' + escHtml(String(val)) +
      '</td><td class="' + cls + '">' + sym + '</td></tr>';
  }

  var rows = rowsVm.length
    ? rowsVm.map(renderJudgeRow).join('')
    : '<tr><td colspan="4">暂无五条件结果</td></tr>';

  var overall = vm.overall_pass;
  var overallText = overall === true ? '当前已通过可自动判定项' : (overall === false ? '当前未通过全部可自动判定项' : '仍含人工判断项');
  var overallCls = overall === true ? 'mkt-pass' : (overall === false ? 'mkt-fail' : 'mkt-warn');

  var html = '<div class="mkt-section-title">SOP 1.3 五条件 — 全部通过才考虑进入</div>' +
    '<div class="mkt-filter-table"><table>' +
    '<tr><th>条件</th><th>标准</th><th>当前值</th><th>判定</th></tr>' +
    rows + '</table></div>' +
    '<div style="margin-top:10px;font-size:.7rem" class="' + overallCls + '">总体判定：' + overallText + '</div>' +
    '<div style="margin-top:6px;font-size:.7rem;color:var(--muted)">数据来自已连接的 MCP 数据源，部分字段可能因数据源接口限制为空</div>';
  document.getElementById('mktTabFilter').innerHTML = html;
}

// ── Tab 4: 竞争扫描 ──
function renderMarketCompete(data) {
  var vm = _mktVm(data, 'compete_tab') || _mktNz(data, 'competition') || {};
  var sigs = _mg(data, 'sif', 'keyword_signals') || {};
  var topKws = sigs.top_keywords || [];
  var top3Click = _mg(vm, 'sif', 'top3_click_share');
  if (top3Click == null) top3Click = topKws.length ? Number(topKws[0].top3_click_share || 0) : 0;
  if (top3Click > 1) top3Click = top3Click / 100;
  var top3ClickPct = (top3Click * 100).toFixed(1);
  var kwSampleCount = _mg(vm, 'sif', 'keyword_sample_count');

  var sifHtml = _metric('Top3 点击集中度', top3ClickPct + '%',
                  top3Click < 0.5 ? 'green' : (top3Click > 0.65 ? 'red' : 'warn')) +
                _metric('关键词样本', _fmtNum(kwSampleCount != null ? kwSampleCount : topKws.length) + ' 个');

  var stPool = _mg(vm, 'sorftime', 'sample_pool_size');
  var stHighReviewCount = _mg(vm, 'sorftime', 'high_review_density_count');
  var stHtml = _mktSourceActive(data, 'sorftime')
    ? _metric('竞品样本池', _fmtNum(stPool != null ? stPool : _mktList(_mg(data, 'sorftime', 'product_search')).length) + ' 个') +
      _metric('高评论密度(>1000)', _fmtNum(stHighReviewCount != null ? stHighReviewCount : 0) + ' 条', stHighReviewCount <= 5 ? 'green' : (stHighReviewCount > 10 ? 'red' : 'warn'))
    : _mktSourceEmpty('Sorftime');

  var ssPool = _mg(vm, 'sellersprite', 'sample_pool_size');
  var ssHighReviewCount = _mg(vm, 'sellersprite', 'high_review_density_count');
  var ssHtml = _mktSourceActive(data, 'sellersprite')
    ? _metric('竞品样本池', _fmtNum(ssPool != null ? ssPool : _mktList(_mg(data, 'sellersprite', 'competitor_lookup')).length) + ' 个') +
      _metric('高评论密度(>1000)', _fmtNum(ssHighReviewCount != null ? ssHighReviewCount : 0) + ' 条', ssHighReviewCount <= 5 ? 'green' : (ssHighReviewCount > 10 ? 'red' : 'warn'))
    : _mktSourceEmpty('SellerSprite');

  var thresholdHtml =
    '<div class="mkt-filter-table" style="margin-top:8px"><table>' +
    '<tr><th>维度</th><th>健康线</th><th>警戒线</th></tr>' +
    '<tr><td>Top3 点击集中度</td><td class="mkt-pass">&lt; 50%</td><td class="mkt-fail">&gt; 65%</td></tr>' +
    '<tr><td>主关键词商品数</td><td class="mkt-pass">≤ 10,000</td><td class="mkt-fail">&gt; 100,000</td></tr>' +
    '<tr><td>高评论密度(&gt;1000)</td><td class="mkt-pass">≤ 5 条</td><td class="mkt-fail">&gt; 10 条</td></tr>' +
    '</table></div>';

  var html = '<div class="mkt-section-title">SOP 1.4 竞争扫描 — 判断是否被红海卡死</div>' +
    '<div class="mkt-col-grid">' +
    _mktCol('SIF · 点击集中度', 'sif', sifHtml) +
    _mktCol('Sorftime · 商品总数', 'st', stHtml) +
    _mktCol('SellerSprite · 商品总数', 'ss', ssHtml) +
    '</div>' + thresholdHtml;

  // Competitor list table (from SellerSprite competitor_lookup)
  var clTab = _mktVm(data, 'competitor_list_tab') || {};
  var competitors = clTab.sellersprite_competitors || clTab.sif_competitors || [];
  if (competitors.length > 0) {
    var hasVariantGroups = false;
    for (var vi = 0; vi < competitors.length; vi++) { if (competitors[vi].variant_group) { hasVariantGroups = true; break; } }
    html += '<div class="mkt-section-title" style="margin-top:12px">📋 竞品 Top' + competitors.length + ' 列表 <span class="mkt-src-pill mkt-pill-ss">SS</span></div>';
    html += '<div style="margin-top:4px;font-size:.65rem;color:var(--muted)">数据源: SellerSprite competitor_lookup | 品牌数: ' + (clTab.brand_count || '—') + '</div>';
    if (hasVariantGroups) {
      html += '<div style="margin-top:2px;font-size:.62rem;color:var(--accent2)">⚠ 同一品牌的变体共享评分/评论/BSR，表中数据为各变体独立表现</div>';
    }
    html += '<div class="mkt-filter-table" style="margin-top:6px"><table>';
    html += '<tr><th>#</th><th>ASIN</th><th>品牌</th><th>售价</th><th>月销</th><th>评分</th><th>评论</th><th>BSR</th><th>履约</th><th>卖家国</th></tr>';
    for (var ci = 0; ci < competitors.length; ci++) {
      var c = competitors[ci];
      var rowStyle = c.variant_group ? ' style="background:rgba(245,158,11,.04)"' : '';
      html += '<tr' + rowStyle + '>' +
        '<td>' + (ci + 1) + '</td>' +
        '<td><span title="' + escHtml(c.title || '') + '">' + escHtml((c.asin || '').substring(0, 10)) + '</span></td>' +
        '<td>' + escHtml(c.brand || '—') + '</td>' +
        '<td>' + (c.price != null ? '$' + Number(c.price).toFixed(2) : '—') + '</td>' +
        '<td>' + _fmtNum(c.monthly_sales) + '</td>' +
        '<td>' + (c.rating != null ? Number(c.rating).toFixed(1) + '★' : '—') + '</td>' +
        '<td>' + _fmtNum(c.ratings) + '</td>' +
        '<td>' + (c.bsr != null ? '#' + _fmtNum(c.bsr) : '—') + '</td>' +
        '<td>' + escHtml(c.fulfillment || '—') + '</td>' +
        '<td>' + escHtml(c.seller_nation || '—') + '</td>' +
        '</tr>';
    }
    html += '</table></div>';
  }

  document.getElementById('mktTabCompete').innerHTML = html;
}

// ── Tab 5: 关键词机会 ──
function renderMarketKwopp(data) {
  var vm = _mktVm(data, 'kwopp_tab') || _mktNz(data, 'keyword_opportunity') || {};
  var sigs = _mg(data, 'sif', 'keyword_signals') || {};
  var primary = sigs.primary_signals || {};
  var top = vm.top_keywords || sigs.top_keywords || [];
  var declining = vm.declining || primary.declining || [];
  var gaining = vm.gaining || primary.gaining || [];
  var rankGaps = vm.rank_gaps || primary.rank_gaps || [];

  function _kwList(items, dirLabel) {
    if (!items || items.length === 0) return '<div class="mkt-empty-card">无</div>';
    var html = '';
    items.slice(0,5).forEach(function(k){
      var kw = k.keyword || k.kw || '';
      var chg = k.contri_change || k.contriChange || 0;
      var sign = chg > 0 ? '+' : '';
      var cls = chg > 0 ? 'green' : (chg < 0 ? 'red' : '');
      html += '<div class="mkt-metric"><span class="mkt-metric-key">' + escHtml(kw) + '</span>' +
              '<span class="mkt-metric-val ' + cls + '">' + sign + (chg ? Number(chg).toFixed(3) : '—') + '</span></div>';
    });
    return html;
  }

  var col1 = _kwList(declining);
  var col2 = _kwList(gaining);
  var col3 = (rankGaps.length === 0)
    ? '<div class="mkt-empty-card">无</div>'
    : rankGaps.slice(0,5).map(function(k){
        return '<div class="mkt-metric"><span class="mkt-metric-key">' + escHtml(k.keyword || k.kw || '') + '</span>' +
               '<span class="mkt-metric-val warn">排名断档</span></div>';
      }).join('');

  // Health pie
  var health = vm.health_distribution || { core:0, at_risk:0, volatile:0, paid_dependent:0, standard:0 };
  if (!vm.health_distribution) {
    top.forEach(function(k){
      var h = k.keyword_health || k.health || 'standard';
      if (health[h] != null) health[h]++; else health.standard++;
    });
  }

  var healthHtml = '';
  ['core','at_risk','volatile','paid_dependent','standard'].forEach(function(t){
    var cls = t === 'core' ? 'core' : (t === 'at_risk' ? 'at_risk' : (t === 'volatile' ? 'volatile' : (t === 'paid_dependent' ? 'paid_dependent' : '')));
    var label = { core:'稳定主力', at_risk:'高风险', volatile:'排名不稳', paid_dependent:'付费依赖', standard:'普通' }[t];
    healthHtml += '<span class="mkt-kw-chip ' + cls + '">' + label + '×' + health[t] + '</span>';
  });

  var topHtml = top.slice(0,12).map(function(k){
    var h = k.keyword_health || k.health || 'standard';
    var sb = k.signal_bucket || '';
    var sbColors = {defend:'#22c55e', attack:'#f59e0b', monitor:'#ef4444', ignore:'#6b7280', explore:'#3b82f6'};
    var sbColor = sbColors[sb] || '';
    var cls = h === 'core' ? 'core' : (h === 'at_risk' ? 'at_risk' : (h === 'volatile' ? 'volatile' : (h === 'paid_dependent' ? 'paid_dependent' : '')));
    var sbLabel = {defend:'🛡防守', attack:'⚔进攻', monitor:'👁监控', ignore:'🚫忽略', explore:'🔍蓝海'}[sb] || '';
    var title = h + (sbLabel ? ' · ' + sbLabel : '') + ' | nat=' + (k.natural_ratio != null ? (Number(k.natural_ratio)*100).toFixed(0)+'%' : '—') + ' | ABAr=' + (k.aba_rank || '—');
    return '<span class="mkt-kw-chip ' + cls + '" style="' + (sbColor ? 'border-left:2px solid ' + sbColor : '') + '" title="' + title + '">' + escHtml(k.keyword || k.kw || '') + '</span>';
  }).join('');

  // Secondary signals hint
  var secHint = _mktVm(data, 'secondary_signals_hint') || '';
  var hintHtml = secHint ? '<div class="mkt-card" style="margin-top:6px;border-left:3px solid var(--accent2)"><div style="font-size:.7rem;color:var(--accent2);padding:6px 8px">💬 ' + escHtml(secHint) + '</div></div>' : '';

  // Longtail keywords (from SellerSprite keyword_miner)
  var ltTab = _mktVm(data, 'longtail_keywords_tab') || {};
  var ltItems = ltTab.keyword_miner_items || [];
  var ltHtml = '';
  if (ltItems.length > 0) {
    ltHtml = '<div class="mkt-section-title" style="margin-top:10px">🔍 长尾关键词 (SellerSprite keyword_miner) <span class="mkt-src-pill mkt-pill-ss">SS</span></div>';
    ltHtml += '<div class="mkt-filter-table" style="margin-top:4px"><table>';
    ltHtml += '<tr><th>关键词</th><th>中文</th><th>搜索量</th><th>CPC</th><th>供需比</th><th>购买率</th><th>均价</th><th>相关度</th></tr>';
    for (var li = 0; li < Math.min(ltItems.length, 20); li++) {
      var m = ltItems[li];
      ltHtml += '<tr>' +
        '<td>' + escHtml(m.keyword || '—') + '</td>' +
        '<td>' + escHtml(m.keyword_cn || '—') + '</td>' +
        '<td>' + _fmtNum(m.searches) + '</td>' +
        '<td>' + (m.bid != null ? '$' + Number(m.bid).toFixed(2) : '—') + '</td>' +
        '<td>' + (m.supply_demand_ratio != null ? Number(m.supply_demand_ratio).toFixed(1) : '—') + '</td>' +
        '<td>' + (m.purchase_rate != null ? (Number(m.purchase_rate)*100).toFixed(1)+'%' : '—') + '</td>' +
        '<td>' + (m.avg_price != null ? '$' + Number(m.avg_price).toFixed(2) : '—') + '</td>' +
        '<td>' + (m.relevancy != null ? Number(m.relevancy).toFixed(0) + '%' : '—') + '</td>' +
        '</tr>';
    }
    ltHtml += '</table></div>';
  }

  var html = '<div class="mkt-section-title">关键词机会 — SIF asin_keyword_signals (近30天)</div>' +
    '<div class="mkt-col-grid">' +
    _mktCol('Top3 下降词 (机会词)', 'sif', col1) +
    _mktCol('Top3 上升词 (高优先级)', 'sif', col2) +
    _mktCol('排名断档词 (不稳定)', 'sif', col3) +
    '</div>' + hintHtml +
    '<div class="mkt-card" style="margin-top:10px"><div class="mkt-card-head">关键词健康分布 <span class="mkt-src-pill mkt-pill-sif">SIF</span></div>' +
    '<div style="padding:4px 0">' + (healthHtml || '<div class="mkt-empty-card">暂无数据</div>') + '</div></div>' +
    '<div class="mkt-card" style="margin-top:10px"><div class="mkt-card-head">Top12 关键词 (四色健康·五类信号) <span class="mkt-src-pill mkt-pill-sif">SIF</span></div>' +
    '<div style="padding:4px 0">' + (topHtml || '<div class="mkt-empty-card">暂无数据</div>') + '</div></div>' +
    ltHtml;
  document.getElementById('mktTabKwopp').innerHTML = html;
}

// ── Tab 6: 1688 货源 ──
function renderMarketAli1688(data) {
  var tabVm = _mktVm(data, 'ali1688_tab') || {};
  // Three fallback paths: normalized > raw sorftime > view_model cached
  var list = _mktNz(data, 'ali1688_items') || [];
  if (!Array.isArray(list) || !list.length) {
    var ali = _mg(data, 'sorftime', 'ali1688') || {};
    list = _mktList(ali);
  }
  if (!Array.isArray(list) || !list.length) {
    list = (tabVm.table && tabVm.table.rows) || [];
  }

  if (!_mktSourceActive(data, 'sorftime')) {
    document.getElementById('mktTabAli1688').innerHTML =
      '<div class="mkt-section-title">1688 货源 (仅 Sorftime 提供)</div>' +
      '<div class="mkt-empty-card">未开启 Sorftime — 此 Tab 仅 Sorftime 数据源可用</div>';
    return;
  }

  if (!list.length) {
    var errMsg = _mktErrMsg(data, 'sorftime.ali1688') || tabVm.message || '';
    var raw = errMsg
      ? '<div class="mkt-empty-card">' + escHtml(errMsg) + '。可用 Sorftime product_search 的竞品样本继续做选品判断。</div>'
      : '<div class="mkt-empty-card">Sorftime 未返回 1688 相似商品数据</div>';
    document.getElementById('mktTabAli1688').innerHTML =
      '<div class="mkt-section-title">1688 货源 (Sorftime)</div>' + raw;
    return;
  }

  var rows = list.slice(0,10).map(function(it, i){
    var title = _mktVal(it, 'title', 'name', 'productName', '标题', '商品标题', '产品名称') || '';
    var price = _mktVal(it, 'unit_price', 'price', '单价', '价格', '批发价');
    var supplier = _mktVal(it, 'supplier', 'shop', '卖家', '供应商', '店铺', '公司', '厂名') || '';
    var offerUrl = _mktVal(it, 'offer_url', 'offerUrl', 'URL', 'url', '链接') || '';
    var imgUrl = _mktVal(it, 'image_url', 'imageUrl', '主图', 'img', '图片') || '';
    var imgHtml = imgUrl
      ? '<img src="' + escHtml(imgUrl) + '" style="width:60px;height:60px;object-fit:contain;border-radius:4px;background:var(--bg)" onerror="this.style.display=\'none\'">'
      : '—';
    var titleHtml = offerUrl
      ? '<a href="' + escHtml(offerUrl) + '" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none" title="打开1688商品页">' + escHtml(title) + '</a>'
      : escHtml(title);
    var supplierHtml = (supplier && offerUrl)
      ? '<a href="' + escHtml(offerUrl) + '" target="_blank" rel="noopener" style="color:var(--text);text-decoration:none" title="打开1688商品页">' + escHtml(supplier) + '</a>'
      : escHtml(supplier || '—');
    return '<tr><td>' + (i+1) + '</td>' +
      '<td>' + imgHtml + '</td>' +
      '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + titleHtml + '</td>' +
      '<td>' + (price != null ? '¥' + Number(price).toFixed(2) : '—') + '</td>' +
      '<td>' + supplierHtml + '</td></tr>';
  }).join('');

  var srcMsg = tabVm.message || '';
  var html = '<div class="mkt-section-title">1688 货源 — Sorftime <span class="mkt-src-pill mkt-pill-st">ST</span></div>' +
    (srcMsg ? '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">' + escHtml(srcMsg) + '</div>' : '') +
    '<div class="mkt-filter-table"><table>' +
    '<tr><th>#</th><th>主图</th><th>商品标题</th><th>单价</th><th>供应商</th></tr>' +
    rows + '</table></div>' +
    '<div style="margin-top:10px;font-size:.7rem;color:var(--muted)">★ 在售同款数: ' + list.length + ' 个</div>';
  document.getElementById('mktTabAli1688').innerHTML = html;
}

// ── Tab 7: 利润测算 (跳转到运营工具 Tab) ──
function renderMarketProfit(data) {
  var vm = _mktVm(data, 'profit_tab') || {};
  var jumpTarget = vm.jump_target || 'calc/calculator';
  var desc = vm.description || '利润测算使用「运营工具 → 盈亏计算器」完成。点击下方按钮跳转：';
  var html = '<div class="mkt-section-title">利润测算 — 跳转盈亏计算器</div>' +
    '<div class="mkt-card"><div class="mkt-card-head">操作</div>' +
    '<p style="font-size:.78rem;color:var(--text);margin:8px 0">' + escHtml(desc) + '</p>' +
    '<button class="mkt-jump-btn" onclick="switchMainTab(\'calc\');switchCalcTab(\'' + escHtml((jumpTarget.split('/')[1] || 'calculator')) + '\');">💰 跳转到盈亏计算器</button>' +
    '<p style="font-size:.7rem;color:var(--muted);margin-top:12px">支持 22 站汇率、FBA 自动计算、动态 ACOS、月利润预估</p>' +
    '</div>';
  document.getElementById('mktTabProfit').innerHTML = html;
}

// ── Tab 8: 成本估算 ──
function renderMarketCost(data) {
  var vm = _mktVm(data, 'cost_tab') || {};
  var inputs = vm.inputs || {};
  var result = vm.result || {};
  var stCpc = _mg(data, 'sorftime', 'keyword_trend', 'avg_cpc') || _mg(data, 'sorftime', 'keyword_trend', 'cpc');
  var ssCpc = _mg(data, 'normalized', 'market_overview', 'sellersprite', 'avg_cpc');
  var cpcRef = inputs.cpc_ref != null ? inputs.cpc_ref : (result.cpc_ref != null ? result.cpc_ref : (stCpc || ssCpc || ''));
  var defaultPrice = inputs.price != null ? inputs.price : '';
  var defaultMargin = inputs.margin != null ? Number(inputs.margin) * 100 : 30;
  var defaultCvr = inputs.cvr != null ? Number(inputs.cvr) * 100 : 10;
  var defaultFreight = inputs.freight_rmb_per_kg != null ? inputs.freight_rmb_per_kg : 35;
  var defaultDailyOrder = inputs.daily_order_plan != null ? inputs.daily_order_plan : 10;

  var html = '<div class="mkt-section-title">成本估算 — CPC 参考 + 采购/头程 + 回本周期</div>' +
    '<div class="mkt-card">' +
    '<div class="mkt-card-head">输入参数</div>' +
    '<div class="mkt-cost-form">' +
      '<div><label>参考 CPC (USD)</label><input type="number" id="mktCostCpc" value="' + (cpcRef ? Number(cpcRef).toFixed(2) : '') + '" step="0.01" placeholder="自动填充"></div>' +
      '<div><label>预计 CVR (%)</label><input type="number" id="mktCostCvr" value="' + defaultCvr + '" step="1"></div>' +
      '<div><label>客单价 (USD)</label><input type="number" id="mktCostPrice" value="' + (defaultPrice != null && defaultPrice !== '' ? Number(defaultPrice).toFixed(2) : '') + '" placeholder="如 29.99" step="0.01"></div>' +
      '<div><label>毛利率 (%)</label><input type="number" id="mktCostMargin" value="' + defaultMargin + '" step="1"></div>' +
      '<div><label>采购成本 (RMB)</label><input type="number" id="mktCostBuy" placeholder="如 35" step="0.01"></div>' +
      '<div><label>头程单价 (RMB/KG)</label><input type="number" id="mktCostFreight" value="' + defaultFreight + '" step="0.01"></div>' +
      '<div><label>计费重量 (KG)</label><input type="number" id="mktCostWeight" placeholder="如 0.5" step="0.01"></div>' +
      '<div><label>计划日销量 (单)</label><input type="number" id="mktCostDailyOrder" value="' + defaultDailyOrder + '" step="1"></div>' +
    '</div>' +
    '<button class="mkt-jump-btn" onclick="calcMarketCost()">📊 计算回本周期</button>' +
    '<div class="mkt-cost-result" id="mktCostResult" style="margin-top:10px;display:none"></div>' +
    '</div>';
  document.getElementById('mktTabCost').innerHTML = html;
}

function calcMarketCost() {
  var cpc = parseFloat(document.getElementById('mktCostCpc').value) || 0;
  var cvr = (parseFloat(document.getElementById('mktCostCvr').value) || 0) / 100;
  var price = parseFloat(document.getElementById('mktCostPrice').value) || 0;
  var margin = (parseFloat(document.getElementById('mktCostMargin').value) || 0) / 100;
  var buy = parseFloat(document.getElementById('mktCostBuy').value) || 0;
  var freight = parseFloat(document.getElementById('mktCostFreight').value) || 0;
  var weight = parseFloat(document.getElementById('mktCostWeight').value) || 0;
  var dailyOrder = parseFloat(document.getElementById('mktCostDailyOrder').value) || 0;

  if (!cpc || !cvr || !price || !buy) {
    document.getElementById('mktCostResult').style.display = 'block';
    document.getElementById('mktCostResult').innerHTML = '<span style="color:var(--red)">请填写至少 CPC / CVR / 客单价 / 采购成本</span>';
    return;
  }

  // 单单获客成本 (CPA)
  var cpa = cpc / cvr;
  // 单单广告占比
  var adRatio = price > 0 ? (cpa / price) : 0;
  // 单单成本 (USD) — 假设 1 USD = 7.2 RMB
  var rate = 7.2;
  var unitCostUsd = (buy + freight * weight) / rate;
  // 单单毛利
  var grossPerOrder = price * margin - cpa;
  // 日利润
  var dailyProfit = dailyOrder * grossPerOrder;
  // 头程总成本(USD) 假设首批 1000 件
  var batchSize = dailyOrder * 30;
  var totalCostUsd = batchSize * unitCostUsd;
  // 回本天数
  var paybackDays = dailyProfit > 0 ? Math.round(totalCostUsd / dailyProfit) : '∞';

  var html =
    '<div style="font-weight:700;font-size:.85rem;margin-bottom:8px;color:var(--text)">📊 测算结果</div>' +
    _metric('CPA (单单获客成本)', '$' + cpa.toFixed(2)) +
    _metric('广告占比 (CPA/客单价)', _fmtPct(adRatio), adRatio > 0.3 ? 'red' : (adRatio > 0.2 ? 'warn' : 'green')) +
    _metric('单单总成本 (USD)', '$' + unitCostUsd.toFixed(2)) +
    _metric('单单毛利', '$' + grossPerOrder.toFixed(2), grossPerOrder > 0 ? 'green' : 'red') +
    _metric('日利润 (按 ' + dailyOrder + ' 单)', '$' + dailyProfit.toFixed(2), dailyProfit > 0 ? 'green' : 'red') +
    _metric('30 天备货成本 (USD)', '$' + totalCostUsd.toFixed(2)) +
    _metric('回本周期', paybackDays === '∞' ? '亏损中' : paybackDays + ' 天',
        paybackDays === '∞' ? 'red' : (paybackDays > 90 ? 'warn' : 'green'));
  document.getElementById('mktCostResult').style.display = 'block';
  document.getElementById('mktCostResult').innerHTML = html;
}

// ── Tab 9: 价格带 ──
function renderMarketPriceBand(data) {
  var html = '<div class="mkt-section-title">价格带分析</div>';
  var mo = _mktNz(data, 'market_overview') || {};
  var sellersprite = mo.sellersprite || {};
  var sorftime = mo.sorftime || {};
  var sif = mo.sif || {};

  // Sorftime column
  var stHtml = '';
  if (_mktSourceActive(data, 'sorftime')) {
    var stPool = _mg(data, 'sorftime', 'product_search') || [];
    if (stPool.length > 0) {
      var priceBands = {};
      stPool.forEach(function(p) {
        var price = _mktNum(_mktVal(p, '价格', 'price', 'salePrice'));
        if (price != null) {
          var band = price < 10 ? '$0-10' : price < 20 ? '$10-20' : price < 30 ? '$20-30' : price < 50 ? '$30-50' : price < 100 ? '$50-100' : '$100+';
          priceBands[band] = (priceBands[band] || 0) + 1;
        }
      });
      stHtml = '<table style="width:100%;font-size:.72rem">' +
        '<tr style="color:var(--muted)"><th>价格区间</th><th>SKU 数</th><th>占比</th></tr>';
      var total = stPool.length;
      ['$0-10','$10-20','$20-30','$30-50','$50-100','$100+'].forEach(function(b) {
        var n = priceBands[b] || 0;
        stHtml += '<tr><td>' + b + '</td><td>' + n + '</td><td>' + _fmtPct(n/total) + '</td></tr>';
      });
      stHtml += '</table>';
    } else { stHtml = '<div class="mkt-empty-card">无产品数据</div>'; }
  } else { stHtml = _mktSourceEmpty('Sorftime'); }

  // SellerSprite column
  var ssHtml = '';
  if (_mktSourceActive(data, 'sellersprite')) {
    var ssAvgPrice = sellersprite.avg_price;
    var ssSupplyRatio = sellersprite.supply_demand_ratio_raw;
    ssHtml = _metric('均价', ssAvgPrice != null ? '$' + Number(ssAvgPrice).toFixed(2) : '—') +
      _metric('供需比', ssSupplyRatio != null ? Number(ssSupplyRatio).toFixed(2) : '—') +
      _metric('关键词CN', sellersprite.keyword_cn || '—') +
      _metric('购买率', _fmtPct(sellersprite.purchase_rate)) +
      _metric('增长率', _fmtPct(sellersprite.growth));
    if (!ssAvgPrice && !ssSupplyRatio) ssHtml = '<div class="mkt-empty-card">无关键词研究数据</div>';
  } else { ssHtml = _mktSourceEmpty('SellerSprite'); }

  // SIF column (demand snapshot from competition)
  var sifHtml = '';
  if (_mktSourceActive(data, 'sif')) {
    var comp = _mg(data, 'sif', 'keyword_competition') || {};
    var ds = comp.demand_snapshot || {};
    sifHtml = _metric('月搜索量级别', ds.volume_level || '—') +
      _metric('趋势', ds.trend || '—') +
      _metric('年增长', _fmtPct(ds.annual_rate)) +
      _metric('旺季周数', ds.weeks_to_peak != null ? ds.weeks_to_peak + ' 周' : '—');
  } else { sifHtml = _mktSourceEmpty('SIF'); }

  html += '<div class="mkt-col-grid">' +
    _mktCol('Sorftime 价格分布', 'st', stHtml) +
    _mktCol('SellerSprite 价格指标', 'ss', ssHtml) +
    _mktCol('SIF 需求快照', 'sif', sifHtml) +
    '</div>';
  var panel = document.getElementById('mktTabPriceband');
  if (panel) panel.innerHTML = html;
}

// ── Tab 10: 评论洞察 ──
function renderMarketReview(data) {
  var html = '<div class="mkt-section-title">评论洞察</div>';
  var ctx = _mktNz(data, 'context_product') || {};
  var sellersprite = (_mktNz(data, 'market_overview') || {}).sellersprite || {};

  // SIF - keyword signals (rating/review data from top keywords)
  var sifHtml = '';
  if (_mktSourceActive(data, 'sif')) {
    sifHtml = _metric('评分', ctx.rating != null ? ctx.rating : '—') +
      _metric('评论数', ctx.review_count != null ? _fmtNum(ctx.review_count) : '—') +
      _metric('LQS 质量分', ctx.lqs != null ? ctx.lqs : '—');
    var kwSignals = _mg(data, 'sif', 'keyword_signals') || {};
    var topKw = (kwSignals.top_keywords || [])[0] || {};
    sifHtml += _metric('Top1 词点击集中度', _fmtPct(topKw.top3_click_share)) +
      _metric('Top1 词转化集中度', _fmtPct(topKw.top3_conversion_share));
  } else { sifHtml = _mktSourceEmpty('SIF'); }

  // SellerSprite - keyword research avg rating/reviews
  var ssHtml = '';
  if (_mktSourceActive(data, 'sellersprite')) {
    ssHtml = _metric('类目均分', sellersprite.avg_rating != null ? sellersprite.avg_rating : '—') +
      _metric('类目均评数', sellersprite.avg_ratings != null ? _fmtNum(sellersprite.avg_ratings) : '—') +
      _metric('关键词CN', sellersprite.keyword_cn || '—');
    if (!sellersprite.avg_rating && !sellersprite.avg_ratings) ssHtml = '<div class="mkt-empty-card">无关键词研究数据</div>';
  } else { ssHtml = _mktSourceEmpty('SellerSprite'); }

  // Sorftime - product pool avg rating/reviews
  var stHtml = '';
  if (_mktSourceActive(data, 'sorftime')) {
    var stPool = _mg(data, 'sorftime', 'product_search') || [];
    if (stPool.length > 0) {
      var totalRating = 0, totalReviews = 0, count = 0;
      stPool.forEach(function(p) {
        var r = _mktNum(_mktVal(p, '星级', 'rating', 'star'));
        var rc = _mktNum(_mktVal(p, '评论数', 'review_count', 'reviewCount', 'reviews'));
        if (r != null) { totalRating += r; count++; }
        if (rc != null) totalReviews += rc;
      });
      stHtml = _metric('样本池均分', count > 0 ? (totalRating/count).toFixed(1) : '—') +
        _metric('样本池均评数', count > 0 ? _fmtNum(Math.round(totalReviews/count)) : '—') +
        _metric('样本池大小', _fmtNum(stPool.length));
    } else { stHtml = '<div class="mkt-empty-card">无产品数据</div>'; }
  } else { stHtml = _mktSourceEmpty('Sorftime'); }

  // Rating comparison insight
  var insight = '';
  if (ctx.rating != null && sellersprite.avg_rating != null) {
    var diff = ctx.rating - sellersprite.avg_rating;
    if (diff >= 1) insight = '<div class="mkt-metric" style="color:var(--green)">评分高于类目均值 ' + diff.toFixed(1) + ' 分，竞争优势明显</div>';
    else if (diff >= 0.3) insight = '<div class="mkt-metric" style="color:var(--green)">评分略高于类目均值 +' + diff.toFixed(1) + '</div>';
    else if (diff >= -0.3) insight = '<div class="mkt-metric" style="color:var(--accent2)">评分与类目均值持平</div>';
    else insight = '<div class="mkt-metric" style="color:var(--red)">评分低于类目均值 ' + Math.abs(diff).toFixed(1) + ' 分，需改进</div>';
  }

  html += insight + '<div class="mkt-col-grid">' +
    _mktCol('SIF 商品质量', 'sif', sifHtml) +
    _mktCol('SellerSprite 类目基准', 'ss', ssHtml) +
    _mktCol('Sorftime 样本池', 'st', stHtml) +
    '</div>';

  // ── Real review data from review_tab_full ──
  var rvTab = _mktVm(data, 'review_tab_full') || {};
  var reviewItems = rvTab.review_items || [];
  var starDist = rvTab.star_distribution || {};
  if (reviewItems.length > 0) {
    // Star distribution bar
    var starTotal = 0;
    ['5','4','3','2','1'].forEach(function(s){ starTotal += (starDist[s] || 0); });
    html += '<div class="mkt-section-title" style="margin-top:12px">⭐ 星级分布 (近10条评论)</div>';
    html += '<div style="display:flex;gap:6px;margin-top:8px;align-items:center">';
    ['5','4','3','2','1'].forEach(function(s){
      var cnt = starDist[s] || 0;
      var pct = starTotal > 0 ? (cnt / starTotal * 100) : 0;
      html += '<div style="flex:1;text-align:center;font-size:.65rem"><div>' + s + '★</div>' +
        '<div style="background:var(--bg);height:6px;border-radius:3px;margin:3px 0"><div style="background:var(--accent2);height:6px;border-radius:3px;width:' + pct + '%"></div></div>' +
        '<div style="font-weight:600">' + cnt + '</div></div>';
    });
    html += '</div>';

    // Recent reviews
    html += '<div class="mkt-section-title" style="margin-top:12px">📝 最新评论 <span class="mkt-src-pill mkt-pill-ss">SS</span></div>';
    for (var ri = 0; ri < Math.min(reviewItems.length, 5); ri++) {
      var rv = reviewItems[ri];
      var starsStr = '';
      for (var s = 0; s < (rv.star || 0); s++) starsStr += '★';
      var badges = [];
      if (rv.verified) badges.push('VP');
      if (rv.vine) badges.push('Vine');
      html += '<div class="mkt-card" style="margin-bottom:4px;padding:8px 10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
        '<span style="font-weight:600;font-size:.72rem;color:var(--accent2)">' + starsStr + '</span>' +
        '<span style="font-size:.62rem;color:var(--muted)">' + escHtml(rv.author || '—') + (badges.length ? ' · ' + badges.join(' ') : '') + '</span>' +
        '</div>' +
        '<div style="font-size:.7rem;font-weight:600;margin-bottom:2px">' + escHtml(rv.title || '') + '</div>' +
        '<div style="font-size:.65rem;color:var(--muted);line-height:1.4">' + escHtml((rv.content || '').substring(0, 200) + ((rv.content || '').length > 200 ? '...' : '')) + '</div>' +
        '</div>';
    }
  }

  var panel = document.getElementById('mktTabReview');
  if (panel) panel.innerHTML = html;
}
