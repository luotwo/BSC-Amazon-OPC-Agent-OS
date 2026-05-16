// ── Data Source Badges ──
function updateExpertSourceBadges() {
  fetch('/api/settings').then(function(r){return r.json();}).then(function(cfg){
    var sif = cfg.sif_mcp || {};
    var ss = cfg.sellersprite_mcp || {};
    var st = cfg.sorftime_mcp || {};
    function setBadge(id, name, enabled, ok) {
      var el = document.getElementById(id); if (!el) return;
      if (ok) { el.className='mkt-src-tag active'; el.textContent=name+'：已连接'; }
      else if (enabled) { el.className='mkt-src-tag warn'; el.textContent=name+'：未配置'; }
      else { el.className='mkt-src-tag mkt-src-off'; el.textContent=name+'：未开启'; }
    }
    setBadge('expertSrcSif', 'SIF MCP', !!(sif.enabled), !!(sif.enabled && sif.endpoint && sif.api_key));
    setBadge('expertSrcSs', 'SellerSprite MCP', !!(ss.enabled), !!(ss.enabled && ss.endpoint && ss.api_key));
    setBadge('expertSrcSt', 'Sorftime MCP', !!(st.enabled), !!(st.enabled && st.endpoint && st.api_key));
  }).catch(function(){});
}
updateExpertSourceBadges();

// ── Query bar start ──
function startExpertAnalysis() {
  var site = document.getElementById('expertSite').value;
  var asin = document.getElementById('expertAsin').value.trim();
  if (!site) { showToast('请选择站点'); return; }
  if (!asin) { showToast('请输入 ASIN'); return; }
  var jobId = crypto.randomUUID();
  document.getElementById('expertEmpty').style.display = 'block';
  document.getElementById('expertEmpty').innerHTML = '<div class="icon">⏳</div>正在采集数据并生成专家建议...<br><small>SIF MCP + SellerSprite + Sorftime · 约 30-60 秒</small>';
  ['expertTabTitle','expertTabBullets','expertTabQa','expertTabSelling','expertTabInsights'].forEach(function(id){ document.getElementById(id).style.display='none'; });
  document.getElementById('expertBadge').style.display = 'none';
  fetch('/api/expert-analysis/' + jobId + '?asin=' + encodeURIComponent(asin) + '&country=' + encodeURIComponent(site))
    .then(function(r){return r.json();})
    .then(function(data){
      if (data.error) { document.getElementById('expertEmpty').innerHTML = '<div class="icon">⚠️</div>'+escHtml(data.error); return; }
      window.expertData = data;
      document.getElementById('expertEmpty').style.display = 'none';
      document.getElementById('expertBadge').style.display = 'inline-block';
      document.getElementById('expertTabTitle').style.display = 'block';
      if (data.title_suggestion) renderTitleSuggestions(data.title_suggestion);
      if (data.bullets_analysis) renderBulletsAnalysis(data.bullets_analysis);
      if (data.qa_suggestions) renderQaSuggestions(data.qa_suggestions);
      if (data.selling_points) renderSellingPoints(data.selling_points);
      if (data.data_insights) renderDataInsights(data.data_insights);
      switchExpertTab('title');
      showToast('专家建议已生成');
    }).catch(function(e){ document.getElementById('expertEmpty').innerHTML = '<div class="icon">❌</div>请求失败: '+escHtml(e.message); });
}

// ── Expert Tab Switch ──

function switchExpertTab(tab) {
  document.querySelectorAll('#expertSubTabs .expert-tab').forEach(function(t){t.classList.remove('active');});
  ['expertTabTitle','expertTabBullets','expertTabQa','expertTabSelling','expertTabInsights'].forEach(function(id){
    document.getElementById(id).style.display='none';
  });
  var tabMap = {title:'expertTabTitle', bullets:'expertTabBullets', qa:'expertTabQa', selling:'expertTabSelling', insights:'expertTabInsights'};
  var labels = {title:'标题', bullets:'五点', qa:'Q&A', selling:'卖点', insights:'数据洞察'};
  var btns = document.querySelectorAll('#expertSubTabs .expert-tab');
  for (var i=0;i<btns.length;i++) { if (btns[i].textContent.indexOf(labels[tab])!==-1) btns[i].classList.add('active'); }
  document.getElementById(tabMap[tab]).style.display='block';
}

