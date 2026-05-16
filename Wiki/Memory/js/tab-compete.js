// ══════════════════════════════════════════════════════════════
// Competition & Order Rate Analysis Tab  v2 — clean vertical layout
// ══════════════════════════════════════════════════════════════

var COMP_STATE = { data: null, currentTab: 'Overview' };

// ── Source badges ────────────────────────────────────────────
function updateCompSourceBadges() {
    fetch('/api/settings').then(function(r){return r.json();}).then(function(cfg){
        cfg = cfg || {};
        function setBadge(id, label, enabled, hasCreds) {
            var el = document.getElementById(id); if (!el) return;
            el.classList.remove('active','warn');
            if (enabled && hasCreds) { el.classList.add('active'); el.textContent = label + '：已连接'; }
            else if (hasCreds && !enabled) { el.classList.add('warn'); el.textContent = label + '：已配置/未开启'; }
            else if (enabled && !hasCreds) { el.classList.add('warn'); el.textContent = label + '：缺密钥/链接'; }
            else { el.textContent = label + '：未配置'; }
        }
        var sif = cfg.sif_mcp || {};
        setBadge('compSrcSif', 'SIF MCP', sif.enabled, !!(sif.endpoint && sif.api_key));
    }).catch(function(){});
}

// ── Start analysis ────────────────────────────────────────────
function startCompAnalysis() {
    var site = document.getElementById('compSite').value;
    var myAsin = document.getElementById('compMyAsin').value.trim();
    var comp1 = document.getElementById('compAsin1').value.trim();
    if (!site) { showToast('请选择站点'); return; }
    if (!myAsin) { showToast('请输入我方 ASIN'); return; }
    var compList = comp1;
    var url = '/api/competition-analysis/' + crypto.randomUUID() + '?asin=' + encodeURIComponent(myAsin) + '&country=' + encodeURIComponent(site);
    if (compList) url += '&comp_asins=' + encodeURIComponent(compList);
    COMP_STATE.data = null;
    var TABS = ['Overview','Position','OrderProb','Keyword','Adlift','Strategy'];
    TABS.forEach(function(t){ var el = document.getElementById('compTab' + t); if (el) el.innerHTML = '<div style="text-align:center;padding:40px;color:#9ca3af"><p style="font-size:1rem;margin-bottom:8px">正在采集竞争数据...</p><p style="font-size:0.75rem">SIF MCP + Amazon 页面抓取 · 约 20-40 秒</p></div>'; });
    fetch(url).then(function(r){return r.json();}).then(function(data){
        COMP_STATE.data = data;
        if (data.errors && Object.keys(data.errors).length) {
            showToast('部分数据获取失败: ' + Object.entries(data.errors).map(function(e){return e[0]+': '+e[1];}).join('; '));
        }
        renderCompAll();
    }).catch(function(e){ showToast('分析请求失败: ' + e.message); });
}

// ── Tab switching ─────────────────────────────────────────────
function switchCompTab(name) {
    COMP_STATE.currentTab = name;
    ['Overview','Position','OrderProb','Keyword','Adlift','Strategy'].forEach(function(t){
        var el = document.getElementById('compTab' + t); if (el) el.style.display = (t === name) ? 'block' : 'none';
    });
    document.querySelectorAll('#compSubTabs .expert-tab').forEach(function(btn){
        var map = {Overview:'态势总览', Position:'坑位快照', OrderProb:'出单率分析', Keyword:'关键词对抗', Adlift:'广告拉升', Strategy:'策略计划'};
        btn.classList.toggle('active', btn.textContent.indexOf(map[name] || '') >= 0);
    });
    if (COMP_STATE.data) renderCompTab(name);
}

function renderCompAll() { renderCompTab(COMP_STATE.currentTab); }

function renderCompTab(name) {
    var d = COMP_STATE.data; if (!d) return;
    switch (name) {
        case 'Overview': renderCompOverview(d); break;
        case 'Position': renderCompPosition(d); break;
        case 'OrderProb': renderCompOrderProb(d); break;
        case 'Keyword': renderCompKeyword(d); break;
        case 'Adlift': renderCompAdlift(d); break;
        case 'Strategy': renderCompStrategy(d); break;
    }
}

