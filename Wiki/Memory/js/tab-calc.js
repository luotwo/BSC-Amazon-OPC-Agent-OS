function switchCalcTab(tab) {
  document.querySelectorAll('#calcSubTabs .expert-tab').forEach(function(t){t.classList.remove('active');});
  ['calcTabCalculator'].forEach(function(id){document.getElementById(id).style.display='none';});
  var tabMap = {calculator:'calcTabCalculator'};
  var labels = {calculator:'盈亏计算器'};
  var btns = document.querySelectorAll('#calcSubTabs .expert-tab');
  for (var i=0;i<btns.length;i++) { if (btns[i].textContent.indexOf(labels[tab])!==-1) btns[i].classList.add('active'); }
  document.getElementById(tabMap[tab]).style.display='block';
}
// ── Profit Calculator ──
var _calcFbaManual = false;
var _calcFxMap = {US:7.23,UK:9.10,DE:7.85,FR:7.85,JP:0.048,CA:5.35,AU:4.75,IT:7.85,ES:7.85,MX:0.42,IN:0.087,BR:1.35,NL:7.85,SE:0.70,PL:1.85,BE:7.85,TR:0.23,AE:1.97,SA:1.93,SG:5.40,EG:0.23,ZA:0.39};
var _calcFxLive = null;

function calcFetchFx() {
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://open.er-api.com/v6/latest/CNY', true);
    xhr.timeout = 8000;
    xhr.onload = function() {
      if (xhr.status === 200) {
        var data = JSON.parse(xhr.responseText);
        if (data && data.rates) {
          _calcFxLive = {};
          var r = data.rates;
          _calcFxLive.US = 1/r.USD; _calcFxLive.UK = 1/r.GBP; _calcFxLive.DE = 1/r.EUR; _calcFxLive.FR = 1/r.EUR;
          _calcFxLive.JP = 1/r.JPY; _calcFxLive.CA = 1/r.CAD; _calcFxLive.AU = 1/r.AUD; _calcFxLive.IT = 1/r.EUR;
          _calcFxLive.ES = 1/r.EUR; _calcFxLive.MX = 1/r.MXN; _calcFxLive.IN = 1/r.INR; _calcFxLive.BR = 1/r.BRL;
          _calcFxLive.NL = 1/r.EUR; _calcFxLive.SE = 1/r.SEK; _calcFxLive.PL = 1/r.PLN; _calcFxLive.BE = 1/r.EUR;
          _calcFxLive.TR = 1/r.TRY; _calcFxLive.AE = 1/r.AED; _calcFxLive.SA = 1/r.SAR; _calcFxLive.SG = 1/r.SGD;
          _calcFxLive.EG = 1/r.EGP; _calcFxLive.ZA = 1/r.ZAR;
          var site = document.getElementById('calcSite').value;
          var rate = _calcFxLive[site];
          if (rate) { document.getElementById('calcFx').value = rate.toFixed(4); }
          calcUpdate();
        }
      }
    };
    xhr.send();
  } catch(e) {}
}

function calcSiteChange() {
  var site = document.getElementById('calcSite').value;
  if (_calcFxLive && _calcFxLive[site]) {
    document.getElementById('calcFx').value = _calcFxLive[site].toFixed(4);
  } else {
    document.getElementById('calcFx').value = (_calcFxMap[site] || 7.23).toFixed(2);
  }
  document.getElementById('calcFbaHint').style.display = site === 'US' ? 'none' : 'block';
  _calcFbaManual = false;
  document.getElementById('calcFba').value = '';
  document.getElementById('calcFba').placeholder = '自动计算';
  document.getElementById('calcFbaReset').style.display = 'none';
  document.getElementById('calcFbaAuto').textContent = '自动';
  calcUpdate();
}

function calcResetFba() {
  _calcFbaManual = false;
  document.getElementById('calcFba').value = '';
  document.getElementById('calcFba').placeholder = '自动计算';
  document.getElementById('calcFbaReset').style.display = 'none';
  document.getElementById('calcFbaAuto').textContent = '自动';
  calcUpdate();
}

function calcFbaUS(l, w, h, kg) {
  var lb = kg * 2.20462;
  var oz = lb * 16;
  var inches = [l/2.54, w/2.54, h/2.54].sort(function(a,b){return b-a});
  var girth = inches[1]*2 + inches[2]*2;
  var dimWt = l*w*h / (2.54*2.54*2.54) / 139;
  var billableLb = Math.max(lb, dimWt);
  if (billableLb <= 0.75 && inches[0] <= 15 && inches[1] <= 12 && inches[2] <= 0.75) return 3.41;
  if (billableLb <= 1 && inches[0] <= 15 && inches[1] <= 12 && inches[2] <= 0.75) return 4.07;
  if (oz <= 4 && inches[0] <= 12 && inches[1] <= 8 && inches[2] <= 2) return 3.54;
  if (oz <= 8 && inches[0] <= 12 && inches[1] <= 8 && inches[2] <= 2) return 3.80;
  if (oz <= 12 && inches[0] <= 12 && inches[1] <= 8 && inches[2] <= 2) return 4.16;
  if (oz <= 16 && inches[0] <= 12 && inches[1] <= 8 && inches[2] <= 2) return 4.52;
  if (billableLb <= 2 && inches[0] <= 18 && inches[1] <= 14 && (inches[2]<=8||girth<=33) && girth <= 33) {
    if (oz <= 4) return 4.30; if (oz <= 8) return 4.44; if (oz <= 12) return 4.56; if (oz <= 16) return 5.05;
    if (billableLb <= 1.5) return 5.27; return 5.72;
  }
  if (billableLb <= 3 && inches[0] <= 18 && inches[1] <= 14 && inches[2] <= 8) {
    if (billableLb <= 2) return 6.08; return 6.64;
  }
  if (billableLb <= 20 && inches[0] <= 18 && inches[1] <= 14 && inches[2] <= 8) {
    if (billableLb <= 5) return 7.32; if (billableLb <= 10) return 8.41; return 9.58;
  }
  if (billableLb <= 50 && inches[0] <= 30 && inches[1] <= 18 && inches[2] <= 12 && girth <= 56){
    if (billableLb <= 20) return 11.56; if (billableLb <= 30) return 13.52; if (billableLb <= 40) return 15.51; return 17.50;
  }
  if (billableLb <= 70 && inches[0] <= 36 && inches[1] <= 24 && inches[2] <= 18 && girth <= 72){
    if (billableLb <= 50) return 21.32; return 24.22;
  }
  return 6.08;
}