// ═══════════════════════════════════════════════════════════════
// ── Expert Suggestions ──
async function loadExpert(jobId) {
  try {
    var res = await fetch('/api/expert-suggestions/'+jobId);
    var data = await res.json();
    if (data.error) return;
    expertData = data;
    document.getElementById('expertEmpty').style.display = 'none';
    document.getElementById('expertBadge').style.display = 'inline-block';
    renderTitleSuggestions(data.title_suggestion);
    renderBulletsAnalysis(data.bullets_analysis);
    renderQaSuggestions(data.qa_suggestions);
    renderSellingPoints(data.selling_points);
    renderDataInsights(data.data_insights);
  } catch(e){}
}

function renderTitleSuggestions(ts) {
  var el = document.getElementById('expertTabTitle');
  if (!ts) { el.innerHTML='<div class="empty">标题建议暂不可用</div>'; return; }
  var ca = ts.cosmo_analysis||{};
  var html = '';

  // ── Score + Grade card ──
  var sc = ca.title_score||0;
  var scColor = sc>=80?'var(--green)':sc>=60?'var(--accent2)':'var(--red)';
  html += '<div class="expert-card" style="text-align:center;">';
  html += '<div class="expert-label">📊 标题 COSMO 评分</div>';
  html += '<div style="font-size:2.2rem;font-weight:800;color:'+scColor+';">'+sc+'<span style="font-size:.8rem;">/100</span></div>';
  html += '<div style="font-size:.8rem;font-weight:600;color:'+scColor+';margin:4px 0;">'+escHtml(ca.title_grade||'')+'</div>';
  html += '<div style="font-size:.62rem;color:var(--muted);">'+escHtml(ca.improvement||'')+'</div>';
  html += '</div>';

  // ── Structure check cards ──
  html += '<div class="expert-card"><div class="expert-label">🔍 标题结构检测</div>';
  (ca.structure_checks||[]).forEach(function(c){
    var icon = c.present ? '✅' : '❌';
    var col = c.present ? 'var(--green)' : 'var(--red)';
    html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border);font-size:.7rem;">';
    html += '<span>'+icon+'</span>';
    html += '<span style="font-weight:600;min-width:80px;">'+escHtml(c.element)+'</span>';
    html += '<span style="color:'+col+';flex:1;">'+escHtml(c.detail)+'</span>';
    html += '</div>';
  });
  html += '<div style="font-size:.65rem;color:var(--muted);margin-top:6px;">通过 ' + ca.present_count + '/' + ca.total_checks + ' 项检测</div>';
  html += '</div>';

  // ── Original title ──
  html += '<div class="expert-card"><div class="expert-label">📌 原始标题（Amazon Listing）</div>';
  html += '<p style="color:var(--text);font-size:.78rem;line-height:1.5;">'+escHtml(ts.original||'')+'</p>';
  html += '<div style="font-size:.62rem;color:var(--muted);margin-top:4px;">数据来源：' + escHtml(ca.data_note||'MCP采集') + '</div>';
  html += '</div>';

  // ── Keyword gaps ──
  var gaps = ca.keyword_gaps||[];
  if (gaps.length > 0) {
    html += '<div class="expert-card" style="border-left:3px solid var(--accent2);"><div class="expert-label">⚠️ 标题缺失的高流量词</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
    gaps.forEach(function(k){
      html += '<span style="font-size:.64rem;background:rgba(245,158,11,.12);padding:3px 8px;border-radius:10px;color:var(--accent2);">'+escHtml(k)+'</span>';
    });
    html += '</div>';
    html += '<div style="font-size:.62rem;color:var(--muted);margin-top:6px;">以上关键词在标题中未被覆盖，建议融入以提升搜索曝光</div>';
    html += '</div>';
  }

  // ── Suggestions ──
  html += '<div class="expert-card" style="border-left:3px solid var(--accent);"><div class="expert-label">💡 优化建议</div>';
  (ca.suggestions||[]).forEach(function(s,i){
    var txt = typeof s === 'string' ? s : (s.fix || s.issue || JSON.stringify(s));
    var prio = (s.priority === 'high') ? '🔴' : (s.priority === 'medium') ? '🟡' : '🟢';
    html += '<div style="display:flex;gap:6px;padding:3px 0;font-size:.7rem;"><span style="color:var(--accent);">'+(i+1)+'.</span><span>'+prio+' '+escHtml(txt)+'</span></div>';
  });
  html += '</div>';

  // ── Optimized preview (marketplace-language labels) ──
  var mkt = document.getElementById('marketplaceSelect').value;
  var _TL = {
    JP: {opt:'✅ 最適化タイトル（日本語）', en:'🌐 日本語タイトル提案'},
    DE: {opt:'✅ Optimierter Titel (Deutsch)', en:'🌐 Deutscher Titelvorschlag'},
    FR: {opt:'✅ Titre optimisé (Français)', en:'🌐 Suggestion de titre français'},
    IT: {opt:'✅ Titolo ottimizzato (Italiano)', en:'🌐 Suggerimento titolo italiano'},
    ES: {opt:'✅ Título optimizado (Español)', en:'🌐 Sugerencia de título español'},
    NL: {opt:'✅ Geoptimaliseerde titel (Nederlands)', en:'🌐 Nederlandse titelsuggestie'},
    SE: {opt:'✅ Optimerad titel (Svenska)', en:'🌐 Svenskt titelförslag'},
    PL: {opt:'✅ Zoptymalizowany tytuł (Polski)', en:'🌐 Polska sugestia tytułu'},
    TR: {opt:'✅ Optimize Başlık (Türkçe)', en:'🌐 Türkçe Başlık Önerisi'},
    BR: {opt:'✅ Título otimizado (Português)', en:'🌐 Sugestão de título português'},
    MX: {opt:'✅ Título optimizado (Español)', en:'🌐 Sugerencia de título español'},
  };
  var tl = _TL[mkt] || {opt:'✅ 建议优化标题', en:'🌐 站点语言标题翻译'};
  html += '<div class="expert-card" style="border-left:3px solid var(--green);"><span class="expert-label">'+tl.opt+'</span><div style="display:flex;align-items:flex-start;gap:6px;"><p id="optTitleZh" class="highlight" style="font-size:.78rem;flex:1;margin:0;">'+escHtml(ts.optimized||'')+'</p><button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById(\'optTitleZh\').textContent);showToast(\'已复制\',\'success\')" title="复制">📋</button></div></div>';
  html += '<div class="expert-card"><span class="expert-label">'+tl.en+'</span><div style="display:flex;align-items:flex-start;gap:6px;"><p id="optTitleEn" style="font-size:.76rem;flex:1;margin:0;">'+escHtml(ts.en_optimized||'')+'</p><button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById(\'optTitleEn\').textContent);showToast(\'Copied\',\'success\')" title="复制">📋</button></div></div>';

  el.innerHTML = html;
}