// ── Shared helpers ────────────────────────────────────────────
function _card(title, src, body, borderColor) {
    return '<div class="mkt-card" style="border-left:3px solid ' + (borderColor || 'transparent') + ';margin-bottom:10px">' +
        '<div class="mkt-card-head"><span>' + title + '</span><small>' + (src || '') + '</small></div>' + body + '</div>';
}
function _kpi(label, value, color) {
    return '<div style="border-left:3px solid ' + (color || '#e5e7eb') + ';padding:5px 10px;background:rgba(255,255,255,0.02);border-radius:0 5px 5px 0;min-width:80px">' +
        '<div style="font-size:0.65rem;color:#9ca3af">' + label + '</div><div style="font-size:1.05rem;font-weight:700;color:' + (color||'#e5e7eb') + ';line-height:1.2">' + value + '</div></div>';
}
function _kpiRow(items) {
    return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + items.join('') + '</div>';
}
function _pill(text, on, color) {
    return '<span style="background:' + (on ? color : '#374151') + ';color:' + (on ? '#fff' : '#6b7280') + ';padding:2px 10px;border-radius:11px;font-size:0.65rem;font-weight:600">' + text + '</span>';
}

// ── SVG donut pie chart ──────────────────────────────────────
function _donut(slices, opts) {
    opts = opts || {};
    var size = opts.size || 170, cx = size/2, cy = size/2, rOuter = size/2 - 8, rInner = rOuter * 0.58;
    var total = slices.reduce(function(s, sl){ return s + (sl.value || 0); }, 0) || 1;
    var h = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="display:block;margin:0 auto">';
    var angle = -Math.PI / 2;
    for (var i = 0; i < slices.length; i++) {
        var sa = Math.max((slices[i].value / total) * 2 * Math.PI, 0.04);
        var x1 = cx + rOuter * Math.cos(angle), y1 = cy + rOuter * Math.sin(angle);
        var x2 = cx + rOuter * Math.cos(angle + sa), y2 = cy + rOuter * Math.sin(angle + sa);
        var x3 = cx + rInner * Math.cos(angle + sa), y3 = cy + rInner * Math.sin(angle + sa);
        var x4 = cx + rInner * Math.cos(angle), y4 = cy + rInner * Math.sin(angle);
        var large = sa > Math.PI ? 1 : 0;
        h += '<path d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' A' + rOuter + ' ' + rOuter + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + ' L' + x3.toFixed(1) + ' ' + y3.toFixed(1) + ' A' + rInner + ' ' + rInner + ' 0 ' + large + ' 0 ' + x4.toFixed(1) + ' ' + y4.toFixed(1) + ' Z" fill="' + (slices[i].color||'#6b7280') + '" opacity="0.85"><title>' + escHtml(slices[i].label||'') + ': ' + _fmtPct(slices[i].value/total) + '</title></path>';
        angle += sa;
    }
    h += '<text x="' + cx + '" y="' + (cy-5) + '" text-anchor="middle" fill="#e5e7eb" font-size="15" font-weight="700">' + (opts.center || '') + '</text>';
    if (opts.sub) h += '<text x="' + cx + '" y="' + (cy+14) + '" text-anchor="middle" fill="#9ca3af" font-size="9">' + opts.sub + '</text>';
    h += '</svg>';
    if (opts.legend !== false) {
        h += '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:8px">';
        slices.forEach(function(sl){
            h += '<span style="font-size:0.65rem;color:#9ca3af;display:flex;align-items:center;gap:3px"><span style="width:7px;height:7px;border-radius:2px;background:' + (sl.color||'#6b7280') + ';display:inline-block"></span>' + escHtml(sl.label||'') + ' ' + _fmtPct(sl.value/total) + '</span>';
        });
        h += '</div>';
    }
    return h;
}

