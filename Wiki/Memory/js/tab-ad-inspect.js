// ═══ Ad Inspect v2 — ASIN → Campaign → AdGroup ═══
function switchAiTab(level) {
  var st = document.getElementById('aiSubTabs'); if (st) st.style.display = 'flex';
  ['aiPanelL1','aiPanelL2','aiPanelL3'].forEach(function(id,i){ var p=document.getElementById(id); if(p)p.style.display=(i+1===level)?'block':'none'; });
  ['aiTabBtnL1','aiTabBtnL2','aiTabBtnL3'].forEach(function(bid,i){ var b=document.getElementById(bid); if(b){b.classList.toggle('active',i+1===level);b.style.display=(i+1<=level||AI['l'+(i+1)+'d'])?'inline-flex':'none';} });
}
var AI = { data: null, asin: '', country: '', l2d: null, l2name: '', l2cid: '', l3agid: '' };

// _aiBar now uses SVG curve from app-utils.js

async function startAdInspect() {
  var a = document.getElementById('adAsin').value.trim();
  var c = document.getElementById('adCountry').value;
  if (!c) { showToast('请选择站点'); return; }
  if (!a) { showToast('请输入 ASIN'); return; }
  if (!/^[A-Za-z0-9]{5,15}$/.test(a)) { showToast('ASIN 格式错误'); return; }
  try { await getAdSettings(); } catch(e) {}
  showToast('正在查询广告架构下钻数据，预计 10-30 秒，请耐心等待…', 'info');
  var btn = document.querySelector('#mainTabAdAnalysis .btn-mkt-start[onclick*="startAdInspect"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 查询中...'; }
  // Show inspect panel without calling switchAdTab (avoid recursion)
  document.querySelectorAll('#adSubTabs .expert-tab').forEach(function(t){t.classList.remove('active');});
  ['adTabDashboard','adTabCampaign','adTabKeyword','adTabSearchterm','adTabBidbudget','adTabPlacement','adTabCompete','adTabInspect'].forEach(function(id){
    document.getElementById(id).style.display = 'none';
  });
  // Find the "查广告" sub-tab button by text and activate it
  document.querySelectorAll('#adSubTabs .expert-tab').forEach(function(btn){
    if (btn.textContent.indexOf('查广告') >= 0) btn.classList.add('active');
  });
  document.getElementById('adTabInspect').style.display = 'block';
  var pe = document.getElementById('aiPanelEmpty'); if (pe) pe.style.display = 'none';
  var pl = document.getElementById('aiPanelL1'); if (pl) pl.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在采集 ASIN 级数据...</div></div>';
  document.getElementById('aiSubTabs').style.display = 'flex';
  switchAiTab(1);
  document.getElementById('aiTabBtnL2').style.display = 'none';
  document.getElementById('aiTabBtnL3').style.display = 'none';
  var jid = 'ai' + Date.now().toString(36) + Math.random().toString(36).substr(2,6);
  try {
    var r = await fetch('/api/ad-inspect/' + jid + '?asin=' + encodeURIComponent(a) + '&country=' + encodeURIComponent(c));
    var d = await r.json();
    if (btn) { btn.disabled = false; btn.textContent = '🔍 查广告'; }
    if (d.error) { showToast('分析失败：' + d.error); return; }
    AI = { data: d, asin: a, country: c, l2d: null, l2name: '', l2cid: '', l3agid: '' };
    renderL1();
  } catch(err) {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 查广告'; }
    showToast('请求失败：' + err.message);
  }
}

function aiBC(parts) {
  var h = '';
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (i > 0) h += ' <span style="color:var(--muted)">&rarr;</span> ';
    if (p[1]) h += '<b style="color:var(--accent)">' + p[0] + '</b>';
    else h += '<a style="color:var(--muted);cursor:pointer;text-decoration:underline" onclick="' + p[2] + '">' + p[0] + '</a>';
  }
  return '<div style="padding:6px 0;font-size:.72rem;border-bottom:1px solid var(--border);margin-bottom:10px">&#128269; ' + h + '</div>';
}