function renderBulletsAnalysis(ba) {
  var el = document.getElementById('expertTabBullets');
  if (!ba||!ba.bullets) { el.innerHTML='<div class="empty">五点分析暂不可用</div>'; return; }
  var scCls = ba.overall_score<40?'color:var(--red);':ba.overall_score<70?'color:var(--accent2);':'color:var(--green);';
  var html = '<div class="expert-card"><div class="expert-label">📊 综合评估</div><div style="display:flex;align-items:center;gap:10px;"><span style="font-size:1.8rem;font-weight:700;'+scCls+'">'+ba.overall_score+'</span><span style="font-size:.75rem;">/ 100</span><span style="font-size:.7rem;color:var(--muted);">'+escHtml(ba.summary||'')+'</span></div></div>';
  for (var i=0;i<ba.bullets.length;i++) {
    var b = ba.bullets[i];
    var sc = b.cosmo_score;
    var barCls = sc<40?'low':sc<70?'mid':'';
    var scColor = sc<40?'var(--red)':sc<70?'var(--accent2)':'var(--green)';
    html += '<div class="expert-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;"><h4 style="margin:0;font-size:.74rem;">Bullet '+(b.index||'?')+' <span style="font-weight:400;color:var(--muted);">— '+escHtml(b.type||'')+'</span></h4><span style="font-size:.68rem;color:'+scColor+';font-weight:600;">COSMO '+sc+'/100</span></div>';
    html += '<div class="score-bar" style="margin-bottom:4px;"><div class="score-bar-fill '+barCls+'" style="width:'+sc+'%;"></div></div>';
    html += '<div style="font-size:.68rem;color:var(--muted);margin-bottom:4px;">📝 原始卖点: '+escHtml(b.original)+'</div>';
    html += '<div style="background:var(--bg);padding:6px 8px;border-radius:4px;margin-bottom:4px;"><span style="font-size:.62rem;color:var(--muted);">💡 建议卖点（中文）</span><div style="display:flex;align-items:flex-start;gap:6px;"><p style="font-size:.72rem;margin:0;flex:1;">'+escHtml(b.suggestion_zh||b.original||'')+'</p><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector(\'p\').textContent);showToast(\'已复制\',\'success\')" title="复制">📋</button></div></div>';
    html += '<div style="padding:4px 8px;"><span style="font-size:.62rem;color:var(--muted);">🌐 站点语言翻译</span><div style="display:flex;align-items:flex-start;gap:6px;"><p style="font-size:.68rem;margin:0;color:var(--accent2);flex:1;">'+escHtml(b.suggestion_en||b.original||'')+'</p><button class="copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector(\'p\').textContent);showToast(\'Copied\',\'success\')" title="复制">📋</button></div></div></div>';
  }
  el.innerHTML = html;
}