var _COLORS = ['#3b82f6','#22c55e','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#ef4444','#84cc16','#f97316','#6366f1'];
function _compHealthColor(h) {
    var map = {core:'#3b82f6', at_risk:'#ef4444', volatile:'#f59e0b', paid_dependent:'#8b5cf6', standard:'#6b7280'};
    return map[h] || '#6b7280';
}

// ════════════════════════════════════════════════════════════
// TAB 1 — Overview
// ════════════════════════════════════════════════════════════
function renderCompOverview(d) {
    var el = document.getElementById('compTabOverview'); if (!el) return;
    var ov = d.overview || {}, mp = ov.my_product || {}, comps = ov.competitors || [];
    var ps = ov.primary_signals || {}, mpos = ov.my_position || {}, ms = ov.market_structure || {};
    var h = '';

    // KPI row
    h += _kpiRow([
        _kpi('售价', '$' + (mp.price || '--'), '#f59e0b'),
        _kpi('评分', (mp.rating || '--') + '⭐', '#22c55e'),
        _kpi('评论', _fmtNum(mp.review_count), '#3b82f6'),
        _kpi('月销', mp.monthly_sales || '--', '#8b5cf6'),
        _kpi('竞争位置', mpos.competition_position || '--', '#ec4899'),
        _kpi('集中度', ms.concentration_level || '--', '#06b6d4'),
    ]);
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' +
        _pill('BS', mp.badge_bs, '#f59e0b') + _pill('AC', mp.badge_ac, '#22c55e') + _pill('A+', mp.aplus, '#3b82f6') +
        _pill('Video', mp.video, '#8b5cf6') + _pill('品牌店', mp.brand_store, '#ec4899') +
        _pill('Coupon', mp.coupon, '#10b981') + _pill('Deal', mp.deal, '#ef4444') + _pill(mp.seller_type || 'FBA', true, '#6366f1') +
        '</div>';

    // Signals
    var sigBody = '';
    var gaining = ps.gaining || [], declining = ps.declining || [], gaps = ps.rank_gaps || [];
    if (gaining.length) sigBody += '<div style="color:#22c55e;font-size:0.75rem;margin:3px 0">📈 ' + gaining.map(function(g){return g.keyword + ' (+' + _fmtPct(g.contri_change) + ')';}).join(' · ') + '</div>';
    if (declining.length) sigBody += '<div style="color:#ef4444;font-size:0.75rem;margin:3px 0">📉 ' + declining.map(function(g){return g.keyword + ' (' + _fmtPct(g.contri_change) + ')';}).join(' · ') + '</div>';
    if (gaps.length) sigBody += '<div style="color:#f59e0b;font-size:0.75rem;margin:3px 0">⚠ ' + gaps.map(function(g){return g.keyword + ' (' + (g.gap_severity||'') + ')';}).join(' · ') + '</div>';
    if (!sigBody) sigBody = '<div style="font-size:0.75rem;color:#6b7280">暂无显著信号变化</div>';
    h += _card('核心信号', 'SIF', sigBody, '#22c55e');

    // Market structure card
    var msBody = '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        _metric('可见ASIN', ms.visible_asin_count || '--') + _metric('Top3点击', _fmtPct(ms.top3_click_share)) + _metric('Top3转化', _fmtPct(ms.top3_conversion_share)) + '</div>';
    if (mpos.key_insight) msBody += '<div style="font-size:0.75rem;color:#fbbf24;margin-top:4px">' + escHtml(mpos.key_insight) + '</div>';
    h += _card('市场格局', 'SIF', msBody, '#3b82f6');

    // Product info (compact)
    var infoBody = '<div style="font-size:0.78rem;color:#d1d5db;line-height:1.5">' + escHtml((mp.title || '').substring(0, 150)) + '</div>';
    h += _card('产品标题', 'Amazon', infoBody, '#8b5cf6');

    // Top competitors
    if (comps.length) {
        var tbl = '<table class="mkt-filter-table"><thead><tr><th>#</th><th>ASIN</th><th>$</th><th>评分</th><th>评论</th><th>月销</th><th>份额</th><th>模式</th></tr></thead><tbody>';
        comps.slice(0, 10).forEach(function(c){
            tbl += '<tr><td>' + (c.rank||'--') + '</td><td>' + escHtml((c.asin||'').substring(0,12)) + '</td><td>$' + (c.price||'--') + '</td><td>' + (c.rating||'--') + '</td><td>' + _fmtNum(c.review_count) + '</td><td>' + escHtml(c.monthly_orders||'--') + '</td><td>' + _fmtPct(c.total_share) + '</td><td>' + escHtml(c.competition_mode||'--') + '</td></tr>';
        });
        tbl += '</tbody></table>';
        h += _card('Top 10 竞品', 'SIF', tbl, '#f59e0b');
    }
    el.innerHTML = h;
}