function calcUpdate() {
  var site = document.getElementById('calcSite').value;
  if (!site) return;
  var fx = parseFloat(document.getElementById('calcFx').value) || 7.23;
  var kg = parseFloat(document.getElementById('calcWeight').value) || 0;
  var l = parseFloat(document.getElementById('calcLen').value) || 0;
  var w = parseFloat(document.getElementById('calcWid').value) || 0;
  var h = parseFloat(document.getElementById('calcHei').value) || 0;
  var costRmb = parseFloat(document.getElementById('calcCost').value) || 0;
  var freightRate = parseFloat(document.getElementById('calcFreight').value) || 0;
  var dim = parseFloat(document.getElementById('calcDim').value) || 167;
  var otherFgn = parseFloat(document.getElementById('calcOther').value) || 0;
  var price = parseFloat(document.getElementById('calcPrice').value) || 0;
  var coupon = (parseFloat(document.getElementById('calcCoupon').value) || 0) / 100;
  var referral = (parseFloat(document.getElementById('calcReferral').value) || 0) / 100;
  var returnRate = (parseFloat(document.getElementById('calcReturn').value) || 0) / 100;
  var vat = (parseFloat(document.getElementById('calcVat').value) || 0) / 100;
  var adBudget = parseFloat(document.getElementById('calcAdBudget').value) || 0;
  var cpc = parseFloat(document.getElementById('calcCpc').value) || 0;
  var natClicks = parseFloat(document.getElementById('calcNatClicks').value) || 0;
  var cvr = (parseFloat(document.getElementById('calcCvr').value) || 0) / 100;

  // Volume / Weight / Freight
  var vol = l * w * h / 1e6;
  var volWt = vol * dim;
  var chgWt = Math.max(kg, volWt);
  var frtRmb = chgWt * freightRate;
  var frtFgn = fx > 0 ? frtRmb / fx : 0;
  var costFgn = fx > 0 ? costRmb / fx : 0;

  // FBA
  var fbaVal = parseFloat(document.getElementById('calcFba').value);
  var fbaManual = !isNaN(fbaVal) && document.getElementById('calcFba').value !== '';
  if (!fbaManual) {
    if (site === 'US') fbaVal = calcFbaUS(l, w, h, kg);
    else fbaVal = 3.50; // default for non-US
    document.getElementById('calcFbaAuto').textContent = '自动';
  } else {
    _calcFbaManual = true;
    document.getElementById('calcFbaAuto').textContent = '手动';
    document.getElementById('calcFbaReset').style.display = 'inline-block';
  }
  if (!_calcFbaManual) {
    document.getElementById('calcFbaReset').style.display = 'none';
    document.getElementById('calcFba').value = '';
    document.getElementById('calcFba').placeholder = '自动 ' + fbaVal.toFixed(2);
  }

  // Cost breakdown
  var discPrice = price * (1 - coupon);
  var commission = discPrice * referral;
  var vatCost = discPrice * vat;
  var returnLoss = discPrice * returnRate;
  var totalCost = costFgn + frtFgn + commission + fbaVal + vatCost + returnLoss + otherFgn;
  var grossProfit = discPrice - totalCost;
  var grossMargin = discPrice > 0 ? grossProfit / discPrice * 100 : 0;
  var beAcos = grossMargin;

  // Ad simulation
  var adClicks = cpc > 0 ? adBudget / cpc : 0;
  var dailySales = (adClicks + natClicks) * cvr;
  var adOrders = adClicks * cvr;
  var adOrderPct = dailySales > 0 ? adOrders / dailySales * 100 : 0;
  var dailyRevenue = dailySales * discPrice;
  var dynamicAcos = dailyRevenue > 0 ? adBudget / dailyRevenue * 100 : 0;
  var roi = adBudget > 0 ? dailyRevenue / adBudget : 0;
  var dailyNet = dailySales * grossProfit - adBudget;
  var netMargin = dailyRevenue > 0 ? dailyNet / dailyRevenue * 100 : 0;
  var cpa = adOrders > 0 ? adBudget / adOrders : 0;

  // Monthly
  var monthProfitCny = dailyNet * 30 * fx;

  // Status
  var status, badgeCls;
  if (netMargin > 20) { status = '利润丰厚'; badgeCls = 'great'; }
  else if (netMargin > 10) { status = '小赚'; badgeCls = 'good'; }
  else if (netMargin > 0) { status = '微利'; badgeCls = 'ok'; }
  else if (netMargin > -10) { status = '轻微亏损'; badgeCls = 'warn'; }
  else { status = '亏损'; badgeCls = 'bad'; }

  // Render
  var fmtM = function(v) { return (v>=0?'+':'')+v.toFixed(2); };
  var cP = function(v) { return v >= 0 ? '#22c55e':'#ef4444'; };

  document.getElementById('resVol').textContent = vol.toFixed(4) + ' m³';
  document.getElementById('resVolWt').textContent = volWt.toFixed(2) + ' KG';
  document.getElementById('resChgWt').textContent = chgWt.toFixed(2) + ' KG';
  document.getElementById('resFrt').textContent = '¥' + frtRmb.toFixed(2) + ' / $' + frtFgn.toFixed(2);

  document.getElementById('resBeAcos').textContent = beAcos.toFixed(1) + '%';
  document.getElementById('resBeAcos').style.color = beAcos > 25 ? '#22c55e' : beAcos > 10 ? '#F97316' : '#ef4444';
  document.getElementById('resProfit2').textContent = '$' + grossProfit.toFixed(2);
  document.getElementById('resProfit2').style.color = cP(grossProfit);
  document.getElementById('resMargin2').textContent = grossMargin.toFixed(1) + '%';
  document.getElementById('resMargin2').style.color = cP(grossMargin);

  document.getElementById('calcBadge').textContent = status;
  document.getElementById('calcBadge').className = 'calc-badge ' + badgeCls;
  document.getElementById('resAcos').textContent = dynamicAcos.toFixed(1) + '%';
  document.getElementById('resRoas').textContent = roi.toFixed(1) + 'x';
  document.getElementById('resDailySales').textContent = Math.round(dailySales);
  document.getElementById('resAdPct').textContent = adOrderPct.toFixed(0) + '%';
  document.getElementById('resNetMargin').textContent = netMargin.toFixed(1) + '%';
  document.getElementById('resNetMargin').style.color = cP(netMargin);
  document.getElementById('resCpa').textContent = '$' + cpa.toFixed(2);
  document.getElementById('resDayProfit').textContent = '$' + fmtM(dailyNet);
  document.getElementById('resDayProfit').style.color = cP(dailyNet);
  document.getElementById('resMonthProfitCny').textContent = '¥' + Math.abs(Math.round(monthProfitCny)).toLocaleString();
  document.getElementById('resMonthProfitCny').style.color = cP(monthProfitCny);

  // Cost breakdown
  var bd = '';
  bd += '<div class="calc-breakdown-line"><span>折后售价:</span><strong>$' + discPrice.toFixed(2) + '</strong></div>';
  bd += '<div class="calc-breakdown-line"><span>- 采购成本:</span><span style="color:#ef4444">-$' + costFgn.toFixed(2) + '</span></div>';
  bd += '<div class="calc-breakdown-line"><span>- 头程费用:</span><span style="color:#ef4444">-$' + frtFgn.toFixed(2) + '</span></div>';
  bd += '<div class="calc-breakdown-line"><span>- 平台佣金:</span><span style="color:#ef4444">-$' + commission.toFixed(2) + '</span></div>';
  bd += '<div class="calc-breakdown-line"><span>- FBA费用:</span><span style="color:#ef4444">-$' + fbaVal.toFixed(2) + '</span></div>';
  if (vatCost > 0) bd += '<div class="calc-breakdown-line"><span>- VAT/关税:</span><span style="color:#ef4444">-$' + vatCost.toFixed(2) + '</span></div>';
  bd += '<div class="calc-breakdown-line"><span>- 退货损耗:</span><span style="color:#ef4444">-$' + returnLoss.toFixed(2) + '</span></div>';
  if (otherFgn > 0) bd += '<div class="calc-breakdown-line"><span>- 其他成本:</span><span style="color:#ef4444">-$' + otherFgn.toFixed(2) + '</span></div>';
  bd += '<div class="calc-breakdown-line bb"><span>毛利润:</span><strong style="color:' + cP(grossProfit) + '">$' + grossProfit.toFixed(2) + '</strong></div>';
  document.getElementById('calcBreakdown').innerHTML = bd;
}

