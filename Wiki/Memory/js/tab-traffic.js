// Traffic Anomaly Diagnosis
var TA_STATE = { data: null, tab: 'overview' };

function taOnTimeTypeChange() {
    var s = document.getElementById('taTimeType'), v = document.getElementById('taTimeValue');
    if (s.value === 'week') { v.style.display = ''; v.placeholder = '周日日期，如 2026-05-10'; }
    else if (s.value === 'latelyDay') { v.style.display = ''; v.placeholder = '天数，如 7 或 30'; }
    else { v.style.display = 'none'; v.value = ''; }
}

function updateTrafficAnomalySourceBadge(cfg) {
    cfg = cfg || {}; var sif = cfg.sif_mcp || {}; var el = document.getElementById('taSrcSif'); if (!el) return;
    el.classList.remove('active','warn');
    var ok = !!(sif.endpoint), on = sif.enabled;
    if (on && ok) { el.classList.add('active'); el.textContent = 'SIF MCP：已连接'; }
    else if (ok && !on) { el.classList.add('warn'); el.textContent = 'SIF MCP：已配置/未开启'; }
    else if (on && !ok) { el.classList.add('warn'); el.textContent = 'SIF MCP：缺链接'; }
    else { el.textContent = 'SIF MCP：未配置'; }
}

async function getTrafficAnomalySettings() {
    try { var r = await fetch('/api/settings'); if (r.ok) updateTrafficAnomalySourceBadge(await r.json()); } catch(e) {}
}

async function startTrafficAnomaly() {
    var asin = document.getElementById('taAsin').value.trim();
    var country = document.getElementById('taCountry').value;
    if (!country) { showToast('请选择站点'); return; }
    if (!asin) { showToast('请输入 ASIN'); return; }
    if (!/^[A-Za-z0-9]{5,15}$/.test(asin)) { showToast('ASIN 格式错误'); return; }
    try { await getTrafficAnomalySettings(); } catch(e) {}

    var timeType = document.getElementById('taTimeType').value;
    var timeValue = document.getElementById('taTimeValue').value.trim();
    var p = 'asin=' + encodeURIComponent(asin) + '&country=' + encodeURIComponent(country);
    if (timeType && timeValue) p += '&time_type=' + encodeURIComponent(timeType) + '&time_value=' + encodeURIComponent(timeValue);

    TA_STATE.data = null;
    TA_STATE.tab = 'overview';
    showToast('正在诊断流量异常，预计 10-60 秒，请耐心等待…', 'info');
    var btn = document.querySelector('#mainTabTrafficAnomaly .btn-mkt-start');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ 诊断中...'; }
    document.getElementById('taResults').innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af">正在诊断 ' + escHtml(asin) + ' 流量变化...<br><small>约 10-60 秒</small></div>';
    document.querySelectorAll('#taSubTabs .expert-tab').forEach(function(b){ b.classList.remove('active'); });
    document.querySelector('#taSubTabs .expert-tab').classList.add('active');

    try {
        var r = await fetch('/api/traffic-anomaly/' + Date.now() + '?' + p);
        if (!r.ok) { var e = await r.json().catch(function(){return{};}); throw new Error(e.error || '请求失败 '+r.status); }
        TA_STATE.data = await r.json();
        if (btn) { btn.disabled = false; btn.textContent = '🔬 开始诊断'; }
        taRender();
    } catch(e) {
        if (btn) { btn.disabled = false; btn.textContent = '🔬 开始诊断'; }
        document.getElementById('taResults').innerHTML = '<div class="mkt-empty-card">诊断失败：' + escHtml(e.message) + '</div>';
    }
}

function switchTATab(name) {
    TA_STATE.tab = name;
    document.querySelectorAll('#taSubTabs .expert-tab').forEach(function(b){
        var map = {overview:'总览', trend:'趋势层', structure:'结构层', keyword:'关键词层', competition:'竞争层'};
        b.classList.toggle('active', b.textContent.indexOf(map[name]||'') >= 0);
    });
    if (TA_STATE.data) taRender();
}

function taRender() {
    if (!TA_STATE.data) return;
    if (TA_STATE.tab === 'overview') taRenderOverview();
    else taRenderLayer(TA_STATE.tab);
}