// ════════════════════════════════════════════════════════════
// TAB 2 — Position Snapshot
// ════════════════════════════════════════════════════════════
function renderCompPosition(d) {
    var el = document.getElementById('compTabPosition'); if (!el) return;
    var pk = d.position_kw || {}, tkw = pk.top_keywords || [], ds = pk.demand_snapshot || {};
    var sys = pk.system_state || {}, sp = pk.strategy_path || {};
    var h = '';

    // KPI
    h += _kpiRow([
        _kpi('月搜索量', _fmtNum(ds.est_monthly_volume), '#3b82f6'),
        _kpi('趋势', (ds.trend||'--') + ' ' + _fmtPct(ds.annual_rate) + '/年', ds.trend === 'growing' ? '#22c55e' : '#f59e0b'),
        _kpi('旺季', ds.season_position || '--', '#8b5cf6'),
        _kpi('距峰值', (ds.weeks_to_peak||'--') + '周', '#ec4899'),
        _kpi('行动阶段', ds.action_phase || '--', '#f59e0b'),
    ]);
    if (ds.action_hint) h += '<div style="background:rgba(245,158,11,0.1);border-left:3px solid #f59e0b;padding:8px 12px;margin-bottom:10px;border-radius:0 6px 6px 0;font-size:0.78rem;color:#fbbf24">' + escHtml(ds.action_hint) + '</div>';

    // Keyword position table
    if (tkw.length) {
        var t = '<table class="mkt-filter-table"><thead><tr><th>关键词</th><th>健康</th><th>自然位</th><th>SP</th><th>SB</th><th>SBV</th><th>自然%</th><th>搜索量</th></tr></thead><tbody>';
        tkw.forEach(function(kw){
            t += '<tr><td>' + escHtml((kw.keyword||'').substring(0,28)) + '</td><td><span style="background:' + _compHealthColor(kw.keyword_health) + ';color:#fff;border-radius:9px;padding:1px 7px;font-size:0.62rem;font-weight:600">' + (kw.keyword_health||'--') + '</span></td>' +
                '<td>' + escHtml(kw.organic_rank||'--') + '</td><td>' + escHtml(kw.sp_rank||'--') + '</td><td>' + escHtml(kw.sb_rank||'--') + '</td><td>' + escHtml(kw.sbv_rank||'--') + '</td>' +
                '<td>' + _fmtPct(kw.natural_ratio) + '</td><td>' + _fmtNum(kw.search_volume) + '</td></tr>';
        });
        t += '</tbody></table>';
        h += _card('关键词坑位快照', 'SIF', t, '#3b82f6');
    }

    // System state + Strategy side by side
    if (Object.keys(sys).length || Object.keys(sp).length) {
        var row = '<div style="display:flex;gap:10px;flex-wrap:wrap">';
        if (Object.keys(sys).length) {
            var sysB = '';
            ['可进入性','可沉淀性','可持续性'].forEach(function(k){
                var v = sys[k]; if (!v) return;
                var clr = v.level === '高' ? '#22c55e' : (v.level === '中' ? '#f59e0b' : '#ef4444');
                sysB += '<div style="margin:5px 0;font-size:0.78rem"><strong>' + k + ':</strong> <span style="color:' + clr + ';font-weight:700">' + v.level + '</span></div>';
                if (v.evidence) sysB += '<div style="font-size:0.68rem;color:#9ca3af;margin-left:6px">' + escHtml(v.evidence.substring(0,100)) + '</div>';
            });
            if (sys.type) sysB += '<div style="margin-top:4px;font-size:0.75rem">类型: <strong>' + escHtml(sys.type) + '</strong></div>';
            row += '<div style="flex:1;min-width:260px">' + _card('市场进入评估', 'SIF', sysB, '#8b5cf6') + '</div>';
        }
        if (Object.keys(sp).length) {
            var spB = '<div style="font-size:0.9rem"><strong>判定:</strong> <span style="font-size:1.15rem;color:' + (sp.verdict==='go'?'#22c55e':(sp.verdict==='caution'?'#f59e0b':'#ef4444')) + ';font-weight:700">' + (sp.verdict||'--').toUpperCase() + '</span></div>';
            if (sp.primary_angle) spB += '<div style="font-size:0.75rem;margin-top:6px;color:#d1d5db">' + escHtml(sp.primary_angle) + '</div>';
            row += '<div style="flex:1;min-width:260px">' + _card('策略路径', 'SIF', spB, '#22c55e') + '</div>';
        }
        row += '</div>';
        h += row;
    }
    el.innerHTML = h;
}