document.addEventListener('DOMContentLoaded', function(){ tplLoad(); calcFetchFx(); calcUpdate(); });
document.getElementById('tplNewModal').addEventListener('click', function(e){ if(e.target===this) tplCloseNewModal(); });


// Ad Inspect — ASIN → Campaign → AdGroup
var AD_INSPECT_STATE = { data: null, asin: '', country: '', campaigns: [], level: 1, level2_data: null, level2_display_name: '', level2_campaign_id: '' };

async function startAdInspect() {
  var asin = document.getElementById('adAsin').value.trim();
  var country = document.getElementById('adCountry').value;
  if (!country) { showToast('请选择站点'); return; }
  if (!asin) { showToast('请输入 ASIN'); return; }
  if (!/^[A-Za-z0-9]{5,15}$/.test(asin)) { showToast('ASIN 格式错误'); return; }
  try { await getAdSettings(); } catch(e) {}
  switchAdTab('inspect');
  var p = document.getElementById('aiPanelEmpty');
  if (p) p.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在采集 ASIN 级广告数据...</div></div>';
  var jid = 'adinsp' + Date.now().toString(36) + Math.random().toString(36).substr(2,6);
  var qs = '?asin=' + encodeURIComponent(asin) + '&country=' + encodeURIComponent(country);
  try {
    var r = await fetch('/api/ad-inspect/' + jid + qs);
    var data = await r.json();
    if (data.error) { showToast('分析失败：' + data.error); adInspectShowError(data.error); return; }
    AD_INSPECT_STATE = { data: data, asin: asin, country: country, campaigns: data.campaigns || [], level: 1 };
    renderAdInspectL1();
  } catch(err) { showToast('请求失败：' + err.message); adInspectShowError(err.message); }
}

function adInspectShowError(msg) {
  var p = document.getElementById('aiPanelEmpty');
  if (p) p.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">采集失败：' + escHtml(msg || '未知错误') + '</div>';
}

