// Review Intelligence — 评论洞察 (一级 Tab)
var RI_INTERVAL = null;
var RI_DATA = null;

function updateRISourceBadges(cfg) {
  cfg = cfg || {};
  var ss = cfg.sellersprite_mcp || {};
  var st = cfg.sorftime_mcp || {};
  var sif = cfg.sif_mcp || {};
  ['Sif','Ss','St'].forEach(function(src){
    var c = src==='Ss'?ss:(src==='St'?st:sif);
    var el = document.getElementById('riSrc'+src);
    if (!el) return;
    var hasKey = !!(c.api_key || c.endpoint);
    var on = c.enabled && hasKey;
    var cls = on ? 'mkt-src-on' : (c.enabled ? 'mkt-src-incomplete' : 'mkt-src-off');
    var icon = on ? '✅' : (c.enabled ? '⚠️' : '⛔');
    var label = src==='Ss'?'SellerSprite':(src==='St'?'Sorftime':'SIF');
    el.textContent = icon + ' ' + label + ' MCP：' + (on ? '已连接' : (c.enabled ? '缺密钥' : '未开启'));
    el.className = 'mkt-src-tag ' + cls;
  });
}

function getRISettings() {
  fetch('/api/settings').then(function(r){return r.json();}).then(updateRISourceBadges).catch(function(){});
}

function switchRITab(name) {
  var labels = {pain_points:'痛点', positives:'正面', buyingFactors:'购买因素', improvements:'改进', keywords:'关键词', userProfiles:'画像', scenarios:'场景'};
  var btns = document.querySelectorAll('#riSubTabs .expert-tab');
  for (var i=0;i<btns.length;i++) {
    btns[i].classList.toggle('active', btns[i].textContent.indexOf(labels[name]) !== -1);
  }
  ['riTabPainPoints','riTabPositives','riTabBuyingFactors','riTabImprovements','riTabKeywords','riTabUserProfiles','riTabScenarios'].forEach(function(id){
    document.getElementById(id).style.display = 'none';
  });
  var tabMap = {pain_points:'riTabPainPoints', positives:'riTabPositives', buyingFactors:'riTabBuyingFactors', improvements:'riTabImprovements', keywords:'riTabKeywords', userProfiles:'riTabUserProfiles', scenarios:'riTabScenarios'};
  var el = document.getElementById(tabMap[name]);
  if (el) { el.style.display = 'block'; renderRITabContent(name); }
}

function renderRITabContent(name) {
  if (!RI_DATA || !RI_DATA.consumer_insights) return;
  var items = RI_DATA.consumer_insights[name] || [];
  var tabMap = {pain_points:'riTabPainPoints', positives:'riTabPositives', buyingFactors:'riTabBuyingFactors', improvements:'riTabImprovements', keywords:'riTabKeywords', userProfiles:'riTabUserProfiles', scenarios:'riTabScenarios'};
  var el = document.getElementById(tabMap[name]);
  if (!el) return;

  if (!items.length) {
    el.innerHTML = '<div style="text-align:center;padding:40px 16px;color:var(--text-dim);">' +
      '<div style="font-size:3rem;margin-bottom:8px;opacity:0.3;">-</div>' +
      '<div style="font-size:0.9rem;">No signals extracted</div>' +
      '<div style="font-size:0.75rem;color:var(--muted);margin-top:4px;">Reviews did not mention this dimension</div></div>';
    return;
  }
  var sorted = items.slice().sort(function(a,b){return b.reviewRate - a.reviewRate;});
  var titleMap = {pain_points:'Pain Points', positives:'Positives', buyingFactors:'Buying Factors', improvements:'Improvements', keywords:'Keywords', userProfiles:'User Profiles', scenarios:'Scenarios'};
  var maxRate = sorted[0].reviewRate;
  var html = '';
  if (RI_DATA._snapshot_html) { html += RI_DATA._snapshot_html; }
  html += '<div class="mkt-section-title">' + (titleMap[name]||name) + ' <span style="font-weight:400;color:var(--muted);font-size:0.82rem;">' + sorted.length + ' items</span></div>';
  for (var i=0;i<sorted.length;i++) {
    var it = sorted[i], pct = (it.reviewRate * 100), severity = '';
    if (it.avgRating) { severity = it.avgRating < 2.5 ? 'high' : (it.avgRating < 3.5 ? 'mid' : 'low'); }
    var dot = severity === 'high' ? '&#128308;' : severity === 'mid' ? '&#128993;' : (severity === 'low' ? '&#128994;' : '');
    var sevColor = severity === 'high' ? 'var(--red)' : severity === 'mid' ? 'var(--accent2)' : (severity === 'low' ? 'var(--green)' : 'var(--muted)');
    html += '<div class="mkt-card" style="margin-bottom:4px;padding:8px 14px;">' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        '<span style="font-weight:600;font-size:0.9rem;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escHtml(it.element) + '">' + (dot ? dot + ' ' : '') + escHtml(it.element) + '</span>' +
        '<span style="font-size:0.82rem;color:var(--text-dim);white-space:nowrap;">' + it.count + '</span>' +
        '<span style="font-size:0.85rem;font-weight:600;min-width:40px;text-align:right;">' + pct.toFixed(1) + '%</span>' +
        (it.avgRating ? '<span style="font-size:0.82rem;color:' + sevColor + ';min-width:36px;text-align:right;">' + it.avgRating.toFixed(1) + '</span>' : '') +
      '</div></div>';
  }
  el.innerHTML = html;
}