function renderQaSuggestions(qs) {
  var el = document.getElementById('expertTabQa');
  if (!qs||!qs.qa_pairs) { el.innerHTML='<div class="empty">Q&A建议暂不可用</div>'; return; }
  var mkt = document.getElementById('marketplaceSelect').value;
  var _QF = {JP:'🇯🇵',DE:'🇩🇪',FR:'🇫🇷',IT:'🇮🇹',ES:'🇪🇸',UK:'🇬🇧',CA:'🇨🇦',MX:'🇲🇽',AU:'🇦🇺',IN:'🇮🇳',BR:'🇧🇷',NL:'🇳🇱',SE:'🇸🇪',PL:'🇵🇱',TR:'🇹🇷',AE:'🇦🇪',SA:'🇸🇦',SG:'🇸🇬'};
  var mktFlag = _QF[mkt] || '🌐';
  var mlLabel = {JP:'日本語',DE:'Deutsch',FR:'Français',IT:'Italiano',ES:'Español',UK:'English',CA:'English',AU:'English',IN:'English',MX:'Español',BR:'Português',NL:'Nederlands',TR:'Türkçe',SG:'English'};
  var origLabel = (mlLabel[mkt]||'Original') + ' Q';
  var html = '<div class="expert-card"><div class="expert-label">🤖 Rufus 智能 Q&A</div><p style="font-size:.7rem;color:var(--muted);margin:0;">共 '+qs.total+' 组优化问答</p></div>';
  for (var i=0;i<qs.qa_pairs.length;i++) {
    var q = qs.qa_pairs[i];
    var qid = 'qa'+i;
    var isSpecial = q._key === 'seller_keyword_hint' || q._key === 'data_note';
    var specialBadge = q._key === 'seller_keyword_hint' ? ' 🛠️ 关键词数据' : q._key === 'data_note' ? ' 📋 数据说明' : '';
    html += '<div class="expert-card"'+(isSpecial?' style="border-left:3px solid var(--accent);"':'')+'><div style="margin-bottom:6px;"><span style="font-weight:600;font-size:.72rem;">🇨🇳 中文 Q'+(i+1)+specialBadge+'</span><div style="font-size:.7rem;color:var(--accent);margin:3px 0;">'+escHtml(q.q_zh||'')+'</div><div style="display:flex;align-items:flex-start;gap:6px;"><div id="'+qid+'_zh_a" style="font-size:.74rem;flex:1;">'+escHtml(q.a_zh||'')+'</div><button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById(\''+qid+'_zh_a\').textContent);showToast(\'已复制\',\'success\')" title="复制">📋</button></div></div>';
    html += '<div style="background:var(--bg);padding:6px 10px;border-radius:4px;"><span style="font-weight:600;font-size:.68rem;">'+mktFlag+' '+origLabel+(i+1)+specialBadge+'</span><div style="font-size:.66rem;color:var(--accent2);margin:2px 0;">'+escHtml(q.q_en||'')+'</div><div style="display:flex;align-items:flex-start;gap:6px;"><div id="'+qid+'_en_a" style="font-size:.7rem;flex:1;">'+escHtml(q.a_en||'')+'</div><button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById(\''+qid+'_en_a\').textContent);showToast(\'Copied\',\'success\')" title="复制">📋</button></div></div></div>';
  }
  el.innerHTML = html;
}