// Breadcrumb: parts = [[label, isActive, onclickFn], ...]
function adBr(parts) {
  var h = '';
  for (var i = 0; i < parts.length; i++) {
    var c = parts[i];
    if (i > 0) h += ' <span style="color:var(--muted)">→</span> ';
    if (c[1]) h += '<span style="color:var(--accent);font-weight:700">' + c[0] + '</span>';
    else h += '<span style="cursor:pointer;color:var(--muted);text-decoration:underline" onclick="' + c[2] + '">' + c[0] + '</span>';
  }
  return '<div style="padding:6px 0;font-size:.72rem;border-bottom:1px solid var(--border);margin-bottom:10px">🔍 ' + h + '</div>';
}

// ═══ L1: ASIN ═══
function renderAdInspectL1() { var t=document.getElementById('aiSubTabs');if(t)t.style.display='flex'; var p2=document.getElementById('aiPanelEmpty');if(p2)p2.style.display='none'; switchAiTab(1);
  var st = AD_INSPECT_STATE;
  var d = (st.data && st.data.data) || {};
  var camps = st.campaigns || [];
  var html = adBr([['ASIN: ' + escHtml(st.asin), true]]);

  // ad_structure
  var s = d.ad_structure || {};
  var types = s.ad_types || [];
  html += '<div class="mkt-section-title">🏗 广告架构总览 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  html += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">范围: ' + escHtml(s.structureScope || 'historical') + ' | Campaign 总数: <b>' + (s.total_campaign_count || 0) + '</b></div>';
  html += '<div class="mkt-col-grid">';
  if (types.length) { types.forEach(function(t){ html += '<div class="mkt-metric"><span class="mkt-metric-label" style="color:' + ({SP:'var(--accent)',SB:'var(--green)',SBV:'var(--accent2)'}[t.type]||'') + '">' + escHtml(t.type) + '</span><span class="mkt-metric-value" style="font-size:1.1rem">' + _fmtNum(t.campaign_count || 0) + '</span></div>'; }); }
  html += '</div>';
  if (types.length) html += _aiBar(types.map(function(t){return{label:t.type,value:t.campaign_count||0,color:{SP:'var(--accent)',SB:'var(--green)',SBV:'var(--accent2)'}[t.type]||'var(--muted)'};}),{h:70,bw:28,gap:16});

  // historical_profile
  var hp = d.historical_profile || {};
  var feats = hp.features || {};
  var evo = hp.evolution_summary || {};
  var sigs = hp.signals || {};
  html += '<div class="mkt-section-title" style="margin-top:12px">📈 历史广告特征画像 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  var fl = {dominant_ad_type:'主导广告类型',contribution_concentration:'贡献集中度',launch_rhythm:'投放节奏',structure_complexity:'架构复杂度',growth_mode:'增长模式',type_diversification:'类型多样化',maturity_level:'成熟度',ad_type_evolution_pattern:'类型演变模式',emerging_ad_type:'新兴广告类型'};
  if (Object.keys(feats).length) { html += '<div class="mkt-col-grid">'; for (var k in feats) html += '<div class="mkt-metric"><span class="mkt-metric-label">' + escHtml(fl[k]||k) + '</span><span class="mkt-metric-value" style="font-size:.75rem">' + escHtml(String(feats[k]!=null?feats[k]:'—')) + '</span></div>'; html += '</div>'; }
  var phases = evo.phases || [];
  if (phases.length) {
    html += '<div style="font-size:.68rem;font-weight:600;margin:6px 0 4px">🔄 投放演进 (' + (evo.stage_count||0) + ' 阶段)</div>';
    for (var pi=0; pi<phases.length; pi++) { var p=phases[pi]; html += '<div class="mkt-card" style="margin:0 0 6px 0;padding:6px 10px;border-left:3px solid '+(pi===0?'var(--accent)':pi===1?'var(--green)':'var(--accent2)')+'"><span style="font-size:.68rem;font-weight:600">'+escHtml(p.stage||'—')+'</span> <span style="font-size:.62rem;color:var(--muted)">'+escHtml(p.window||'')+'</span><br><span style="font-size:.62rem;color:var(--muted)">主导: <b>'+escHtml((p.dominant_types||[]).join(', '))+'</b> — '+escHtml(p.summary||'')+'</span></div>'; }
  }
  if (Object.keys(sigs).length) {
    var sl = {total_campaign_count:'Campaign总数',sp_campaign_count:'SP数量',sb_campaign_count:'SB数量',sbv_campaign_count:'SBV数量',historical_active_type_count:'活跃类型数',historical_top_1_share:'Top1份额',historical_top_3_share:'Top3份额',history_span_days:'历史跨度(天)',granularity:'粒度'};
    html += '<div class="mkt-col-grid" style="margin-top:8px">'; for (var k in sigs) { var v=sigs[k],d2=v; if(typeof v==='number'&&k.indexOf('share')>=0)d2=(v*100).toFixed(1)+'%'; else if(typeof v==='number')d2=_fmtNum(v); html += '<div class="mkt-metric"><span class="mkt-metric-label">'+escHtml(sl[k]||k)+'</span><span class="mkt-metric-value" style="font-size:.7rem">'+escHtml(String(d2))+'</span></div>'; } html += '</div>';
  }
  if (!Object.keys(feats).length && !phases.length && !Object.keys(sigs).length) {
    html += '<div class="mkt-empty-card" style="margin-top:4px">SIF 暂无历史特征画像数据<br><small>该 ASIN 广告历史较短或数据暂未覆盖，可稍后重试</small></div>';
  }

  // traffic_trend
  var tr = d.ad_traffic_trend || {};
  var td = tr.trend || [];
  var ta = tr.trend_analysis || {};
  html += '<div class="mkt-section-title" style="margin-top:12px">📈 流量趋势 (' + escHtml(tr.granularity||'week') + ') <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  html += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">指标: ' + escHtml(tr.metric||'impressions') + '</div>';
  if (Object.keys(ta).length) {
    html += '<div class="mkt-col-grid" style="margin-bottom:8px">';
    [{k:'SP',v:ta.SP_trend},{k:'SB',v:ta.SB_trend},{k:'SBV',v:ta.SBV_trend},{k:'整体',v:ta.overall_trend},{k:'主力渠道',v:ta.dominant_channel}].forEach(function(t){ var cm={growing:'var(--green)',stable:'var(--accent2)',declining:'var(--red)',inactive:'var(--muted)',emerging:'var(--accent)'}; html += '<div class="mkt-metric"><span class="mkt-metric-label">'+t.k+'</span><span class="mkt-metric-value" style="color:'+(cm[t.v]||'')+'">'+escHtml(t.v||'—')+'</span></div>'; });
    html += '</div>';
  }
  if (td.length) {
    html += '<div style="font-size:.62rem;color:var(--muted);margin-bottom:2px">近12周 SP/SB/SBV 曝光堆叠图 <small style="color:var(--accent)">SP</small> <small style="color:var(--green)">SB</small> <small style="color:var(--accent2)">SBV</small></div>';
    html += _aiBar(td.slice(-12).map(function(w){return{label:(w.date||'').substring(5),segs:[{value:w.SP||0,color:'var(--accent)',label:'SP'},{value:w.SB||0,color:'var(--green)',label:'SB'},{value:w.SBV||0,color:'var(--accent2)',label:'SBV'}]};}),{h:80,bw:12,gap:3});
    html += '<details><summary style="cursor:pointer;font-size:.7rem;color:var(--accent);margin-bottom:4px">展开流量时序表 ('+td.length+' 周)</summary>';
    html += '<div class="mkt-filter-table" style="max-height:300px;overflow-y:auto"><table><tr><th>周</th><th>SP</th><th>SB</th><th>SBV</th><th>合计</th></tr>';
    td.slice(-20).forEach(function(w){ var sum=(w.SP||0)+(w.SB||0)+(w.SBV||0); html += '<tr><td>'+escHtml(w.date||'—')+'</td><td>'+_fmtNum(w.SP)+'</td><td>'+_fmtNum(w.SB)+'</td><td>'+_fmtNum(w.SBV)+'</td><td style="font-weight:600">'+_fmtNum(sum)+'</td></tr>'; });
    html += '</table></div></details>';
  }

  // campaign_changes
  var cc = d.campaign_changes || {};
  var changes = cc.campaign_changes || [];
  if (changes.length) {
    html += '<div class="mkt-section-title" style="margin-top:12px">📅 Campaign 创建事件 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
    var tc2 = {}; changes.forEach(function(ev){ var t=ev.ad_type||'?'; tc2[t]=(tc2[t]||0)+1; });
    html += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">总计 '+changes.length+' 个 | '; var first=true; for(var k in tc2){ if(!first)html+=' · '; first=false; html+=escHtml(k)+': '+tc2[k]; } html += '</div>';
    html += '<details><summary style="cursor:pointer;font-size:.7rem;color:var(--accent);margin-bottom:4px">展开事件列表 (最近100条)</summary>';
    html += '<div class="mkt-filter-table" style="max-height:300px;overflow-y:auto"><table><tr><th>日期</th><th>类型</th><th>Campaign ID</th></tr>';
    changes.slice(0,100).forEach(function(ev){ html += '<tr><td>'+escHtml(ev.date||'—')+'</td><td>'+escHtml(ev.ad_type||ev.change_type||'—')+'</td><td style="font-family:monospace;font-size:.6rem">'+escHtml(ev.campaign_id||'—')+'</td></tr>'; });
    if (changes.length>100) html += '<tr><td colspan="3" style="color:var(--muted);text-align:center">…… 还有 '+(changes.length-100)+' 条 ……</td></tr>';
    html += '</table></div></details>';
  }

  // campaign_contribution
  if (camps.length) {
    var ctr = d.campaign_contribution || {};
    html += '<div class="mkt-section-title" style="margin-top:12px">📊 Campaign 贡献排名 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
    html += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">指标: '+escHtml(ctr.metric||'exposure_score')+' | 窗口: '+escHtml(ctr.start_date||'')+' ~ '+escHtml(ctr.end_date||'')+' | 点击行下钻</div>';
    html += '<div class="mkt-filter-table"><table><tr><th>#</th><th>Campaign 名称</th><th>展示ID</th><th>类型</th><th>贡献等级</th><th>曝光得分</th><th>占比</th><th>创建日期</th></tr>';
    camps.forEach(function(c,i){
      var tc={dominant:'var(--red)',major:'var(--accent2)',supporting:'var(--accent)',minor:'var(--muted)'};
      html += '<tr class="ad-insp-row" data-cid="'+escHtml(c.campaign_id||'')+'" data-did="'+escHtml(c.campaign_display_id||'')+'" data-idx="'+i+'">';
      html += '<td>'+(c.rank||i+1)+'</td><td style="font-weight:600">'+escHtml(c.campaign_name||c.campaign_display_id||'—')+'</td>';
      html += '<td style="font-family:monospace;font-size:.62rem">'+escHtml(c.campaign_display_id||c.campaign_id||'—')+'</td>';
      html += '<td>'+escHtml(c.ad_type||'—')+'</td>';
      html += '<td><span style="color:'+(tc[c.contribution_tier]||'')+';font-weight:600">'+escHtml(c.contribution_tier||'—')+'</span></td>';
      html += '<td>'+_fmtNum(c.contribution_score)+'</td>';
      html += '<td><span style="font-weight:600">'+(c.share!=null?(Number(c.share)*100).toFixed(1)+'%':'—')+'</span></td>';
      html += '<td>'+escHtml(c.created_date||'—')+'</td></tr>';
    });
    html += '</table></div>';
  }

  var panel = document.getElementById('aiPanelEmpty');
  if (panel) panel.innerHTML = html;
}