function _kpi(l, v, c) {
    return '<div style="border-left:3px solid '+(c||'#e5e7eb')+';padding:5px 10px;background:rgba(255,255,255,0.02);border-radius:0 5px 5px 0;min-width:70px"><div style="font-size:0.65rem;color:#9ca3af">'+l+'</div><div style="font-size:1.05rem;font-weight:700;color:'+(c||'#e5e7eb')+'">'+v+'</div></div>';
}

// ═══ Overview ═══
function taRenderOverview() {
    var d = TA_STATE.data, m = d.metrics || {}, errs = d.errors || {}, ev = d.evidence || [];
    var isD = d.conclusion_code === 'decline_detected', isN = d.conclusion_code === 'no_anomaly';
    var h = '';

    // Banner
    if (d.verdict) {
        var clr = isD ? '#ef4444' : isN ? '#22c55e' : '#f59e0b';
        h += '<div style="background:'+(isD?'rgba(239,68,68,.08)':isN?'rgba(34,197,94,.08)':'rgba(245,158,11,.08)')+';border:1px solid '+(isD?'rgba(239,68,68,.3)':isN?'rgba(34,197,94,.3)':'rgba(245,158,11,.3)')+';border-radius:8px;padding:14px 18px;margin-bottom:12px">';
        h += '<div style="font-size:1rem;font-weight:700;color:'+clr+'">'+escHtml(d.verdict)+'</div>';
        var meta = [];
        if (d.depth_reached) meta.push('深度 L'+d.depth_reached);
        if (d.confidence) meta.push(escHtml(d.confidence));
        if (d._fallback) meta.push('本地兜底');
        if (meta.length) h += '<div style="font-size:0.72rem;color:#9ca3af;margin-top:2px">'+meta.join(' | ')+'</div>';
        h += '</div>';
    }

    // KPIs
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
    var cv = m.traffic_change || m.recent_change;
    if (cv) h += _kpi('流量变化', cv, String(cv).indexOf('-')===0?'#ef4444':'#22c55e');
    if (m.drop && String(m.drop)!=='—') h += _kpi('跌幅', m.drop, '#ef4444');
    if (m.anomaly_weeks && String(m.anomaly_weeks)!=='—') h += _kpi('异常周', m.anomaly_weeks, '#f59e0b');
    if (m.total_campaigns) h += _kpi('Campaigns', m.total_campaigns, '#3b82f6');
    if (m.dominant_channel) h += _kpi('主力渠道', m.dominant_channel, '#8b5cf6');
    h += '</div>';

    // Layer pills
    var grp = {}; ev.forEach(function(e){ var l=e.layer||'?'; grp[l]=grp[l]||[]; grp[l].push(e); });
    var exc = d.excluded || [];
    function isExc(id) { for(var i=0;i<exc.length;i++){ if(exc[i].layer.indexOf(id)>=0) return exc[i].reason; } return null; }
    var layers = [{id:'trend',l:'趋势层',i:'📈'},{id:'structure',l:'结构层',i:'🏗'},{id:'keyword',l:'关键词层',i:'🔑'},{id:'competition',l:'竞争层',i:'⚔'}];
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
    layers.forEach(function(l){
        var xr = isExc(l.id), cnt = (grp[l.id]||[]).length;
        var c2 = xr ? '#6b7280' : (cnt ? '#22c55e' : '#f59e0b');
        h += '<div style="flex:1;min-width:90px;background:'+(xr?'rgba(107,114,128,0.06)':(cnt?'rgba(34,197,94,0.06)':'rgba(245,158,11,0.06)'))+';border-left:3px solid '+c2+';padding:8px 10px;border-radius:0 6px 6px 0;cursor:pointer" onclick="switchTATab(\''+l.id+'\')">';
        h += '<div style="font-size:0.68rem;color:#9ca3af">'+l.i+' '+l.l+'</div><div style="font-size:0.85rem;font-weight:700;color:'+c2+'">'+(xr?'未覆盖':cnt+'条证据')+'</div></div>';
    });
    h += '</div>';

    // Action
    if (d.action) {
        h += '<div style="background:rgba(59,130,246,0.06);border-left:3px solid #3b82f6;padding:10px 14px;margin-bottom:10px;border-radius:0 6px 6px 0">';
        h += '<div style="font-weight:700;color:#3b82f6;margin-bottom:2px;font-size:0.8rem">建议行动</div><div style="font-size:0.85rem;color:#d1d5db">'+escHtml(d.action)+'</div></div>';
    }

    // Mermaid
    if (d.mermaid) {
        h += '<div class="mkt-card" style="border-left:3px solid #6366f1;margin-bottom:10px"><div class="mkt-card-head"><span>诊断流程</span></div>';
        h += '<pre style="background:var(--surface);color:var(--text);padding:12px;border-radius:6px;font-size:0.75rem;overflow-x:auto;white-space:pre;line-height:1.3">'+escHtml(d.mermaid)+'</pre></div>';
    }
    // Narrative
    if (d.narrative) {
        h += '<div class="mkt-card" style="border-left:3px solid #8b5cf6;margin-bottom:10px"><div class="mkt-card-head"><span>证据链</span></div>';
        h += '<div style="color:#d1d5db;line-height:1.7;font-size:0.82rem;white-space:pre-wrap">'+escHtml(d.narrative)+'</div></div>';
    }
    // Errors
    if (Object.keys(errs).length) {
        var eh = ''; for(var k in errs) eh += '<div style="font-size:0.72rem;color:#9ca3af">'+escHtml(k)+': '+escHtml(errs[k])+'</div>';
        h += '<div class="mkt-card" style="border-left:3px solid #6b7280;margin-bottom:10px"><div class="mkt-card-head"><span>数据源备注</span></div>'+eh+'</div>';
    }
    document.getElementById('taResults').innerHTML = h;
}