// ═══ L1 ═══
function renderL1() {
  var d = (AI.data && AI.data.data) || {};
  var camps = AI.data.campaigns || [];
  var h = aiBC([['ASIN: ' + escHtml(AI.asin), true]]);

  // 1. ad_structure
  var s = d.ad_structure || {};
  var types = s.ad_types || [];
  h += '<div class="mkt-section-title">&#x1F3D7; 广告架构总览 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  h += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">范围: ' + escHtml(s.structureScope||'historical') + ' | Campaign 总数: <b>' + (s.total_campaign_count||0) + '</b></div>';
  h += '<div class="mkt-col-grid">';
  var tc = {SP: 'var(--accent)', SB: 'var(--green)', SBV: 'var(--accent2)'};
  types.forEach(function(t){ h += '<div class="mkt-metric"><span class="mkt-metric-label" style="color:'+(tc[t.type]||'')+'">'+escHtml(t.type)+'</span><span class="mkt-metric-value" style="font-size:1.1rem">'+_fmtNum(t.campaign_count||0)+'</span></div>'; });
  h += '</div>';
  if (types.length) h += _aiBar(types.map(function(t){return{label:t.type,value:t.campaign_count||0,color:tc[t.type]||'var(--muted)'};}),{h:70,bw:28,gap:16});

  // 2. historical_profile
  var hp = d.historical_profile || {};
  var feats = hp.features || {};
  var evo = hp.evolution_summary || {};
  var sigs = hp.signals || {};
  h += '<div class="mkt-section-title" style="margin-top:12px">&#x1F4C8; 历史广告特征画像 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  var fl = {dominant_ad_type:'主导类型',contribution_concentration:'集中度',launch_rhythm:'投放节奏',structure_complexity:'架构复杂度',growth_mode:'增长模式',type_diversification:'类型多样化',maturity_level:'成熟度',ad_type_evolution_pattern:'演变模式',emerging_ad_type:'新兴类型'};
  if (Object.keys(feats).length) { h += '<div class="mkt-col-grid">'; for (var k in feats) h += '<div class="mkt-metric"><span class="mkt-metric-label">'+escHtml(fl[k]||k)+'</span><span class="mkt-metric-value" style="font-size:.75rem">'+escHtml(String(feats[k]!=null?feats[k]:'—'))+'</span></div>'; h += '</div>'; }
  var ph = evo.phases || [];
  if (ph.length) {
    h += '<div style="font-size:.68rem;font-weight:600;margin:6px 0 4px">&#x1F504; 投放演进 ('+(evo.stage_count||0)+' 阶段)</div>';
    for (var pi=0;pi<ph.length;pi++) { var p=ph[pi]; h += '<div class="mkt-card" style="margin:0 0 6px 0;padding:6px 10px;border-left:3px solid '+(pi===0?'var(--accent)':pi===1?'var(--green)':'var(--accent2)')+'"><span style="font-size:.68rem;font-weight:600">'+escHtml(p.stage||'—')+'</span> <span style="font-size:.62rem;color:var(--muted)">'+escHtml(p.window||'')+'</span><br><span style="font-size:.62rem;color:var(--muted)">主导: <b>'+escHtml((p.dominant_types||[]).join(', '))+'</b> — '+escHtml(p.summary||'')+'</span></div>'; }
  }
  if (Object.keys(sigs).length) {
    var sl = {total_campaign_count:'Campaign总数',sp_campaign_count:'SP',sb_campaign_count:'SB',sbv_campaign_count:'SBV',historical_active_type_count:'活跃类型',historical_top_1_share:'Top1份额',historical_top_3_share:'Top3份额',history_span_days:'跨度(天)'};
    h += '<div class="mkt-col-grid" style="margin-top:8px">'; for (var k in sigs) { var v=sigs[k],d2=v; if(typeof v==='number'&&k.indexOf('share')>=0)d2=(v*100).toFixed(1)+'%'; else if(typeof v==='number')d2=_fmtNum(v); h += '<div class="mkt-metric"><span class="mkt-metric-label">'+escHtml(sl[k]||k)+'</span><span class="mkt-metric-value" style="font-size:.7rem">'+escHtml(String(d2))+'</span></div>'; } h += '</div>';
  }
  if (!Object.keys(feats).length && !ph.length && !Object.keys(sigs).length) {
    h += '<div class="mkt-empty-card" style="margin-top:4px">SIF 暂无历史特征画像数据<br><small>该 ASIN 广告历史较短或数据暂未覆盖，可稍后重试</small></div>';
  }

  // 3. traffic_trend
  var tr = d.ad_traffic_trend || {};
  var td = tr.trend || [];
  var ta = tr.trend_analysis || {};
  h += '<div class="mkt-section-title" style="margin-top:12px">&#x1F4C8; 流量趋势 ('+escHtml(tr.granularity||'week')+') <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  h += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">指标: '+escHtml(tr.metric||'impressions')+'</div>';
  if (Object.keys(ta).length) {
    h += '<div class="mkt-col-grid" style="margin-bottom:8px">';
    [{k:'SP',v:ta.SP_trend},{k:'SB',v:ta.SB_trend},{k:'SBV',v:ta.SBV_trend},{k:'整体',v:ta.overall_trend},{k:'主力',v:ta.dominant_channel}].forEach(function(t){ var cm={growing:'var(--green)',stable:'var(--accent2)',declining:'var(--red)',inactive:'var(--muted)',emerging:'var(--accent)'}; h += '<div class="mkt-metric"><span class="mkt-metric-label">'+t.k+'</span><span class="mkt-metric-value" style="color:'+(cm[t.v]||'')+'">'+escHtml(t.v||'—')+'</span></div>'; });
    h += '</div>';
  }
  if (td.length) {
    h += '<div style="font-size:.62rem;color:var(--muted);margin-bottom:2px">&#x1F4CA; 近12周 SP/SB/SBV 曝光堆叠图 <small style="color:var(--accent)">SP</small> <small style="color:var(--green)">SB</small> <small style="color:var(--accent2)">SBV</small></div>';
    h += _aiBar(td.slice(-12).map(function(w){return{label:(w.date||'').substring(5),segs:[{value:w.SP||0,color:'var(--accent)',label:'SP'},{value:w.SB||0,color:'var(--green)',label:'SB'},{value:w.SBV||0,color:'var(--accent2)',label:'SBV'}]};}),{h:80,bw:12,gap:3});
    h += '<details><summary style="cursor:pointer;font-size:.7rem;color:var(--accent);margin-bottom:4px">展开时序表 ('+td.length+' 周)</summary>';
    h += '<div class="mkt-filter-table" style="max-height:300px;overflow-y:auto"><table><tr><th>周</th><th>SP</th><th>SB</th><th>SBV</th><th>合计</th></tr>';
    td.slice(-20).forEach(function(w){ var s2=(w.SP||0)+(w.SB||0)+(w.SBV||0); h += '<tr><td>'+escHtml(w.date||'—')+'</td><td>'+_fmtNum(w.SP)+'</td><td>'+_fmtNum(w.SB)+'</td><td>'+_fmtNum(w.SBV)+'</td><td style="font-weight:600">'+_fmtNum(s2)+'</td></tr>'; });
    h += '</table></div></details>';
  }

  // 4. campaign_changes
  var cc = d.campaign_changes || {};
  var chg = cc.campaign_changes || [];
  if (chg.length) {
    h += '<div class="mkt-section-title" style="margin-top:12px">&#x1F4C5; Campaign 创建事件 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
    var t2 = {}; chg.forEach(function(ev){ var t=ev.ad_type||'?'; t2[t]=(t2[t]||0)+1; });
    h += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">总计 '+chg.length+' 个 | '; var f2=true; for(var k in t2){ if(!f2)h+=' · '; f2=false; h+=escHtml(k)+': '+t2[k]; } h += '</div>';
    h += '<details><summary style="cursor:pointer;font-size:.7rem;color:var(--accent);margin-bottom:4px">展开 (最近100条)</summary>';
    h += '<div class="mkt-filter-table" style="max-height:300px;overflow-y:auto"><table><tr><th>日期</th><th>类型</th><th>Campaign ID</th></tr>';
    chg.slice(0,100).forEach(function(ev){ h += '<tr><td>'+escHtml(ev.date||'—')+'</td><td>'+escHtml(ev.ad_type||ev.change_type||'—')+'</td><td style="font-family:monospace;font-size:.6rem">'+escHtml(ev.campaign_id||'—')+'</td></tr>'; });
    if (chg.length>100) h += '<tr><td colspan="3" style="color:var(--muted);text-align:center">... 还有 '+(chg.length-100)+' 条 ...</td></tr>';
    h += '</table></div></details>';
  }

  // 5. campaign_contribution → click to L2
  if (camps.length) {
    var ctr = d.campaign_contribution || {};
    h += '<div class="mkt-section-title" style="margin-top:12px">&#x1F4CA; Campaign 贡献排名 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
    h += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">指标: '+escHtml(ctr.metric||'exposure_score')+' | 窗口: '+escHtml(ctr.start_date||'')+' ~ '+escHtml(ctr.end_date||'')+' | <b style="color:var(--accent2)">点击行下钻到 Campaign 层</b></div>';
    h += '<div class="mkt-filter-table"><table><tr><th>#</th><th>名称</th><th>展示ID</th><th>类型</th><th>等级</th><th>曝光得分</th><th>占比</th><th>创建日期</th></tr>';
    camps.forEach(function(c,i){
      var tc2={dominant:'var(--red)',major:'var(--accent2)',supporting:'var(--accent)',minor:'var(--muted)'};
      h += '<tr class="ai-row" data-cid="'+escHtml(c.campaign_id||'')+'" data-did="'+escHtml(c.campaign_display_id||'')+'" data-idx="'+i+'" style="cursor:pointer">';
      h += '<td>'+(c.rank||i+1)+'</td><td style="font-weight:600">'+escHtml(c.campaign_name||c.campaign_display_id||'—')+'</td>';
      h += '<td style="font-family:monospace;font-size:.62rem">'+escHtml(c.campaign_display_id||'—')+'</td>';
      h += '<td>'+escHtml(c.ad_type||'—')+'</td>';
      h += '<td><span style="color:'+(tc2[c.contribution_tier]||'')+';font-weight:600">'+escHtml(c.contribution_tier||'—')+'</span></td>';
      h += '<td>'+_fmtNum(c.contribution_score)+'</td>';
      h += '<td><span style="font-weight:600">'+(c.share!=null?(Number(c.share)*100).toFixed(1)+'%':'—')+'</span></td>';
      h += '<td>'+escHtml(c.created_date||'—')+'</td></tr>';
    });
    h += '</table></div>';
  }

  document.getElementById('aiPanelL1').innerHTML = h;
}