// Event delegation for campaign rows
document.addEventListener('click', function(e){
  var row = e.target.closest('.ad-insp-row');
  if (!row) return;
  var cid = row.getAttribute('data-cid');
  var did = row.getAttribute('data-did');
  var idx = row.getAttribute('data-idx');
  if (cid && did) adInspectL2(cid, did, idx);
});

// ═══ L2: Campaign ═══
async function adInspectL2(campaignId, displayId, rowIdx) {
  var st = AD_INSPECT_STATE;
  var panel = document.getElementById('aiPanelEmpty');
  if (panel) panel.innerHTML = adBr([['ASIN: '+escHtml(st.asin),false,'renderAdInspectL1()'],['Campaign: '+escHtml(displayId||campaignId),true]])+'<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在加载 Campaign 详情...</div></div>';
  var qs = '?asin='+encodeURIComponent(st.asin)+'&campaignId='+encodeURIComponent(campaignId)+'&country='+encodeURIComponent(st.country);
  try {
    var r = await fetch('/api/ad-inspect-campaign'+qs);
    var data = await r.json();
    if (data.error) { panel.innerHTML = adBr([['ASIN: '+escHtml(st.asin),false,'renderAdInspectL1()']])+'<div class="mkt-empty-card" style="color:var(--red)">加载失败：'+escHtml(data.error)+'</div>'; return; }
    st.level2_data = data; st.level2_display_name = displayId||campaignId||''; st.level2_campaign_id = campaignId;
    renderAdInspectL2();
  } catch(err) { if (panel) panel.innerHTML = adBr([['ASIN: '+escHtml(st.asin),false,'renderAdInspectL1()']])+'<div class="mkt-empty-card" style="color:var(--red)">请求失败：'+escHtml(err.message)+'</div>'; }
}

