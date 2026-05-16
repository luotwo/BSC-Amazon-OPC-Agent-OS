// ── Tab: TikTok 竞品分析 ──
function switchTiktokTab(tab) {
  document.querySelectorAll('#tkSubTabs .expert-tab').forEach(function(t){t.classList.remove('active');});
  ['tkTabSimilar','tkTabCategory','tkTabCatreport'].forEach(function(id){document.getElementById(id).style.display='none';});
  var tabMap = {similar:'tkTabSimilar', category:'tkTabCategory', catreport:'tkTabCatreport'};
  var labels = {similar:'相似产品', category:'类目查询', catreport:'类目报告'};
  var btns = document.querySelectorAll('#tkSubTabs .expert-tab');
  for (var i=0;i<btns.length;i++) { if (btns[i].textContent.indexOf(labels[tab])!==-1) btns[i].classList.add('active'); }
  document.getElementById(tabMap[tab]).style.display='block';
}

function updateTiktokSourceBadge(cfg) {
  cfg = cfg || {};
  var st = cfg.sorftime_mcp || {};
  var ok = st.enabled && st.endpoint && st.api_key;
  function set(id, label) { var el=document.getElementById(id); if(!el)return; el.classList.remove('active','warn'); if(ok){el.classList.add('active');el.textContent=label+'：已连接';}else{el.classList.add('warn');el.textContent=label+'：未配置';} }
  set('tkSrcSt', 'Sorftime MCP'); set('tkCatSrc', 'Sorftime MCP'); set('tkCatRptSrc', 'Sorftime MCP');
}