// ════════════════════════════════════════════════════════════
// TAB 3 — Order Probability
// ════════════════════════════════════════════════════════════
function renderCompOrderProb(d) {
    var el = document.getElementById('compTabOrderProb'); if (!el) return;
    var pk = d.position_kw || {}, scores = pk.competitors_with_scores || [], ds = pk.demand_snapshot || {}, ms = pk.market_structure || {};
    if (!scores.length) { el.innerHTML = '<div class="mkt-card"><p>暂无数据</p></div>'; return; }
    var h = '';

    // KPI
    h += _kpiRow([
        _kpi('竞品数', scores.length + '', '#3b82f6'),
        _kpi('最高出单率', scores[0].order_prob.toFixed(1) + '%', '#22c55e'),
        _kpi('最高得分', scores[0].total.toFixed(1), '#f59e0b'),
        _kpi('月搜索量', _fmtNum(ds.est_monthly_volume), '#8b5cf6'),
        _kpi('Top3集中度', _fmtPct(ms.top3_click_share), '#ec4899'),
    ]);

    // Donut + Curve stacked vertically, in one card
    var donutSlices = [];
    var top8 = scores.slice(0, 8), othersP = 0;
    scores.slice(8).forEach(function(s){ othersP += s.order_prob; });
    top8.forEach(function(s,i){ donutSlices.push({label: (s.asin||'').substring(0,10), value: s.order_prob, color: _COLORS[i]}); });
    if (othersP > 0.5) donutSlices.push({label: '其他', value: othersP, color: '#374151'});

    // Donut card body
    var donutBody = '<div style="display:flex;flex-direction:column;align-items:center;padding:4px 0">' +
        _donut(donutSlices, {size:170, center:'100%', sub: scores.length + '个竞品'}) +
        '<div style="font-size:0.62rem;color:#6b7280;margin-top:4px">S<sub>i</sub>=0.35M+0.35T+0.15P+0.15C &nbsp; P<sub>i</sub>=(S<sub>i</sub>/ΣS)×C</div></div>';

    // Charts column: donut card ABOVE curve card, stacked vertically
    var chartsCol = '<div style="flex:0 0 auto;min-width:230px">' +
        _card('出单概率分布', '竞品出单率占比', donutBody, '#22c55e');
    if (scores.length >= 4) {
        var curveRows = scores.slice(0, 12).map(function(s,i){ return {label: (i+1)+'', value: s.total}; });
        chartsCol += _card('得分衰减曲线', '综合得分 S<sub>i</sub> 变化趋势', '<div style="width:100%;max-width:520px">' + _aiBar(curveRows, {height:130, showGrid:true}) + '</div>', '#3b82f6');
    }
    chartsCol += '</div>';

    // Two column: charts (left) + score table (right)
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start">' + chartsCol;

    var tbl = '<table class="mkt-filter-table"><thead><tr><th>#</th><th>ASIN</th><th>M</th><th>T</th><th>P</th><th>C</th><th>总分</th><th>出单率</th></tr></thead><tbody>';
    scores.slice(0, 12).forEach(function(s,i){
        var barW = Math.round((s.total / Math.max(scores[0].total, 1)) * 100);
        var clr = s.order_prob > 8 ? '#22c55e' : (s.order_prob > 4 ? '#f59e0b' : '#ef4444');
        tbl += '<tr><td>' + (i+1) + '</td><td style="position:relative">' + escHtml((s.asin||'').substring(0,11)) +
            '<div style="position:absolute;bottom:0;left:0;height:2px;background:' + _COLORS[i%10] + ';width:' + barW + '%;opacity:0.5;border-radius:1px"></div></td>' +
            '<td>' + s.M.toFixed(0) + '</td><td>' + s.T.toFixed(0) + '</td><td>' + s.P.toFixed(0) + '</td><td>' + s.C.toFixed(0) + '</td>' +
            '<td><strong>' + s.total.toFixed(1) + '</strong></td><td style="color:' + clr + ';font-weight:700">' + s.order_prob.toFixed(1) + '%</td></tr>';
    });
    tbl += '</tbody></table>';
    h += '<div style="flex:1;min-width:380px">' + _card('竞品出单得分排名', '28维评分', tbl, '#f59e0b') + '</div></div>';

    el.innerHTML = h;
}