// Event delegation for L1→L2
document.addEventListener('click', function(e){
  var row = e.target.closest('.ai-row');
  if (!row) return;
  drillL2(row.getAttribute('data-cid'), row.getAttribute('data-did'));
});

// ═══ L2 ═══
async function drillL2(campaignId, displayId) {
  var pe = document.getElementById('aiPanelL2');
  if (pe) pe.innerHTML = aiBC([['ASIN: '+escHtml(AI.asin),false,'renderL1()'],['Campaign: '+escHtml(displayId||campaignId),true]])+'<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在加载 Campaign 详情...</div></div>';
  switchAiTab(2);
  document.getElementById('aiTabBtnL2').style.display = 'inline-flex';
  try {
    var r = await fetch('/api/ad-inspect-campaign?asin='+encodeURIComponent(AI.asin)+'&campaignId='+encodeURIComponent(campaignId)+'&country='+encodeURIComponent(AI.country));
    var d = await r.json();
    if (d.error) { if (pe) pe.innerHTML = aiBC([['ASIN: '+escHtml(AI.asin),false,'renderL1()']])+'<div class="mkt-empty-card" style="color:var(--red)">加载失败：'+escHtml(d.error)+'</div>'; return; }
    AI.l2d = d; AI.l2name = displayId||campaignId||''; AI.l2cid = campaignId;
    renderL2();
  } catch(err) { if (pe) pe.innerHTML = aiBC([['ASIN: '+escHtml(AI.asin),false,'renderL1()']])+'<div class="mkt-empty-card" style="color:var(--red)">请求失败：'+escHtml(err.message)+'</div>'; }
}