function startReviewIntel() {
  var asin = document.getElementById('riAsin').value.trim();
  var mp = document.getElementById('riCountry').value;
  if (!mp) { showToast('请选择站点'); return; }
  if (!asin) { showToast('请输入 ASIN'); return; }
  if (!/^[A-Za-z0-9]{5,15}$/.test(asin)) { showToast('ASIN 格式错误'); return; }
  getRISettings();
  RI_DATA = null;
  document.getElementById('riProgressBar').style.display = 'block';
  document.getElementById('riProgressFill').style.width = '2%';
  document.getElementById('riProgressText').style.display = 'block';
  document.getElementById('riProgressText').textContent = '⏳ 启动中...';
  ['riTabPainPoints','riTabPositives','riTabBuyingFactors','riTabImprovements','riTabKeywords','riTabUserProfiles','riTabScenarios'].forEach(function(id){
    document.getElementById(id).innerHTML = '<div class="mkt-loading"><div style="text-align:center;padding:20px;">⏳ 等待分析完成...</div></div>';
  });
  fetch('/api/review-intelligence', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({asin:asin, marketplace:mp})
  }).then(function(r){return r.json();}).then(function(data){
    if (data.error) { showToast('错误: ' + data.error); return; }
    pollReviewIntel(data.job_id);
  }).catch(function(e){
    showToast('请求失败: ' + e.message);
    document.getElementById('riProgressBar').style.display = 'none';
    document.getElementById('riProgressText').style.display = 'none';
  });
}

function pollReviewIntel(jobId) {
  if (RI_INTERVAL) clearInterval(RI_INTERVAL);
  RI_INTERVAL = setInterval(function(){
    fetch('/api/review-intelligence/' + jobId).then(function(r){return r.json();}).then(function(job){
      if (!job || job.status === 'not_found') { clearInterval(RI_INTERVAL); return; }
      var pct = job.progress || 0;
      document.getElementById('riProgressFill').style.width = pct + '%';
      var detail = '';
      if (job.status === 'collecting') detail = '⏳ 正在获取评论数据... ' + pct + '%';
      else if (job.status === 'analyzing') {
        detail = '🧠 Map/Reduce 分析中... ' + pct + '%';
        if (job.map_cached) detail += ' (缓存命中' + job.map_cached + '条';
        if (job.map_new) detail += ', 新处理' + job.map_new + '条';
        detail += ')';
      } else if (job.status === 'done') detail = '✅ 分析完成';
      else if (job.status === 'failed') detail = '❌ 分析失败';
      document.getElementById('riProgressText').textContent = detail;
      if (job.status === 'failed') {
        clearInterval(RI_INTERVAL);
        document.getElementById('riProgressText').textContent = '❌ 失败: ' + (job.errors ? JSON.stringify(job.errors).substring(0,200) : '未知错误');
        return;
      }
      if (job.status === 'done' && job.view_model) {
        clearInterval(RI_INTERVAL);
        document.getElementById('riProgressBar').style.display = 'none';
        document.getElementById('riProgressText').style.display = 'none';
        renderRIResults(job.view_model);
      }
    }).catch(function(){});
  }, 1500);
}