function renderAdInspectL2() { document.getElementById('aiTabBtnL2').style.display='inline-flex'; switchAiTab(2);
  var st = AD_INSPECT_STATE;
  var data = st.level2_data || {};
  var d = data.data || {};
  var dn = st.level2_display_name || '';
  var cid = st.level2_campaign_id || '';
  var html = adBr([['ASIN: '+escHtml(st.asin),false,'renderAdInspectL1()'],['Campaign: '+escHtml(dn),true]]);

  // campaign_structure
  var cs = d.campaign_structure || {};
  var ags = cs.adGroups || [];
  html += '<div class="mkt-section-title">📦 Campaign 架构 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  html += '<div class="mkt-col-grid"><div class="mkt-metric"><span class="mkt-metric-label">类型</span><span class="mkt-metric-value">'+escHtml(cs.campaignType||'—')+'</span></div><div class="mkt-metric"><span class="mkt-metric-label">展示ID</span><span class="mkt-metric-value" style="font-family:monospace;font-size:.7rem">'+escHtml(cs.campaignDisplayId||'—')+'</span></div><div class="mkt-metric"><span class="mkt-metric-label">AdGroup数</span><span class="mkt-metric-value">'+(cs.adGroupCount||ags.length)+'</span></div><div class="mkt-metric"><span class="mkt-metric-label">范围</span><span class="mkt-metric-value">'+escHtml(cs.structureScope||'—')+'</span></div></div>';
  if (ags.length) {
    html += '<div class="mkt-filter-table"><table><tr><th>AdGroup ID</th><th>类型</th><th>变体数</th><th>历史关键词数</th><th>创建日期</th><th></th></tr>';
    ags.forEach(function(ag){
      html += '<tr><td style="font-family:monospace;font-size:.62rem">'+escHtml(ag.adGroupId||'—')+'</td><td>'+escHtml(ag.adGroupType||'—')+'</td><td>'+(ag.variantCount!=null?ag.variantCount:'—')+'</td><td>'+_fmtNum(ag.historicalKeywordCount)+'</td><td>'+escHtml(ag.adGroupCreateDate||'—')+'</td><td><button class="btn-edit" style="font-size:.6rem;padding:2px 6px" onclick="event.stopPropagation();adInspectL3(\''+escHtml(ag.adGroupId)+'\',\''+escHtml(cid)+'\')">🔍 下钻</button></td></tr>';
    });
    html += '</table></div>';
  }

  // campaign_traffic_trend
  var ct = d.campaign_traffic_trend || {};
  var ctd = ct.trafficTrend || [];
  var cta = ct.trend_analysis || {};
  var evts = ct.events || [];
  html += '<div class="mkt-section-title" style="margin-top:12px">📈 Campaign 流量趋势 (全生命周期) <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  if (Object.keys(cta).length) { html += '<div class="mkt-col-grid"><div class="mkt-metric"><span class="mkt-metric-label">整体走势</span><span class="mkt-metric-value">'+escHtml(cta.overall_direction||'—')+'</span></div><div class="mkt-metric"><span class="mkt-metric-label">近期变化</span><span class="mkt-metric-value">'+escHtml(cta.recent_change||'—')+'</span></div></div>'; }
  var aw = cta.anomaly_weeks || [];
  if (aw.length) html += '<div style="font-size:.65rem;color:var(--red);margin-bottom:6px">⚠ 异常周: '+aw.map(function(w){return '<b>'+escHtml(w)+'</b>';}).join(', ')+' | 事件: '+evts.length+' 个</div>';
  if (ctd.length) {
    html += '<div style="font-size:.62rem;color:var(--muted);margin-bottom:2px">近12周曝光趋势</div>';
    html += _aiBar(ctd.slice(-12).map(function(w){var v=w.traffic||0;return{label:(w.date||'').substring(5),value:v,color:v>0?'var(--accent)':'var(--muted)'};}),{h:80,bw:12,gap:3});
    html += '<details><summary style="cursor:pointer;font-size:.7rem;color:var(--accent);margin-bottom:4px">展开流量时序表 ('+ctd.length+' 周)</summary>';
    html += '<div class="mkt-filter-table" style="max-height:250px;overflow-y:auto"><table><tr><th>周</th><th>曝光得分</th><th>变化率</th><th>信号</th><th>事件</th></tr>';
    var sm = {significant_gain:'var(--green)',moderate_gain:'var(--accent)',stable:'var(--muted)',moderate_drop:'var(--accent2)',significant_drop:'var(--red)'};
    ctd.slice(-16).forEach(function(w){
      var el=''; evts.forEach(function(ev){ if(ev.date===w.date) el+=' +AG:'+escHtml((ev.adGroupId||'').substring(0,8)); });
      html += '<tr><td>'+escHtml(w.date||'—')+'</td><td>'+_fmtNum(w.traffic)+'</td><td style="color:'+(sm[w.change_signal]||'')+';font-weight:600">'+(w.trafficChangeRate!=null?(Number(w.trafficChangeRate)>=0?'+':'')+(Number(w.trafficChangeRate)*100).toFixed(1)+'%':'—')+'</td><td style="color:'+(sm[w.change_signal]||'')+'">'+escHtml(w.change_signal||'—')+'</td><td style="font-size:.58rem">'+el+'</td></tr>';
    });
    html += '</table></div></details>';
  }

  // contribution_keyword
  var kwD = d.contribution_keyword || {};
  var kwItems = kwD.items || [];
  html += '<div class="mkt-section-title" style="margin-top:12px">🔑 关键词贡献明细 ('+kwItems.length+' 词) <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  if (kwItems.length) {
    html += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">窗口: '+escHtml((kwD.timeRange||{}).start_date||'')+' ~ '+escHtml((kwD.timeRange||{}).end_date||'')+'</div>';
    html += '<div class="mkt-filter-table" style="max-height:500px;overflow-y:auto"><table><tr><th>关键词</th><th>翻译</th><th>曝光得分</th><th>占比</th><th>变化量</th><th>变化率</th><th>AG数</th></tr>';
    kwItems.slice(0,30).forEach(function(kw,ki){
      var cr = kw.trafficChangeRate!=null?(Number(kw.trafficChangeRate)*100).toFixed(1)+'%':'—';
      var cc2 = kw.trafficChangeRate>0?'var(--green)':(kw.trafficChangeRate<0?'var(--red)':'var(--muted)');
      var agn = ((kw.exposedAdGroups||kw.adGroupContributions||[])).length;
      html += '<tr><td style="font-weight:600">'+escHtml(kw.keyword||'—')+'</td><td style="color:var(--muted);font-size:.62rem">'+escHtml(kw.translateKeyword||'')+'</td><td>'+_fmtNum(kw.traffic)+'</td><td>'+(kw.trafficShare!=null?(Number(kw.trafficShare)*100).toFixed(1)+'%':'—')+'</td><td>'+_fmtNum(kw.trafficChange)+'</td><td style="color:'+cc2+';font-weight:600">'+cr+'</td><td>'+agn+'</td></tr>';
    });
    html += '</table></div>';
  }

  // contribution_adgroup
  var agD = d.contribution_adgroup || {};
  var agItems = agD.items || [];
  if (agItems.length) {
    html += '<div class="mkt-section-title" style="margin-top:12px">📊 AdGroup 贡献汇总 ('+agItems.length+' 组) <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
    html += '<div class="mkt-filter-table" style="max-height:300px;overflow-y:auto"><table><tr><th>AdGroup ID</th><th>曝光得分</th><th>占比</th><th>变化量</th><th>变化率</th><th>变体数</th></tr>';
    agItems.forEach(function(ag){ html += '<tr><td style="font-family:monospace;font-size:.62rem">'+escHtml(ag.adGroupId||'—')+'</td><td>'+_fmtNum(ag.traffic)+'</td><td>'+(ag.trafficShare!=null?(Number(ag.trafficShare)*100).toFixed(1)+'%':'—')+'</td><td>'+_fmtNum(ag.trafficChange)+'</td><td>'+(ag.trafficChangeRate!=null?(Number(ag.trafficChangeRate)*100).toFixed(1)+'%':'—')+'</td><td>'+(ag.variantCount||'—')+'</td></tr>'; });
    html += '</table></div>';
  }

  var panel = document.getElementById('aiPanelEmpty');
  if (panel) panel.innerHTML = html;
}