// ════════════════════════════════════════════════════════════
// TAB 4 — Keyword Confrontation
// ════════════════════════════════════════════════════════════
function renderCompKeyword(d) {
    var el = document.getElementById('compTabKeyword'); if (!el) return;
    var kc = d.keyword_comp || {}, tkw = kc.top_keywords || [];
    if (!tkw.length) { el.innerHTML = '<div class="mkt-card"><p>暂无数据</p></div>'; return; }
    var h = '';

    // Four-color KPI
    var red = tkw.filter(function(k){ return k.rank_evolution === 'declining' || k.gap_severity === 'severe'; });
    var yellow = tkw.filter(function(k){ return k.rank_evolution === 'volatile'; });
    var green = tkw.filter(function(k){ return k.rank_evolution === 'improving' || k.keyword_health === 'core'; });
    var blue = tkw.filter(function(k){ return !k.organic_rank && !k.sp_rank && (k.search_volume||0) > 1000; });
    h += _kpiRow([
        _kpi('🔴 竞品强势', red.length + '词', '#ef4444'),
        _kpi('🟡 双方争夺', yellow.length + '词', '#f59e0b'),
        _kpi('🟢 我方机会', green.length + '词', '#22c55e'),
        _kpi('💎 蓝海', blue.length + '词', '#3b82f6'),
    ]);

    // Table
    var tbl = '<table class="mkt-filter-table"><thead><tr><th>关键词</th><th>健康</th><th>演变</th><th>自然%</th><th>依赖</th><th>CPC</th><th>集中度</th><th>搜索量</th></tr></thead><tbody>';
    tkw.forEach(function(kw){
        tbl += '<tr><td>' + escHtml((kw.keyword||'').substring(0,26)) + '</td>' +
            '<td><span style="background:' + _compHealthColor(kw.keyword_health) + ';color:#fff;border-radius:9px;padding:1px 7px;font-size:0.62rem;font-weight:600">' + (kw.keyword_health||'--') + '</span></td>' +
            '<td>' + escHtml(kw.rank_evolution||'--') + '</td><td>' + _fmtPct(kw.natural_ratio) + '</td>' +
            '<td>' + escHtml(kw.traffic_dependency||'--') + '</td><td>' + (kw.cpc_median ? '$'+kw.cpc_median : '--') + '</td>' +
            '<td>' + _fmtPct(kw.top3_click_share) + '</td><td>' + _fmtNum(kw.search_volume) + '</td></tr>';
    });
    tbl += '</tbody></table>';
    h += _card('关键词健康分层', 'SIF', tbl, '#8b5cf6');

    el.innerHTML = h;
}