function renderRIResults(vm) {
  RI_DATA = vm;
  var meta = vm.meta || {};
  var snap = vm.snapshot || {};
  var sd = snap.sentiment_distribution || {};
  var posPct = sd.positive ? (sd.positive*100).toFixed(0) : '0';
  var negPct = sd.negative ? (sd.negative*100).toFixed(0) : '0';
  var rb = snap.rating_breakdown || {};
  var stars = ['1','2','3','4','5'];
  var counts = stars.map(function(s){ return rb[s] || 0; });
  var maxC = Math.max.apply(null, counts) || 1;
  var svgW = 400, svgH = 130, pad = 20;
  var pts = stars.map(function(s, i){
    var x = pad + (i / (stars.length-1)) * (svgW - 2*pad);
    var y = svgH - pad - (counts[i] / maxC) * (svgH - 2*pad);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  var areaD = 'M' + (pad).toFixed(1) + ',' + (svgH-pad) + ' L' + pts + ' L' + (svgW-pad).toFixed(1) + ',' + (svgH-pad) + ' Z';
  var snapHtml = '';
  snapHtml += '<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">' +
    '<div class="mkt-card" style="flex:1;min-width:90px;text-align:center;padding:14px 8px;"><div style="font-size:1.8rem;font-weight:700;color:var(--accent);">' + (snap.review_count||0) + '</div><div style="font-size:0.7rem;color:var(--muted);">Reviews</div></div>' +
    '<div class="mkt-card" style="flex:1;min-width:90px;text-align:center;padding:14px 8px;"><div style="font-size:1.8rem;font-weight:700;color:#f59e0b;">' + (snap.avg_rating||0).toFixed(1) + '</div><div style="font-size:0.7rem;color:var(--muted);">Avg Rating</div></div>' +
    '<div class="mkt-card" style="flex:1;min-width:90px;text-align:center;padding:14px 8px;"><div style="font-size:1.8rem;font-weight:700;color:var(--green);">' + posPct + '%</div><div style="font-size:0.7rem;color:var(--muted);">Positive</div></div>' +
    '<div class="mkt-card" style="flex:1;min-width:90px;text-align:center;padding:14px 8px;"><div style="font-size:1.8rem;font-weight:700;color:var(--red);">' + negPct + '%</div><div style="font-size:0.7rem;color:var(--muted);">Negative</div></div>' +
    '</div>';
  snapHtml += '<div class="mkt-card" style="margin-bottom:12px;padding:12px 16px;">' +
    '<div style="font-size:0.8rem;color:var(--muted);margin-bottom:6px;">Rating Distribution</div>' +
    '<svg width="' + svgW + '" height="' + svgH + '" style="display:block;margin:0 auto;">' +
      '<polygon points="' + areaD + '" fill="var(--accent)" opacity="0.08" />' +
      '<polyline points="' + pts + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />' +
      stars.map(function(s, i){
        var x = pad + (i/(stars.length-1))*(svgW-2*pad), y = svgH - pad - (counts[i]/maxC)*(svgH-2*pad);
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="var(--accent)" />' +
          '<text x="' + x.toFixed(1) + '" y="' + (svgH-3).toFixed(0) + '" text-anchor="middle" font-size="11" fill="var(--muted)">' + s + '&#x2605;</text>' +
          '<text x="' + x.toFixed(1) + '" y="' + (y-6).toFixed(0) + '" text-anchor="middle" font-size="10" fill="var(--text-dim)">' + counts[i] + '</text>';
      }).join('') +
    '</svg></div>';
  if (meta.sample_warning) {
    snapHtml += '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);border-radius:6px;padding:6px 10px;font-size:0.78rem;margin-bottom:10px;">' + escHtml(meta.sample_warning) + '</div>';
  }
  RI_DATA._snapshot_html = snapHtml;
  switchRITab('pain_points');
}