function renderL2() {
  var d = (AI.l2d && AI.l2d.data) || {};
  var cid = AI.l2cid || '';
  var h = aiBC([['ASIN: '+escHtml(AI.asin),false,'renderL1()'],['Campaign: '+escHtml(AI.l2name),true]]);

  // campaign_structure
  var cs = d.campaign_structure || {};
  var ags = cs.adGroups || [];
  h += '<div class="mkt-section-title">&#x1F4E6; Campaign 架构 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  h += '<div class="mkt-col-grid"><div class="mkt-metric"><span class="mkt-metric-label">类型</span><span class="mkt-metric-value">'+escHtml(cs.campaignType||'—')+'</span></div><div class="mkt-metric"><span class="mkt-metric-label">展示ID</span><span class="mkt-metric-value" style="font-family:monospace;font-size:.7rem">'+escHtml(cs.campaignDisplayId||'—')+'</span></div><div class="mkt-metric"><span class="mkt-metric-label">AdGroup数</span><span class="mkt-metric-value">'+(cs.adGroupCount||ags.length)+'</span></div></div>';
  if (ags.length) {
    h += '<div class="mkt-filter-table"><table><tr><th>AdGroup ID</th><th>类型</th><th>变体数</th><th>历史关键词</th><th>创建日期</th><th></th></tr>';
    ags.forEach(function(ag){
      h += '<tr><td style="font-family:monospace;font-size:.62rem">'+escHtml(ag.adGroupId||'—')+'</td><td>'+escHtml(ag.adGroupType||'—')+'</td><td>'+(ag.variantCount!=null?ag.variantCount:'—')+'</td><td>'+_fmtNum(ag.historicalKeywordCount)+'</td><td>'+escHtml(ag.adGroupCreateDate||'—')+'</td><td><button class="btn-edit" style="font-size:.6rem;padding:2px 6px" onclick="event.stopPropagation();drillL3(\''+escHtml(ag.adGroupId)+'\',\''+escHtml(cid)+'\')">&#x1F50D; 下钻</button></td></tr>';
    });
    h += '</table></div>';
  }

  // campaign_traffic_trend
  var ct = d.campaign_traffic_trend || {};
  var ctd = ct.trafficTrend || [];
  var cta = ct.trend_analysis || {};
  var evts = ct.events || [];
  h += '<div class="mkt-section-title" style="margin-top:12px">&#x1F4C8; Campaign 流量趋势 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  if (Object.keys(cta).length) h += '<div class="mkt-col-grid"><div class="mkt-metric"><span class="mkt-metric-label">整体走势</span><span class="mkt-metric-value">'+escHtml(cta.overall_direction||'—')+'</span></div><div class="mkt-metric"><span class="mkt-metric-label">近期变化</span><span class="mkt-metric-value">'+escHtml(cta.recent_change||'—')+'</span></div></div>';
  var aw = cta.anomaly_weeks || [];
  if (aw.length) h += '<div style="font-size:.65rem;color:var(--red);margin-bottom:6px">&#x26A0; 异常周: '+aw.map(function(w){return '<b>'+escHtml(w)+'</b>';}).join(', ')+' | 事件: '+evts.length+' 个</div>';
  if (ctd.length) {
    h += '<div style="font-size:.62rem;color:var(--muted);margin-bottom:2px">&#x1F4CA; 近12周曝光趋势</div>';
    h += _aiBar(ctd.slice(-12).map(function(w){var v=w.traffic||0;return{label:(w.date||'').substring(5),value:v,color:v>0?'var(--accent)':'var(--muted)'};}),{h:80,bw:12,gap:3});
    h += '<details><summary style="cursor:pointer;font-size:.7rem;color:var(--accent);margin-bottom:4px">展开时序表 ('+ctd.length+' 周)</summary>';
    h += '<div class="mkt-filter-table" style="max-height:250px;overflow-y:auto"><table><tr><th>周</th><th>曝光得分</th><th>变化率</th><th>信号</th><th>事件</th></tr>';
    var sm = {significant_gain:'var(--green)',moderate_gain:'var(--accent)',stable:'var(--muted)',moderate_drop:'var(--accent2)',significant_drop:'var(--red)'};
    ctd.slice(-16).forEach(function(w){
      var el=''; evts.forEach(function(ev){ if(ev.date===w.date) el+=' +AG:'+escHtml((ev.adGroupId||'').substring(0,8)); });
      h += '<tr><td>'+escHtml(w.date||'—')+'</td><td>'+_fmtNum(w.traffic)+'</td><td style="color:'+(sm[w.change_signal]||'')+';font-weight:600">'+(w.trafficChangeRate!=null?(Number(w.trafficChangeRate)>=0?'+':'')+(Number(w.trafficChangeRate)*100).toFixed(1)+'%':'—')+'</td><td style="color:'+(sm[w.change_signal]||'')+'">'+escHtml(w.change_signal||'—')+'</td><td style="font-size:.58rem">'+el+'</td></tr>';
    });
    h += '</table></div></details>';
  }

  // contribution_keyword
  var kwD = d.contribution_keyword || {};
  var kwItems = kwD.items || [];
  h += '<div class="mkt-section-title" style="margin-top:12px">&#x1F511; 关键词贡献明细 ('+kwItems.length+' 词) <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  if (kwItems.length) {
    h += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">窗口: '+escHtml((kwD.timeRange||{}).start_date||'')+' ~ '+escHtml((kwD.timeRange||{}).end_date||'')+'</div>';
    h += '<div class="mkt-filter-table" style="max-height:500px;overflow-y:auto"><table><tr><th>关键词</th><th>翻译</th><th>曝光得分</th><th>占比</th><th>变化率</th><th>AG数</th></tr>';
    kwItems.slice(0,30).forEach(function(kw){
      var cr = kw.trafficChangeRate!=null?(Number(kw.trafficChangeRate)*100).toFixed(1)+'%':'—';
      var cc2 = kw.trafficChangeRate>0?'var(--green)':(kw.trafficChangeRate<0?'var(--red)':'var(--muted)');
      var agn = ((kw.exposedAdGroups||kw.adGroupContributions||[])).length;
      h += '<tr><td style="font-weight:600">'+escHtml(kw.keyword||'—')+'</td><td style="color:var(--muted);font-size:.62rem">'+escHtml(kw.translateKeyword||'')+'</td><td>'+_fmtNum(kw.traffic)+'</td><td>'+(kw.trafficShare!=null?(Number(kw.trafficShare)*100).toFixed(1)+'%':'—')+'</td><td style="color:'+cc2+';font-weight:600">'+cr+'</td><td>'+agn+'</td></tr>';
    });
    h += '</table></div>';
  }

  // contribution_adgroup
  var agD = d.contribution_adgroup || {};
  var agItems = agD.items || [];
  if (agItems.length) {
    h += '<div class="mkt-section-title" style="margin-top:12px">&#x1F4CA; AdGroup 贡献汇总 ('+agItems.length+' 组) <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
    h += '<div class="mkt-filter-table" style="max-height:300px;overflow-y:auto"><table><tr><th>AdGroup ID</th><th>曝光得分</th><th>占比</th><th>变化量</th><th>变化率</th><th>变体数</th></tr>';
    agItems.forEach(function(ag){ h += '<tr><td style="font-family:monospace;font-size:.62rem">'+escHtml(ag.adGroupId||'—')+'</td><td>'+_fmtNum(ag.traffic)+'</td><td>'+(ag.trafficShare!=null?(Number(ag.trafficShare)*100).toFixed(1)+'%':'—')+'</td><td>'+_fmtNum(ag.trafficChange)+'</td><td>'+(ag.trafficChangeRate!=null?(Number(ag.trafficChangeRate)*100).toFixed(1)+'%':'—')+'</td><td>'+(ag.variantCount||'—')+'</td></tr>'; });
    h += '</table></div>';
  }

  document.getElementById('aiPanelL2').innerHTML = h;
}