async function startTiktokAnalysis() {
  var site = document.getElementById('tkSite').value;
  var searchName = document.getElementById('tkSearchName').value.trim();
  var page = parseInt(document.getElementById('tkPage').value) || 1;
  if (!site) { showToast('请选择站点'); return; }
  if (!searchName) { showToast('请输入产品英文名称'); return; }
  try { var r=await fetch('/api/settings'); if(r.ok) updateTiktokSourceBadge(await r.json()); } catch(e) {}
  var area = document.getElementById('tkSimilarArea');
  area.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><div style="margin-top:10px">正在采集 TikTok 数据...</div></div>';
  var jobId = 'tk' + Date.now().toString(36) + Math.random().toString(36).substr(2,6);
  fetch('/api/tiktok-analysis/' + jobId + '?site=' + encodeURIComponent(site) + '&searchName=' + encodeURIComponent(searchName) + '&page=' + page)
    .then(function(r){return r.json();}).then(function(data){
      if (data.error) { area.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">'+escHtml(data.error)+'</div>'; return; }
      tkRenderSimilar(data);
    }).catch(function(err){ area.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">请求失败：'+escHtml(err.message)+'</div>'; });
}

function tkRenderSimilar(data) {
  var items = data.similar_products || [];
  var area = document.getElementById('tkSimilarArea');
  if (!items.length) { area.innerHTML = '<div class="mkt-empty-card">未找到相似产品</div>'; return; }
  var html = '<div class="mkt-section-title">相似产品 · ' + items.length + ' 条</div>';
  html += '<div class="mkt-filter-table"><table><thead><tr><th>#</th><th>标题</th><th>品牌</th><th>周销</th><th>价格</th><th>评分</th><th>评论</th><th>店铺</th><th></th></tr></thead><tbody>';
  for (var i = 0; i < items.length; i++) {
    var p = items[i]; var pid = p.ProductId || '';
    html += '<tr id="tkRow_'+i+'"><td>'+(i+1)+'</td><td title="'+escHtml(p.Title||'')+'">'+escHtml((p.Title||'').substring(0,50))+'</td><td>'+escHtml(p['品牌']||p.brand||'—')+'</td><td>'+_fmtNum(p['周销量']||p.weekly_sales)+'</td><td>'+(p['价格']||p.price?'$'+Number(p['价格']||p.price).toFixed(2):'—')+'</td><td>'+(p['星级']||p.rating?Number(p['星级']||p.rating).toFixed(1)+'★':'—')+'</td><td>'+_fmtNum(p['评论数量']||p['总评论数']||p.reviews)+'</td><td>'+escHtml(p['卖家']||p['店铺']||p.shop||'—')+'</td><td><button onclick="tkExpandProduct(\''+escHtml(pid)+'\','+i+')" id="tkBtn_'+i+'" style="font-size:.6rem;padding:2px 8px;">▶ 展开</button></td></tr>';
    html += '<tr id="tkDetailRow_'+i+'" style="display:none;"><td colspan="9"><div id="tkDetailContent_'+i+'" style="padding:8px;background:var(--bg2);border-radius:4px"></div></td></tr>';
  }
  html += '</tbody></table></div>';
  area.innerHTML = html;
}

var TK_DETAIL_CACHE = {};
async function tkExpandProduct(productId, rowIdx) {
  var detailRow = document.getElementById('tkDetailRow_'+rowIdx);
  var btn = document.getElementById('tkBtn_'+rowIdx);
  var content = document.getElementById('tkDetailContent_'+rowIdx);
  if (!detailRow || !btn || !content) return;
  if (detailRow.style.display !== 'none') { detailRow.style.display='none'; btn.textContent='▶ 展开'; return; }
  detailRow.style.display = ''; btn.textContent = '▼ 收起';
  if (TK_DETAIL_CACHE[productId]) { content.innerHTML = TK_DETAIL_CACHE[productId]; return; }
  content.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div>';
  var site = document.getElementById('tkSite').value;
  try {
    var r = await fetch('/api/tiktok-detail?site='+encodeURIComponent(site)+'&productId='+encodeURIComponent(productId));
    var d = await r.json();
    if (d.error) { content.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">'+escHtml(d.error)+'</div>'; return; }
    window['_tkDetail_'+productId] = d;  // Save for pagination refresh
    var h = '';
    // Product detail
    var pd = d.product_detail || {};
    h += '<div class="mkt-card" style="margin-bottom:6px"><div class="mkt-card-head">📊 产品详情</div><div class="mkt-col-grid">';
    h += _metric('价格', pd['价格']||pd.price?'$'+Number(pd['价格']||pd.price).toFixed(2):'—');
    h += _metric('周销量', _fmtNum(pd['周销量']||pd.weekly_sales));
    h += _metric('累计销量', _fmtNum(pd['累计销量']||pd.total_sales));
    h += _metric('品牌', escHtml(pd['品牌']||pd.brand||'—'));
    h += _metric('评分', pd['星级']||pd.rating?Number(pd['星级']||pd.rating).toFixed(1)+'★':'—');
    h += _metric('总评论数', _fmtNum(pd['评论数']||pd['总评论数']||pd.reviews));
    h += '</div></div>';
    // Videos
    var videos = d.product_videos || [];
    if (videos.length) {
      h += '<div class="mkt-card" style="margin-bottom:6px"><div class="mkt-card-head">🎬 带货视频 · ' + videos.length + ' 条</div>';
      h += '<div class="mkt-filter-table"><table><tr><th>#</th><th>发布时间</th><th>标题</th><th>标签</th><th>点赞</th><th>播放</th><th>作者</th><th>链接</th></tr>';
      for (var vi=0;vi<Math.min(videos.length,10);vi++){var v=videos[vi];h+='<tr><td>'+(vi+1)+'</td><td>'+escHtml(v['视频发布时间']||v.publish_time||'—')+'</td><td>'+(v.url?'<a href="'+escHtml(v.url)+'" target="_blank" style="color:var(--accent);text-decoration:none" title="打开 TikTok 视频">'+escHtml((v['标题']||v.title||'').substring(0,30))+'</a>':escHtml((v['标题']||v.title||'').substring(0,30)))+'</td><td>'+escHtml((v['标签']||v.tags||'').substring(0,30))+'</td><td>'+_fmtNum(v['获赞量']||v['点赞数']||v.likes)+'</td><td>'+_fmtNum(v['播放量'])+'</td><td>'+escHtml(v['达人']||v['作者']||v.author||'—')+'</td><td>'+(v.url?'<a href="'+escHtml(v.url)+'" target="_blank" style="color:var(--accent);font-size:.6rem">▶ 观看</a>':'—')+'</td></tr>';}
      h += '</table></div></div>';
    } else { h += '<div class="mkt-empty-card">暂无带货视频</div>'; }
    // Authors
    var va = d.video_authors || {};
    var authors = va['达人清单'] || va['作者清单'] || va.author_list || [];
    var totalAuthors = va['带货达人数'] || va['总作者数'] || va.total_authors || authors.length;
    var authorPageVar = 'tkAuthPg_' + productId.replace(/[^a-zA-Z0-9]/g,'_');
    var authorDataVar = 'tkAuthData_' + productId.replace(/[^a-zA-Z0-9]/g,'_');
    // Store all authors + pd for export
    window[authorDataVar] = {authors: authors, pd: pd, productId: productId};
    var authorPg = parseInt(window[authorPageVar]) || 1;
    var authorPageSize = 20;
    var authorTotalPages = Math.ceil(authors.length / authorPageSize);
    if (authorPg > authorTotalPages) authorPg = authorTotalPages;
    if (authorPg < 1) authorPg = 1;
    window[authorPageVar] = authorPg;
    var authorSlice = authors.slice((authorPg-1)*authorPageSize, authorPg*authorPageSize);
    h += '<div class="mkt-card" style="margin-bottom:6px"><div class="mkt-card-head">👥 带货达人 · ' + _fmtNum(totalAuthors) + ' 人';
    h += ' <button onclick="tkExportAuthors(\''+escHtml(authorDataVar)+'\')" style="font-size:.6rem;padding:2px 10px;margin-left:8px;background:var(--green);color:#fff;border:none;border-radius:4px;cursor:pointer">📥 导出</button>';
    h += '</div>';
    if (authors.length) {
      h += '<div class="mkt-filter-table" style="margin-top:6px"><table><tr><th>#</th><th>作者</th><th>粉丝</th><th>点赞</th><th>带货视频</th><th>总视频</th></tr>';
      for (var ai=0;ai<authorSlice.length;ai++){var a=authorSlice[ai];var idx=(authorPg-1)*authorPageSize+ai+1;h+='<tr><td>'+idx+'</td><td>'+(a['达人主页URL']||a['作者主页URL']?'<a href="'+escHtml(a['达人主页URL']||a['作者主页URL'])+'" target="_blank" style="color:var(--accent);text-decoration:none" title="打开作者主页">'+escHtml(a['达人名称']||a['作者名称']||a.author_name||'—')+'</a>':escHtml(a['达人名称']||a['作者名称']||a.author_name||'—'))+'</td><td>'+_fmtNum(a['粉丝数']||a.fans)+'</td><td>'+_fmtNum(a['获赞数']||a['点赞数']||a.likes)+'</td><td>'+_fmtNum(a['带货视频数']||a.product_videos)+'</td><td>'+_fmtNum(a['发布视频数']||a['总视频数']||a.total_videos)+'</td></tr>';}
      h += '</table></div>';
      // Page nav
      if (authorTotalPages > 1) {
        h += '<div style="text-align:center;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:.7rem">';
        h += '<button onclick="var p=parseInt(window.'+authorPageVar+')||1;window.'+authorPageVar+'=Math.max(1,p-1);tkRefreshAuthors(\''+escHtml(productId)+'\',\''+escHtml(authorDataVar)+'\')" style="font-size:.6rem;padding:2px 8px;cursor:pointer" '+(authorPg<=1?'disabled':'')+'>◀ 上一页</button>';
        h += '<span>第 '+authorPg+' / '+authorTotalPages+' 页</span>';
        h += '<button onclick="var p=parseInt(window.'+authorPageVar+')||1;window.'+authorPageVar+'=Math.min('+authorTotalPages+',p+1);tkRefreshAuthors(\''+escHtml(productId)+'\',\''+escHtml(authorDataVar)+'\')" style="font-size:.6rem;padding:2px 8px;cursor:pointer" '+(authorPg>=authorTotalPages?'disabled':'')+'>下一页 ▶</button>';
        h += '</div>';
      }
    } else { h += '<div class="mkt-empty-card">暂无带货达人</div>'; }
    h += '</div>';
    // Trend
    var pt = d.product_trend || {};
    h += '<div class="mkt-card"><div class="mkt-card-head">📈 产品趋势</div>';
    var trends = [{key:'产品销量趋势',label:'销量'},{key:'产品价格趋势',label:'价格'},{key:'星级趋势',label:'评分'},{key:'总评论数趋势',label:'评论数'},{key:'总带货视频数',label:'带货视频数'},{key:'总作者数趋势',label:'作者数'}];
    for (var ti=0;ti<trends.length;ti++){var t=trends[ti];var arr=pt[t.key]||[];if(!arr.length)continue;h+='<div style="margin-top:4px"><strong style="font-size:.7rem">'+t.label+'</strong> <span style="font-size:.65rem;color:var(--muted)">'+arr.slice(-8).map(function(x){return escHtml(String(x))}).join(' → ')+'</span></div>';}
    h += '</div>';
    TK_DETAIL_CACHE[productId] = h;
    content.innerHTML = h;
  } catch(e) {
    content.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">加载失败：'+escHtml(e.message)+'</div>';
  }
}

function tkRefreshAuthors(productId, dataVar) {
  var data = window[dataVar];
  if (!data) return;
  var authors = data.authors || [];
  var pageSize = 20;
  var totalPages = Math.ceil(authors.length / pageSize);
  var pageVar = 'tkAuthPg_' + productId.replace(/[^a-zA-Z0-9]/g,'_');
  var pg = parseInt(window[pageVar]) || 1;
  if (pg > totalPages) pg = totalPages;
  if (pg < 1) pg = 1;
  window[pageVar] = pg;
  var slice = authors.slice((pg-1)*pageSize, pg*pageSize);

  // Find the visible expanded detail content
  var content = null;
  var allContents = document.querySelectorAll('[id^="tkDetailContent_"]');
  for (var i=0;i<allContents.length;i++) {
    if (allContents[i].style.display !== 'none' && allContents[i].offsetParent !== null) {
      // Check if this content belongs to our product
      if (allContents[i].innerHTML.indexOf(productId) >= 0 || allContents[i].querySelector('.mkt-card-head')) {
        content = allContents[i];
        break;
      }
    }
  }
  // Fallback: find by checking which row is expanded
  if (!content) {
    for (var i=0;i<100;i++) {
      var dr = document.getElementById('tkDetailRow_'+i);
      if (dr && dr.style.display !== 'none') {
        content = document.getElementById('tkDetailContent_'+i);
        if (content) break;
      }
    }
  }
  if (!content) return;

  // Find the author card within the content
  var cards = content.querySelectorAll('.mkt-card');
  var authorCard = null;
  for (var ci=0;ci<cards.length;ci++) {
    var head = cards[ci].querySelector('.mkt-card-head');
    if (head && head.textContent.indexOf('带货达人') !== -1) {
      authorCard = cards[ci];
      break;
    }
  }
  if (!authorCard) return;

  // Remove existing table + pagination (everything after card-head)
  var head = authorCard.querySelector('.mkt-card-head');
  while (head.nextElementSibling) {
    head.nextElementSibling.remove();
  }

  // Build new table
  var h = '';
  if (slice.length) {
    h += '<div class="mkt-filter-table" style="margin-top:6px"><table><tr><th>#</th><th>作者</th><th>粉丝</th><th>点赞</th><th>带货视频</th><th>总视频</th></tr>';
    for (var ai=0;ai<slice.length;ai++){var a=slice[ai];var idx=(pg-1)*pageSize+ai+1;h+='<tr><td>'+idx+'</td><td>'+(a['达人主页URL']||a['作者主页URL']?'<a href="'+escHtml(a['达人主页URL']||a['作者主页URL'])+'" target="_blank" style="color:var(--accent);text-decoration:none" title="打开作者主页">'+escHtml(a['达人名称']||a['作者名称']||a.author_name||'—')+'</a>':escHtml(a['达人名称']||a['作者名称']||a.author_name||'—'))+'</td><td>'+_fmtNum(a['粉丝数']||a.fans)+'</td><td>'+_fmtNum(a['获赞数']||a['点赞数']||a.likes)+'</td><td>'+_fmtNum(a['带货视频数']||a.product_videos)+'</td><td>'+_fmtNum(a['发布视频数']||a['总视频数']||a.total_videos)+'</td></tr>';}
    h += '</table></div>';
    if (totalPages > 1) {
      h += '<div style="text-align:center;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:6px;font-size:.7rem">';
      h += '<button onclick="var p=parseInt(window.'+pageVar+')||1;window.'+pageVar+'=Math.max(1,p-1);tkRefreshAuthors(\''+escHtml(productId)+'\',\''+escHtml(dataVar)+'\')" style="font-size:.6rem;padding:2px 8px;cursor:pointer" '+(pg<=1?'disabled':'')+'>◀ 上一页</button>';
      h += '<span>第 '+pg+' / '+totalPages+' 页</span>';
      h += '<button onclick="var p=parseInt(window.'+pageVar+')||1;window.'+pageVar+'=Math.min('+totalPages+',p+1);tkRefreshAuthors(\''+escHtml(productId)+'\',\''+escHtml(dataVar)+'\')" style="font-size:.6rem;padding:2px 8px;cursor:pointer" '+(pg>=totalPages?'disabled':'')+'>下一页 ▶</button>';
      h += '</div>';
    }
  } else {
    h += '<div class="mkt-empty-card">暂无带货达人</div>';
  }
  var tmp = document.createElement('div');
  tmp.innerHTML = h;
  while (tmp.firstChild) { authorCard.appendChild(tmp.firstChild); }
}

function tkExportAuthors(dataVar) {
  var data = window[dataVar];
  if (!data) { showToast('数据已过期，请重新展开产品'); return; }
  var authors = data.authors || [];
  var pd = data.pd || {};
  if (!authors.length) { showToast('无带货达人数据'); return; }

  // Build CSV rows
  var rows = [];
  // Product info header
  var title = pd['标题'] || pd.title || '';
  var price = pd['价格'] || pd.price || '';
  var brand = pd['品牌'] || pd.brand || '';
  var weekly = pd['周销量'] || pd.weekly_sales || '';
  var totalSales = pd['累计销量'] || pd.total_sales || '';
  var rating = pd['星级'] || pd.rating || '';
  var reviews = pd['评论数'] || pd['总评论数'] || pd.reviews || '';

  rows.push(['=== 产品信息 ===']);
  rows.push(['标题', title]);
  rows.push(['品牌', brand]);
  rows.push(['价格', price]);
  rows.push(['周销量', weekly]);
  rows.push(['累计销量', totalSales]);
  rows.push(['评分', rating]);
  rows.push(['评论数', reviews]);
  rows.push(['带货达人总数', authors.length]);
  rows.push([]);
  rows.push(['序号','作者名称','粉丝数','获赞数','带货视频数','发布视频数','主页URL']);

  for (var i=0;i<authors.length;i++) {
    var a = authors[i];
    rows.push([
      i+1,
      a['达人名称'] || a['作者名称'] || a.author_name || '',
      a['粉丝数'] || a.fans || 0,
      a['获赞数'] || a['点赞数'] || a.likes || 0,
      a['带货视频数'] || a.product_videos || 0,
      a['发布视频数'] || a['总视频数'] || a.total_videos || 0,
      a['达人主页URL'] || a['作者主页URL'] || ''
    ]);
  }

  // CSV encode
  var csv = '﻿'; // BOM for Excel
  for (var ri=0;ri<rows.length;ri++) {
    csv += rows[ri].map(function(c){var s=String(c);return s.indexOf(',')>=0||s.indexOf('"')>=0||s.indexOf('\n')>=0?'"'+s.replace(/"/g,'""')+'"':s;}).join(',') + '\n';
  }

  var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var safeTitle = (title || 'tiktok_authors').substring(0,40).replace(/[\\/:*?\"<>|]/g,'_');
  a.download = safeTitle + '_authors.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('已导出 ' + authors.length + ' 条达人数据');
}

async function tkSearchCategory() {
  var site = document.getElementById('tkCatSite').value;
  var searchName = document.getElementById('tkCatSearchName').value.trim();
  if (!site) { showToast('请选择站点'); return; }
  if (!searchName) { showToast('请输入类目搜索词'); return; }
  var area = document.getElementById('tkCategoryResult');
  area.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div>';
  try {
    var r = await fetch('/api/tiktok-category?site='+encodeURIComponent(site)+'&searchName='+encodeURIComponent(searchName));
    var d = await r.json();
    if (d.error) { area.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">'+escHtml(d.error)+'</div>'; return; }
    var items = d.categories || [];
    if (!items.length) { area.innerHTML = '<div class="mkt-empty-card">未找到匹配类目</div>'; return; }
    var html = '<div class="mkt-section-title">类目查询结果</div>';
    html += '<div class="mkt-filter-table"><table><tr><th>类目名称</th><th>类目节点ID</th><th>操作</th></tr>';
    for (var i=0;i<items.length;i++){var c=items[i];html+='<tr><td>'+escHtml(c['类目名称']||c.category_name||'—')+'</td><td>'+escHtml(c.nodeId||'—')+'</td><td><button onclick="document.getElementById(\'tkNodeId\').value=\''+escHtml(c.nodeId||'')+'\';document.getElementById(\'tkCatRptSite\').value=\''+escHtml(site)+'\'" style="font-size:.6rem;padding:2px 8px;">填入报告</button></td></tr>';}
    html += '</table></div>';
    area.innerHTML = html;
  } catch(e) { area.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">'+escHtml(e.message)+'</div>'; }
}

async function tkLoadCategoryReport() {
  var site = document.getElementById('tkCatRptSite').value;
  var nodeId = document.getElementById('tkNodeId').value.trim();
  if (!site) { showToast('请选择站点'); return; }
  if (!nodeId) { showToast('请输入类目节点ID'); return; }
  var area = document.getElementById('tkCategoryReport');
  area.innerHTML = '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div></div>';
  try {
    var r = await fetch('/api/tiktok-category-report?site='+encodeURIComponent(site)+'&nodeId='+encodeURIComponent(nodeId));
    var d = await r.json();
    if (d.error) { area.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">'+escHtml(d.error)+'</div>'; return; }
    var report = d.report || {};
    var html = '<div class="mkt-section-title">类目数据报告</div>';
    html += '<div class="mkt-card"><div class="mkt-card-head">'+escHtml(report['类目名称']||report.category_name||nodeId)+'</div>';
    html += '<div class="mkt-col-grid">';
    var keys = Object.keys(report);
    for (var i=0;i<keys.length;i++){var k=keys[i],v=report[k];if(k==='类目名称')continue;if(typeof v==='number')html+=_metric(k,_fmtNum(v));else if(typeof v==='string')html+=_metric(k,escHtml(v));}
    html += '</div></div>';
    area.innerHTML = html;
  } catch(e) { area.innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">'+escHtml(e.message)+'</div>'; }
}