// ════════════════════════════════════════════════════════════
// TAB 5 — Ad Lift
// ════════════════════════════════════════════════════════════
function renderCompAdlift(d) {
    var el = document.getElementById('compTabAdlift'); if (!el) return;
    var al = d.ad_lift || {}, traffic = al.traffic || {}, adSt = al.ad_structure || {}, camps = al.campaigns || [], kc = al.keyword_classification || [];
    var h = '';

    // KPI
    var kpis = [_kpi('总Campaign', (adSt.total_campaigns||0)+'', '#3b82f6')];
    (adSt.ad_types || []).forEach(function(t){
        kpis.push(_kpi(t.type, (t.campaign_count||0)+'个', t.type==='SP'?'#22c55e':(t.type==='SB'?'#f59e0b':'#8b5cf6')));
    });
    h += _kpiRow(kpis);

    // Traffic trend chart
    var dates = traffic.dates || [], nf = traffic.nf_score || [], ad = traffic.ad_score || [];
    if (dates.length) {
        var rows = dates.map(function(dt,i){ return {label: dt ? dt.substring(5) : '', segs: [{value: nf[i]||0, color:'#3b82f6', label:'自然'}, {value: ad[i]||0, color:'#f59e0b', label:'广告'}]}; });
        var ta = traffic.trend_analysis || {};
        var extra = '';
        if (ta.overall_direction) extra += '<p style="margin-top:6px;font-size:0.78rem">整体: <strong>' + ta.overall_direction + '</strong> | 近期: ' + (ta.recent_change||'--') + '</p>';
        if (ta.anomaly_weeks && ta.anomaly_weeks.length) extra += '<p style="color:#ef4444;font-size:0.75rem">⚠ 异常周: ' + ta.anomaly_weeks.join(', ') + '</p>';
        h += _card('自然 vs 广告流量趋势', 'SIF', _aiBar(rows, {height:180, showGrid:true}) + extra, '#3b82f6');
    }

    // Campaign + keyword split
    h += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
    if (camps.length) {
        var ct = '<table class="mkt-filter-table"><thead><tr><th>#</th><th>名称</th><th>类型</th><th>份额</th><th>等级</th></tr></thead><tbody>';
        camps.slice(0, 10).forEach(function(c){
            ct += '<tr><td>' + (c.rank||'--') + '</td><td>' + escHtml((c.campaign_display_id||'') + ' ' + (c.campaign_name||'').substring(0,10)) + '</td><td>' + (c.ad_type||'--') + '</td><td>' + _fmtPct(c.share) + '</td><td>' + (c.contribution_tier||'--') + '</td></tr>';
        });
        ct += '</tbody></table>';
        h += '<div style="flex:1;min-width:320px">' + _card('Campaign 贡献 Top10', 'SIF', ct, '#f59e0b') + '</div>';
    }
    if (kc.length) {
        var kt = '<table class="mkt-filter-table"><thead><tr><th>关键词</th><th>分类</th><th>SP</th><th>自然</th><th>%</th></tr></thead><tbody>';
        kc.forEach(function(k){
            var clr = k.classification==='有效拉升'?'#22c55e':(k.classification==='无效烧钱'?'#ef4444':(k.classification==='自然流量'?'#3b82f6':'#888'));
            kt += '<tr><td>' + escHtml((k.keyword||'').substring(0,22)) + '</td><td style="color:' + clr + ';font-weight:700">' + k.classification + '</td>' +
                '<td>' + escHtml(k.sp_rank||'--') + '</td><td>' + escHtml(k.organic_rank||'--') + '</td><td>' + _fmtPct(k.natural_ratio) + '</td></tr>';
        });
        kt += '</tbody></table>';
        h += '<div style="flex:1;min-width:320px">' + _card('五类词分析', 'SIF', kt, '#22c55e') + '</div>';
    }
    h += '</div>';
    el.innerHTML = h || '<div class="mkt-card"><p>暂无广告数据</p></div>';
}