// ═══ Layer Detail ═══
function taRenderLayer(name) {
    var d = TA_STATE.data, m = d.metrics || {}, ev = d.evidence || [], exc = d.excluded || [];
    var labels = {trend:'📈 流量趋势层', structure:'🏗 流量结构层', keyword:'🔑 关键词层', competition:'⚔ 竞争层'};
    var ly = ev.filter(function(e){ return (e.layer||'') === name; });
    var exclR = null;
    for(var i=0;i<exc.length;i++){ if((exc[i].layer||'').indexOf(name)>=0){ exclR=exc[i].reason; break; } }
    var h = '';

    // Header
    h += '<div style="margin-bottom:12px"><strong style="font-size:0.95rem;color:#d1d5db">'+(labels[name]||name)+'</strong>';
    if (exclR) h += ' <span style="color:#ef4444;font-size:0.75rem">— 未覆盖</span>';
    else if (!ly.length) h += ' <span style="color:#f59e0b;font-size:0.75rem">— 暂无该层证据</span>';
    else h += ' <span style="color:#22c55e;font-size:0.75rem">— '+ly.length+' 条证据</span>';
    h += '</div>';

    if (exclR) { h += '<div class="mkt-empty-card">'+escHtml(exclR)+'</div>'; document.getElementById('taResults').innerHTML = h; return; }

    // Layer KPIs
    if (name==='trend') {
        h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
        if (m.traffic_change) h += _kpi('流量变化', m.traffic_change, '#3b82f6');
        if (m.trend) h += _kpi('趋势方向', m.trend, '#f59e0b');
        if (m.ad_trend) h += _kpi('广告趋势', m.ad_trend, '#8b5cf6');
        h += '</div>';
    }
    if (name==='structure') {
        h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">';
        if (m.dominant_channel) h += _kpi('主力渠道', m.dominant_channel, '#8b5cf6');
        if (m.total_campaigns) h += _kpi('Campaigns', m.total_campaigns, '#3b82f6');
        if (m.ad_types) h += _kpi('类型分布', m.ad_types, '#06b6d4');
        h += '</div>';
    }

    // Evidence
    if (ly.length) {
        ly.forEach(function(e){
            var w = e.weight||'', wc = w==='primary'?'#ef4444':(w==='secondary'?'#f59e0b':'#6b7280');
            var wl = w==='primary'?'主因':(w==='secondary'?'次因':'参考');
            h += '<div class="mkt-card" style="border-left:3px solid '+wc+';margin-bottom:6px;padding:10px 14px">';
            h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">';
            h += '<span style="font-size:0.82rem;font-weight:600;flex:1;min-width:140px;color:#d1d5db">'+escHtml(e.signal||'')+'</span>';
            if (e.value) h += '<span style="font-size:0.88rem;font-weight:700;color:'+wc+'">'+escHtml(e.value)+'</span>';
            h += '<span style="font-size:0.6rem;background:'+wc+'20;color:'+wc+';padding:1px 6px;border-radius:8px;white-space:nowrap">'+wl+'</span>';
            h += '</div></div>';
        });
    } else {
        h += '<div class="mkt-empty-card">该层未提取到证据数据</div>';
    }

    // Layer-specific rich data
    var ld = (d.layer_data || {})[name];
    if (ld) {
        if (name==='trend' && ld.dates && ld.dates.length) {
            var rows = ld.dates.map(function(dt,i){ return {label:dt?dt.substring(5):'', segs:[{value:ld.nf_scores?ld.nf_scores[i]||0:0,color:'#3b82f6',label:'自然'},{value:ld.ad_scores?ld.ad_scores[i]||0:0,color:'#f59e0b',label:'广告'}]}; });
            h += '<div class="mkt-card" style="border-left:3px solid #3b82f6;margin-bottom:10px"><div class="mkt-card-head"><span>自然 vs 广告流量周趋势</span></div>'+_aiBar(rows,{height:150,showGrid:true})+'</div>';
        }
        if (name==='structure' && ld.campaigns && ld.campaigns.length) {
            var tbl = '<table class="mkt-filter-table"><thead><tr><th>#</th><th>名称</th><th>类型</th><th>贡献分</th><th>份额</th><th>等级</th></tr></thead><tbody>';
            ld.campaigns.slice(0,10).forEach(function(c,i){
                tbl += '<tr><td>'+(i+1)+'</td><td>'+escHtml((c.campaign_display_id||'')+' '+escHtml((c.campaign_name||'').substring(0,12)))+'</td><td>'+(c.ad_type||'')+'</td><td>'+_fmtNum(Math.round(c.contribution_score||0))+'</td><td>'+_fmtPct(c.share)+'</td><td>'+(c.contribution_tier||'')+'</td></tr>';
            });
            tbl += '</tbody></table>';
            h += '<div class="mkt-card" style="border-left:3px solid #8b5cf6;margin-bottom:10px"><div class="mkt-card-head"><span>Campaign 贡献排行</span></div>'+tbl+'</div>';
        }
        if (name==='keyword' && ld.top_keywords && ld.top_keywords.length) {
            var tbl2 = '<table class="mkt-filter-table"><thead><tr><th>关键词</th><th>健康</th><th>自然位</th><th>SP位</th><th>搜索量</th><th>CPC</th></tr></thead><tbody>';
            ld.top_keywords.slice(0,12).forEach(function(kw){
                tbl2 += '<tr><td>'+escHtml((kw.keyword||'').substring(0,25))+'</td><td><span style="background:'+_taHealthColor(kw.keyword_health)+';color:#fff;border-radius:9px;padding:1px 7px;font-size:0.62rem;font-weight:600">'+(kw.keyword_health||'')+'</span></td><td>'+escHtml(kw.organic_rank||'--')+'</td><td>'+escHtml(kw.sp_rank||'--')+'</td><td>'+_fmtNum(kw.search_volume)+'</td><td>'+(kw.cpc_median?'$'+kw.cpc_median:'--')+'</td></tr>';
            });
            tbl2 += '</tbody></table>';
            h += '<div class="mkt-card" style="border-left:3px solid #f59e0b;margin-bottom:10px"><div class="mkt-card-head"><span>Top 关键词详情</span></div>'+tbl2+'</div>';
        }
        if (name==='competition' && ld.top_competitors && ld.top_competitors.length) {
            var tbl3 = '<table class="mkt-filter-table"><thead><tr><th>#</th><th>ASIN</th><th>$</th><th>评分</th><th>评论</th><th>月销</th><th>份额</th></tr></thead><tbody>';
            ld.top_competitors.slice(0,10).forEach(function(c,i){
                tbl3 += '<tr><td>'+(i+1)+'</td><td>'+escHtml((c.asin||'').substring(0,12))+'</td><td>$'+(c.price||'')+'</td><td>'+(c.rating||'')+'</td><td>'+_fmtNum(c.review_count)+'</td><td>'+escHtml(c.monthly_orders||'')+'</td><td>'+_fmtPct(c.total_share)+'</td></tr>';
            });
            tbl3 += '</tbody></table>';
            h += '<div class="mkt-card" style="border-left:3px solid #ef4444;margin-bottom:10px"><div class="mkt-card-head"><span>Top 竞品列表</span></div>'+tbl3+'</div>';
        }
    }

    document.getElementById('taResults').innerHTML = h;
}

function _taHealthColor(h) {
    var m = {core:'#3b82f6', at_risk:'#ef4444', volatile:'#f59e0b', paid_dependent:'#8b5cf6', standard:'#6b7280'};
    return m[h] || '#6b7280';
}