// ═══ L3: AdGroup ═══
async function adInspectL3(adGroupId, campaignId) {
  var st = AD_INSPECT_STATE;
  st.level3_adgroup_id = adGroupId;
  var panel = document.getElementById('aiPanelEmpty');
  var cn = st.level2_display_name || campaignId || '—';
  if (panel) panel.innerHTML = adBr([['ASIN: '+escHtml(st.asin),false,'renderAdInspectL1()'],['Campaign: '+escHtml(cn),false,'renderAdInspectL2()'],['AdGroup: '+escHtml(adGroupId),true]])+'<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在加载 AdGroup 详情...</div></div>';
  var qs = '?asin='+encodeURIComponent(st.asin)+'&campaignId='+encodeURIComponent(campaignId)+'&adGroupId='+encodeURIComponent(adGroupId)+'&country='+encodeURIComponent(st.country);
  try {
    var r = await fetch('/api/ad-inspect-adgroup'+qs);
    var data = await r.json();
    if (data.error) { panel.innerHTML = adBr([['ASIN: '+escHtml(st.asin),false,'renderAdInspectL1()'],['Campaign: '+escHtml(cn),false,'renderAdInspectL2()']])+'<div class="mkt-empty-card" style="color:var(--red)">加载失败：'+escHtml(data.error)+'</div>'; return; }
    renderAdInspectL3(data);
  } catch(err) { if (panel) panel.innerHTML = adBr([['ASIN: '+escHtml(st.asin),false,'renderAdInspectL1()'],['Campaign: '+escHtml(cn),false,'renderAdInspectL2()']])+'<div class="mkt-empty-card" style="color:var(--red)">请求失败：'+escHtml(err.message)+'</div>'; }
}