// ═══ L3 ═══
async function drillL3(adGroupId, campaignId) {
  AI.l3agid = adGroupId;
  var pe = document.getElementById('aiPanelL3');
  var cn = AI.l2name || campaignId || '—';
  if (pe) pe.innerHTML = aiBC([['ASIN: '+escHtml(AI.asin),false,'renderL1()'],['Campaign: '+escHtml(cn),false,'renderL2()'],['AdGroup: '+escHtml(adGroupId),true]])+'<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在加载 AdGroup 详情...</div></div>';
  switchAiTab(3);
  document.getElementById('aiTabBtnL3').style.display = 'inline-flex';
  try {
    var r = await fetch('/api/ad-inspect-adgroup?asin='+encodeURIComponent(AI.asin)+'&campaignId='+encodeURIComponent(campaignId)+'&adGroupId='+encodeURIComponent(adGroupId)+'&country='+encodeURIComponent(AI.country));
    var d = await r.json();
    if (d.error) { if (pe) pe.innerHTML = aiBC([['ASIN: '+escHtml(AI.asin),false,'renderL1()'],['Campaign: '+escHtml(cn),false,'renderL2()']])+'<div class="mkt-empty-card" style="color:var(--red)">加载失败：'+escHtml(d.error)+'</div>'; return; }
    renderL3(d);
  } catch(err) { if (pe) pe.innerHTML = aiBC([['ASIN: '+escHtml(AI.asin),false,'renderL1()'],['Campaign: '+escHtml(cn),false,'renderL2()']])+'<div class="mkt-empty-card" style="color:var(--red)">请求失败：'+escHtml(err.message)+'</div>'; }
}