function renderSellingPoints(sp) {
  var el = document.getElementById('expertTabSelling');
  if (!sp) { el.innerHTML='<div class="empty">卖点分析暂不可用</div>'; return; }
  var html = '';
  if (sp.top_3&&sp.top_3.length) {
    html += '<div class="expert-card" style="border-left:3px solid var(--green);"><div class="expert-label">🏆 Top 3 核心卖点</div>';
    sp.top_3.forEach(function(t,i){ html += '<div style="display:flex;gap:8px;padding:4px 8px;background:var(--bg);border-radius:4px;margin-bottom:4px;"><span style="font-weight:700;color:var(--accent);">'+(i+1)+'</span><span style="font-size:.72rem;">'+escHtml(t||'')+'</span></div>'; });
    html += '</div>';
  }
  var pts = sp.extracted_points||[];
  if (pts.length) {
    html += '<div class="expert-card"><div class="expert-label">🔍 COSMO 强度评估</div>';
    pts.forEach(function(p){
      var sc = p.cosmo_strength||0;
      var barCls = sc<50?'low':sc<70?'mid':'';
      html += '<div style="margin-bottom:6px;padding:6px 8px;background:var(--bg);border-radius:4px;"><div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;"><span style="font-size:.66rem;font-weight:600;">强度: '+sc+'/100</span><div class="score-bar" style="flex:1;margin:0;"><div class="score-bar-fill '+barCls+'" style="width:'+sc+'%;"></div></div></div><p style="font-size:.7rem;margin:2px 0;">'+escHtml(p.text||'')+'</p></div>';
    });
    html += '</div>';
  }
  if (sp.cosmo_advice) {
    html += '<div class="expert-card" style="border-left:3px solid var(--accent2);"><div class="expert-label">🤖 COSMO 专项建议</div><p style="font-size:.72rem;">'+escHtml(sp.cosmo_advice)+'</p></div>';
  }
  el.innerHTML = html||'<div class="empty">卖点分析数据不足</div>';
}