function renderAdInspectL3(data) { document.getElementById('aiTabBtnL3').style.display='inline-flex'; switchAiTab(3);
  var st = AD_INSPECT_STATE;
  var d = data.data || {};
  var agid = st.level3_adgroup_id || data.adgroup_id || '';
  var cn = st.level2_display_name || data.campaign_id || '—';
  var html = adBr([['ASIN: '+escHtml(st.asin),false,'renderAdInspectL1()'],['Campaign: '+escHtml(cn),false,'renderAdInspectL2()'],['AdGroup: '+escHtml(agid),true]]);

  // adgroup_traffic_trend
  var agt = d.adgroup_traffic_trend || {};
  var agtd = agt.trafficTrend || [];
  html += '<div class="mkt-section-title">📈 AdGroup 流量趋势 (全生命周期) <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  html += '<div class="mkt-col-grid"><div class="mkt-metric"><span class="mkt-metric-label">Campaign</span><span class="mkt-metric-value" style="font-family:monospace;font-size:.62rem">'+escHtml(agt.campaignDisplayId||agt.campaignId||'—')+'</span></div><div class="mkt-metric"><span class="mkt-metric-label">类型</span><span class="mkt-metric-value">'+escHtml(agt.campaignType||'—')+'</span></div><div class="mkt-metric"><span class="mkt-metric-label">范围</span><span class="mkt-metric-value">'+escHtml(agt.trendScope||'—')+'</span></div></div>';
  if (agtd.length) {
    html += '<div style="font-size:.62rem;color:var(--muted);margin-bottom:2px">近12周曝光趋势</div>';
    html += _aiBar(agtd.slice(-12).map(function(w){var v=w.traffic||0;return{label:(w.date||'').substring(5),value:v,color:v>0?'var(--accent)':'var(--muted)'};}),{h:80,bw:12,gap:3});
    html += '<details><summary style="cursor:pointer;font-size:.7rem;color:var(--accent);margin-bottom:4px">展开流量时序表 ('+agtd.length+' 周)</summary>';
    html += '<div class="mkt-filter-table" style="max-height:250px;overflow-y:auto"><table><tr><th>周</th><th>曝光量</th><th>变化量</th><th>变化率</th></tr>';
    agtd.slice(-20).forEach(function(w){ var r2=w.trafficChangeRate!=null?(Number(w.trafficChangeRate)*100).toFixed(1)+'%':'—'; html += '<tr><td>'+escHtml(w.date||'—')+'</td><td>'+_fmtNum(w.traffic)+'</td><td>'+_fmtNum(w.trafficChange)+'</td><td>'+r2+'</td></tr>'; });
    html += '</table></div></details>';
  }

  // adgroup_keyword_breakdown
  var akb = d.adgroup_keyword_breakdown || {};
  var akws = akb.keywords || [];
  var dasins = akb.displayAsins || [];
  html += '<div class="mkt-section-title" style="margin-top:12px">🔑 关键词流量拆解 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  html += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">日期: '+escHtml(akb.date||'')+' | 展示 ASIN: '+dasins.map(function(a){return '<code style="font-family:monospace;font-size:.6rem;margin-right:4px">'+escHtml(a)+'</code>';}).join('')+'</div>';
  if (akws.length) {
    html += '<div class="mkt-filter-table" style="max-height:500px;overflow-y:auto"><table><tr><th>关键词</th><th>翻译</th><th>流量占比</th><th>展示 ASIN</th></tr>';
    akws.forEach(function(kw){ var as = (kw.displayAsins||[]).map(function(a){return '<code style="font-size:.55rem;margin-right:2px">'+escHtml(a)+'</code>';}).join(''); html += '<tr><td style="font-weight:600">'+escHtml(kw.keyword||'—')+'</td><td style="color:var(--muted);font-size:.62rem">'+escHtml(kw.translateKeyword||'')+'</td><td><span style="font-weight:600">'+(kw.trafficShareWithinAdGroup!=null?(Number(kw.trafficShareWithinAdGroup)*100).toFixed(2)+'%':'—')+'</span></td><td style="font-size:.55rem">'+(as||'—')+'</td></tr>'; });
    html += '</table></div>';
  } else {
    html += '<div class="mkt-empty-card">暂无关键词拆解数据<br><small>该 AdGroup 可能暂无流量或数据延迟</small></div>';
  }

  var panel = document.getElementById('aiPanelEmpty');
  if (panel) panel.innerHTML = html;
}