function renderL3(data) {
  var d = data.data || {};
  var agid = AI.l3agid || data.adgroup_id || '';
  var cn = AI.l2name || '—';
  var h = aiBC([['ASIN: '+escHtml(AI.asin),false,'renderL1()'],['Campaign: '+escHtml(cn),false,'renderL2()'],['AdGroup: '+escHtml(agid),true]]);

  // traffic_trend
  var agt = d.adgroup_traffic_trend || {};
  var agtd = agt.trafficTrend || [];
  h += '<div class="mkt-section-title">&#x1F4C8; AdGroup 流量趋势 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  h += '<div class="mkt-col-grid"><div class="mkt-metric"><span class="mkt-metric-label">Campaign</span><span class="mkt-metric-value" style="font-family:monospace;font-size:.62rem">'+escHtml(agt.campaignDisplayId||agt.campaignId||'—')+'</span></div><div class="mkt-metric"><span class="mkt-metric-label">类型</span><span class="mkt-metric-value">'+escHtml(agt.campaignType||'—')+'</span></div></div>';
  if (agtd.length) {
    h += '<div style="font-size:.62rem;color:var(--muted);margin-bottom:2px">&#x1F4CA; 近12周曝光趋势</div>';
    h += _aiBar(agtd.slice(-12).map(function(w){var v=w.traffic||0;return{label:(w.date||'').substring(5),value:v,color:v>0?'var(--accent)':'var(--muted)'};}),{h:80,bw:12,gap:3});
    h += '<details><summary style="cursor:pointer;font-size:.7rem;color:var(--accent);margin-bottom:4px">展开时序表 ('+agtd.length+' 周)</summary>';
    h += '<div class="mkt-filter-table" style="max-height:250px;overflow-y:auto"><table><tr><th>周</th><th>曝光量</th><th>变化量</th><th>变化率</th></tr>';
    agtd.slice(-20).forEach(function(w){ var r2=w.trafficChangeRate!=null?(Number(w.trafficChangeRate)*100).toFixed(1)+'%':'—'; h += '<tr><td>'+escHtml(w.date||'—')+'</td><td>'+_fmtNum(w.traffic)+'</td><td>'+_fmtNum(w.trafficChange)+'</td><td>'+r2+'</td></tr>'; });
    h += '</table></div></details>';
  }

  // keyword_breakdown
  var akb = d.adgroup_keyword_breakdown || {};
  var akws = akb.keywords || [];
  var dasins = akb.displayAsins || [];
  h += '<div class="mkt-section-title" style="margin-top:12px">&#x1F511; 关键词流量拆解 <small style="color:var(--muted);font-size:.58rem;font-weight:400">SIF</small></div>';
  h += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">日期: '+escHtml(akb.date||'')+' | 展示 ASIN: '+dasins.map(function(a){return '<code style="font-family:monospace;font-size:.6rem;margin-right:4px">'+escHtml(a)+'</code>';}).join('')+'</div>';
  if (akws.length) {
    h += '<div class="mkt-filter-table" style="max-height:500px;overflow-y:auto"><table><tr><th>关键词</th><th>翻译</th><th>流量占比</th><th>展示 ASIN</th></tr>';
    akws.forEach(function(kw){ var as = (kw.displayAsins||[]).map(function(a){return '<code style="font-size:.55rem;margin-right:2px">'+escHtml(a)+'</code>';}).join(''); h += '<tr><td style="font-weight:600">'+escHtml(kw.keyword||'—')+'</td><td style="color:var(--muted);font-size:.62rem">'+escHtml(kw.translateKeyword||'')+'</td><td><span style="font-weight:600">'+(kw.trafficShareWithinAdGroup!=null?(Number(kw.trafficShareWithinAdGroup)*100).toFixed(2)+'%':'—')+'</span></td><td style="font-size:.55rem">'+(as||'—')+'</td></tr>'; });
    h += '</table></div>';
  } else {
    h += '<div class="mkt-empty-card">暂无关键词拆解数据</div>';
  }

  document.getElementById('aiPanelL3').innerHTML = h;
}