function renderDataInsights(di) {
  var el = document.getElementById('expertTabInsights');
  if (!di) { el.innerHTML='<div class="empty">数据洞察暂不可用</div>'; return; }
  var ov = di.overview||{};
  var kw = di.keyword_health||{};
  var bh = di.bullets_health||{};
  var ms = di.market_signals||{};
  var html = '';

  // ═══ Page title ═══
  html += '<div style="margin-bottom:10px;">';
  html += '<div style="font-size:.85rem;font-weight:700;color:var(--text);">📊 数据洞察面板</div>';
  html += '<div style="font-size:.65rem;color:var(--muted);margin-top:2px;">' + escHtml(di.data_quality_note||'') + '</div>';
  html += '</div>';

  // ═══ TOP ROW: 2-column dashboard ═══
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">';

  // Left: Listing Health Score card
  var score = bh.avg_score || 0;
  var scoreCls = score >= 70 ? 'var(--green)' : score >= 45 ? 'var(--accent2)' : 'var(--red)';
  var grade = score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 40 ? 'C' : 'D';
  html += '<div class="expert-card" style="text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;">';
  html += '<div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Listing 健康评分</div>';
  html += '<div style="width:80px;height:80px;border-radius:50%;border:4px solid ' + scoreCls + ';display:flex;align-items:center;justify-content:center;margin:4px 0;">';
  html += '<span style="font-size:1.8rem;font-weight:800;color:' + scoreCls + ';">' + score + '</span>';
  html += '</div>';
  html += '<span style="font-size:.8rem;font-weight:700;color:' + scoreCls + ';">等级 ' + grade + '</span>';
  html += '<span style="font-size:.6rem;color:var(--muted);margin-top:2px;">' + (score >= 55 ? 'Rufus 推荐优先级较高' : score >= 40 ? '中等偏下 · 有改善空间' : '需重点关注优化') + '</span>';
  html += '</div>';

  // Right: Quick Stats
  html += '<div class="expert-card">';
  html += '<div style="font-size:.7rem;font-weight:700;color:var(--text);margin-bottom:8px;">⚡ 关键指标</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.68rem;">';
  html += '<div><span style="color:var(--muted);">类目</span><br><span style="color:var(--text);font-weight:600;">' + escHtml((ov.category||'—').substring(0,25)) + '</span></div>';
  html += '<div><span style="color:var(--muted);">品牌</span><br><span style="color:var(--text);font-weight:600;">' + escHtml(ov.brand||'未识别') + '</span></div>';
  html += '<div><span style="color:var(--muted);">价格</span><br><span style="color:var(--accent2);font-weight:700;">' + escHtml(ov.price||'—') + '</span></div>';
  html += '<div><span style="color:var(--muted);">评分</span><br><span style="color:var(--text);font-weight:600;">' + escHtml(ov.rating||'—') + '</span></div>';
  html += '<div><span style="color:var(--muted);">流量词</span><br><span style="color:var(--accent);font-weight:700;">' + kw.total + ' 个</span></div>';
  html += '<div><span style="color:var(--muted);">多样性</span><br><span style="color:var(--text);font-weight:600;">' + escHtml(kw.diversity||'—') + '</span></div>';
  html += '</div></div>';

  html += '</div>'; // end top row

  // ═══ MIDDLE ROW: Bullets detail + Keyword radar ═══
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">';

  // Left: Bullets breakdown
  html += '<div class="expert-card"><div style="font-size:.7rem;font-weight:700;color:var(--text);margin-bottom:8px;">📝 五点评分明细</div>';
  (bh.details||[]).forEach(function(d){
    var barCls = d.score >= 70 ? '' : d.score >= 50 ? 'mid' : 'low';
    var col = d.score >= 70 ? 'var(--green)' : d.score >= 50 ? 'var(--accent2)' : 'var(--red)';
    html += '<div style="margin-bottom:6px;">';
    html += '<div style="display:flex;justify-content:space-between;font-size:.6rem;margin-bottom:2px;">';
    html += '<span style="color:var(--muted);">Bullet ' + d.index + '</span>';
    html += '<span style="font-weight:600;color:' + col + ';">' + d.score + '/100</span>';
    html += '</div>';
    html += '<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden;">';
    html += '<div style="height:100%;width:' + d.score + '%;background:' + col + ';border-radius:2px;transition:width .5s;"></div>';
    html += '</div>';
    html += '</div>';
  });
  html += '<div style="font-size:.62rem;color:var(--muted);margin-top:6px;padding:4px 6px;background:var(--bg);border-radius:4px;">' + escHtml(bh.judgment||'') + '</div>';
  html += '</div>';

  // Right: Keywords
  html += '<div class="expert-card"><div style="font-size:.7rem;font-weight:700;color:var(--text);margin-bottom:8px;">🔑 流量词覆盖</div>';
  html += '<div style="font-size:.64rem;color:var(--muted);margin-bottom:6px;">' + escHtml(kw.coverage_judgment||'') + '</div>';
  html += '<div class="data-table" style="max-height:180px;overflow-y:auto;"><table>';
  html += '<tr><th>#</th><th>关键词</th><th>独立词</th></tr>';
  (kw.top5||[]).forEach(function(k,i){
    html += '<tr><td style="color:var(--muted);">' + (i+1) + '</td><td>' + escHtml(k) + '</td><td style="color:var(--muted);">✓</td></tr>';
  });
  html += '</table></div>';
  html += '</div>';

  html += '</div>'; // end middle row

  // ═══ BOTTOM: Market + Recommendations ═══
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';

  // Left: Market context
  html += '<div class="expert-card"><div style="font-size:.7rem;font-weight:700;color:var(--text);margin-bottom:8px;">📡 市场环境</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.66rem;">';
  html += '<div><span style="color:var(--muted);">数据源</span><br><span style="color:var(--accent2);font-weight:600;">' + escHtml(ms.mcp_sources||'—') + '</span></div>';
  html += '<div><span style="color:var(--muted);">数据质量</span><br><span style="color:var(--accent);font-weight:600;">' + escHtml(ms.data_quality||'—') + '</span></div>';
  html += '</div>';
  if ((ms.cosmo_intents||[]).length > 0) {
    html += '<div style="margin-top:8px;font-size:.62rem;color:var(--muted);">COSMO 意图标签</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;">';
    ms.cosmo_intents.forEach(function(ci){
      html += '<span style="font-size:.58rem;background:rgba(22,119,255,.12);padding:2px 7px;border-radius:8px;color:var(--accent);">' + escHtml(ci) + '</span>';
    });
    html += '</div>';
  }
  html += '</div>';

  // Right: Recommendations
  html += '<div class="expert-card" style="border:1px solid rgba(245,158,11,.3);"><div style="font-size:.7rem;font-weight:700;color:var(--accent2);margin-bottom:8px;">🎯 行动建议</div>';
  (di.recommendations||[]).forEach(function(r){
    var icon = r.priority==='high'?'🔴':r.priority==='medium'?'🟡':'🟢';
    html += '<div style="display:flex;gap:6px;padding:4px 0;border-bottom:1px solid var(--border);font-size:.66rem;align-items:flex-start;">';
    html += '<span style="flex-shrink:0;width:20px;text-align:center;">' + icon + '</span>';
    html += '<div style="flex:1;"><span style="font-weight:600;color:var(--text);">' + escHtml(r.area) + '</span>';
    html += '<div style="color:var(--muted);font-size:.62rem;">' + escHtml(r.action) + '</div></div>';
    html += '</div>';
  });
  html += '</div>';

  html += '</div>'; // end bottom row

  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════