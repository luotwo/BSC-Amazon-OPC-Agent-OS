
// ═══════════════════════════════════════════════════════════════
// Supply Chain Analysis (1688 Sourcing)
// ═══════════════════════════════════════════════════════════════
function updateSupplyChainSourceBadges(cfg) {
  cfg = cfg || {};
  function setBadge(id, label, enabled, hasCreds) {
    var el = document.getElementById(id); if (!el) return;
    var cls = enabled && hasCreds ? 'mkt-src-on' : enabled ? 'mkt-src-incomplete' : 'mkt-src-off';
    var icon = enabled && hasCreds ? '✅' : enabled ? '⚠️' : '⛔';
    el.textContent = icon + ' ' + label + '：' + (enabled ? (hasCreds ? '已开启' : '缺Key') : '未开启');
    el.className = 'mkt-src-tag ' + cls;
  }
  var st = cfg.sorftime_mcp || {};
  setBadge('scSrcSt', 'Sorftime MCP', st.enabled, !!(st.endpoint && st.api_key));
}

async function getSupplyChainSettings() {
  try {
    var r = await fetch('/api/settings'); if (!r.ok) return;
    updateSupplyChainSourceBadges(await r.json());
  } catch(e) {}
}

// XOR: ASIN 和产品名互斥
function scOnAsinInput() {
  var v = document.getElementById('scAsin').value.trim();
  if (v) document.getElementById('scProductName').value = '';
}
function scOnProductInput() {
  var v = document.getElementById('scProductName').value.trim();
  if (v) document.getElementById('scAsin').value = '';
}

async function startSupplyChainAnalysis() {
  var asin = document.getElementById('scAsin').value.trim();
  var productName = document.getElementById('scProductName').value.trim();
  var marketplace = document.getElementById('scMarketplace').value;
  if (!productName && !marketplace) { showToast('请选择站点'); return; }
  if (!asin && !productName) { showToast('请输入 ASIN 或中文产品名称'); return; }
  if (asin && !/^[A-Za-z0-9]{5,15}$/.test(asin)) { showToast('ASIN 格式错误（5-15 位字母数字）'); return; }

  try { await getSupplyChainSettings(); } catch(e) {}
  showToast('正在搜索 1688 货源，预计 10-20 秒，请耐心等待…', 'info');
  var btn = document.querySelector('#mainTabSupplyChain .btn-mkt-start');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 分析中...'; }
  var loadingMsg = productName ? '正在用产品名直接搜索 1688...' : '正在翻译产品标题 → Sorftime 1688 货源搜索...';
  document.getElementById('scResults').innerHTML =
    '<div class="mkt-loading"><div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>' +
    '<div style="margin-top:10px">' + loadingMsg + '</div></div>';

  var jobId = 'sc' + Date.now().toString(36) + Math.random().toString(36).substr(2,6);
  var qs = '?asin=' + encodeURIComponent(asin) + '&product_name=' + encodeURIComponent(productName) + '&marketplace=' + encodeURIComponent(marketplace);

  fetch('/api/supply-chain/' + jobId + qs)
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (btn) { btn.disabled = false; btn.textContent = '🔍 开始分析'; }
      if (data.error) { document.getElementById('scResults').innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">' + escHtml(data.error) + '</div>'; return; }
      renderSupplyChainResults(data);
    })
    .catch(function(err){
      if (btn) { btn.disabled = false; btn.textContent = '🔍 开始分析'; }
      document.getElementById('scResults').innerHTML = '<div class="mkt-empty-card" style="color:var(--red)">请求失败：' + escHtml(err.message) + '</div>';
    });
}

function renderSupplyChainResults(data) {
  var items = (data.data && data.data.items) ? data.data.items : (data.items || []);
  if (!items.length) {
    document.getElementById('scResults').innerHTML = '<div class="mkt-empty-card">Sorftime 1688 未返回数据</div>';
    return;
  }
  var searchTerm = data.search_term || '';
  var rows = items.slice(0,10).map(function(it, i){
    var title = it.title || it['标题'] || it['商品标题'] || '';
    var price = it.unit_price != null ? it.unit_price : (it['价格'] || it['单价']);
    var supplier = it.supplier || it['卖家'] || it['供应商'] || it['店铺'] || '';
    var offerUrl = it.offer_url || it['URL'] || '';
    var imgUrl = it.image_url || it['主图'] || '';
    var imgHtml = imgUrl
      ? '<img src="' + escHtml(imgUrl) + '" style="width:60px;height:60px;object-fit:contain;border-radius:4px;background:var(--bg)" onerror="this.style.display=\'none\'">'
      : '—';
    var titleHtml = offerUrl
      ? '<a href="' + escHtml(offerUrl) + '" target="_blank" rel="noopener" style="color:var(--accent);text-decoration:none">' + escHtml(title) + '</a>'
      : escHtml(title);
    var supplierHtml = (supplier && offerUrl)
      ? '<a href="' + escHtml(offerUrl) + '" target="_blank" rel="noopener" style="color:var(--text);text-decoration:none">' + escHtml(supplier) + '</a>'
      : escHtml(supplier || '—');
    return '<tr><td>' + (i+1) + '</td>' +
      '<td>' + imgHtml + '</td>' +
      '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + titleHtml + '</td>' +
      '<td>' + (price != null ? '¥' + Number(price).toFixed(2) : '—') + '</td>' +
      '<td>' + supplierHtml + '</td></tr>';
  }).join('');

  var html = '<div class="mkt-section-title">1688 货源搜索结果 <span class="mkt-src-pill mkt-pill-st">Sorftime</span></div>';
  if (searchTerm) html += '<div style="font-size:.65rem;color:var(--muted);margin-bottom:6px">搜索词: ' + escHtml(searchTerm) + '</div>';
  html += '<div class="mkt-filter-table"><table>' +
    '<tr><th>#</th><th>主图</th><th>商品标题</th><th>单价</th><th>供应商</th></tr>' +
    rows + '</table></div>' +
    '<div style="margin-top:10px;font-size:.7rem;color:var(--muted)">★ 共 ' + items.length + ' 个结果</div>';
  document.getElementById('scResults').innerHTML = html;
}