// ════════════════════════════════════════════════════════════
// TAB 6 — Strategy & Action
// ════════════════════════════════════════════════════════════
function renderCompStrategy(d) {
    var el = document.getElementById('compTabStrategy'); if (!el) return;
    var st = d.strategy || {}, sys = st.system_state || {}, sp = st.strategy_path || {}, ds = st.demand_snapshot || {}, comps = st.top_competitors || [];
    var h = '';

    // Verdict banner
    var vc = sp.verdict === 'go' ? '#22c55e' : (sp.verdict === 'caution' ? '#f59e0b' : '#ef4444');
    var vb = sp.verdict === 'go' ? 'rgba(34,197,94,0.08)' : (sp.verdict === 'caution' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)');
    h += '<div style="background:' + vb + ';border-left:4px solid ' + vc + ';padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:10px">';
    h += '<span style="font-size:1.3rem;font-weight:700;color:' + vc + '">' + (sp.verdict||'?').toUpperCase() + '</span>';
    h += '<span style="font-size:0.85rem;color:#d1d5db;margin-left:12px">竞争位置: <strong>' + escHtml(st.competition_position||'--') + '</strong></span></div>';
    if (sp.primary_angle) h += '<div style="font-size:0.78rem;color:#fbbf24;margin-bottom:10px;margin-left:4px">主攻方向: ' + escHtml(sp.primary_angle) + '</div>';
    if (ds.action_hint) h += '<div style="font-size:0.75rem;color:#9ca3af;margin-bottom:10px;margin-left:4px">' + escHtml(ds.action_hint) + '</div>';

    // Three assessment columns
    if (Object.keys(sys).length) {
        h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">';
        ['可进入性','可沉淀性','可持续性'].forEach(function(k){
            var v = sys[k]; if (!v) return;
            var clr = v.level === '高' ? '#22c55e' : (v.level === '中' ? '#f59e0b' : '#ef4444');
            var bg = v.level === '高' ? 'rgba(34,197,94,0.06)' : (v.level === '中' ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)');
            h += '<div style="flex:1;min-width:170px;background:' + bg + ';border-left:3px solid ' + clr + ';padding:10px 12px;border-radius:0 6px 6px 0">' +
                '<div style="font-size:0.68rem;color:#9ca3af">' + k + '</div><div style="font-size:1.2rem;font-weight:700;color:' + clr + '">' + v.level + '</div>' +
                '<div style="font-size:0.65rem;color:#9ca3af;margin-top:4px;line-height:1.4">' + escHtml((v.evidence||'').substring(0,100)) + '</div></div>';
        });
        h += '</div>';
    }

    // Competitor monitor
    if (comps.length) {
        var mt = '<table class="mkt-filter-table"><thead><tr><th>#</th><th>ASIN</th><th>模式</th><th>月销</th><th>$</th><th>评分</th><th>威胁</th></tr></thead><tbody>';
        comps.forEach(function(c){
            var th = c.total_share > 0.1 ? '<span style="color:#ef4444;font-weight:700">🔴 高</span>' : (c.total_share > 0.03 ? '<span style="color:#f59e0b;font-weight:700">🟠 中</span>' : '<span style="color:#6b7280">🟡 低</span>');
            mt += '<tr><td>' + (c.rank||'--') + '</td><td>' + escHtml(c.asin||'') + '</td><td>' + escHtml(c.competition_mode||'--') + '</td><td>' + escHtml(c.monthly_orders||'--') + '</td><td>$' + (c.price||'--') + '</td><td>' + (c.rating||'--') + '</td><td>' + th + '</td></tr>';
        });
        mt += '</tbody></table>';
        h += _card('竞品监控清单', 'SIF', mt, '#ef4444');
    }

    el.innerHTML = h;
}
