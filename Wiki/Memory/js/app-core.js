// ── License Status ──
async function loadLicenseStatus() {
  try {
    var res = await fetch('/api/license-status');
    var data = await res.json();
    var badge = document.getElementById('licenseBadge');
    var btn = document.getElementById('btnActivate');
    if (data.status === 'active') {
      badge.textContent = data.message;
      badge.style.background = 'rgba(34,197,94,.15)';
      badge.style.color = 'var(--green)';
      btn.style.display = 'inline-block';
      btn.textContent = '更换授权';
      updateTabVisibility(data.allowed_tabs || []);
      checkFirstRunSetup();
    } else if (data.status === 'trial') {
      badge.textContent = data.message;
      badge.style.background = 'rgba(245,158,11,.15)';
      badge.style.color = 'var(--accent2)';
      btn.style.display = 'inline-block';
      btn.textContent = '激活';
      updateTabVisibility(data.allowed_tabs || []);
      checkFirstRunSetup();
    } else if (data.status === 'expired') {
      badge.textContent = data.message;
      badge.style.background = 'rgba(239,68,68,.15)';
      badge.style.color = 'var(--red)';
      btn.style.display = 'inline-block';
      btn.textContent = '激活';
      updateTabVisibility([]);
    } else if (data.status === 'none') {
      badge.textContent = '未激活 · 可试用7天';
      badge.style.background = 'var(--bg3)';
      badge.style.color = 'var(--muted)';
      btn.style.display = 'inline-block';
      btn.textContent = '激活';
      updateTabVisibility([]);
      setTimeout(function(){ openActivationDialog(); }, 500);
    } else {
      badge.textContent = data.message || '未激活';
      badge.style.background = 'var(--bg3)';
      badge.style.color = 'var(--muted)';
      btn.style.display = 'inline-block';
      btn.textContent = '激活';
      updateTabVisibility([]);
    }
  } catch(e) {}
}
// ── Version Check ──
var CURRENT_VERSION = 'v3.0';
var GITHUB_REPO = 'luotwo/BSC-Amazon-OPC-Agent-OS';
var _otaDownloadUrl = '';
var _otaAssetSize = 0;
async function checkUpdate() {
  try {
    var res = await fetch('https://api.github.com/repos/'+GITHUB_REPO+'/releases/latest');
    if (res.status === 404) {
      document.getElementById('verUpToDate').style.display = 'inline';
      return;
    }
    if (!res.ok) return;
    var data = await res.json();
    var latest = data.tag_name || '';
    if (!latest) { document.getElementById('verUpToDate').style.display='inline'; return; }
    var cur = CURRENT_VERSION.replace(/^v/,'');
    var lat = latest.replace(/^v/,'');
    document.getElementById('verUpToDate').style.display = 'inline';
    var btn = document.getElementById('btnUpdate');
    document.getElementById('latestVer').textContent = latest;
    // Find .zip asset download URL
    var assets = data.assets || [];
    var zipAsset = null;
    for (var a=0;a<assets.length;a++) {
      if (assets[a].name && assets[a].name.toLowerCase().endsWith('.zip')) { zipAsset = assets[a]; break; }
    }
    if (zipAsset) {
      _otaDownloadUrl = zipAsset.browser_download_url;
      _otaAssetSize = zipAsset.size || 0;
    } else {
      _otaDownloadUrl = data.zipball_url || '';
      _otaAssetSize = 0;
    }
    btn.href = '#';
    btn.onclick = function(e){ e.preventDefault(); startOTA(); };
    btn.style.display = 'inline-block';
  } catch(e) { document.getElementById('verUpToDate').style.display = 'inline'; }
}

async function startOTA() {
  if (!_otaDownloadUrl) { alert('未找到下载链接'); return; }
  if (!confirm('是否升级到最新版本？\n\n升级将自动下载、安装并重启程序。\n用户配置和激活状态将被保留。\n\n点击「确定」开始升级。')) return;
  var btn = document.getElementById('btnUpdate');
  btn.textContent = '⏳ 下载中...';
  btn.disabled = true;
  btn.style.opacity = '0.6';
  try {
    var res = await fetch('/api/ota-upgrade', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({download_url:_otaDownloadUrl, size:_otaAssetSize})
    });
    var data = await res.json();
    if (data.error) { alert('升级失败: '+data.error); btn.textContent='🆕 重试升级'; btn.disabled=false; btn.style.opacity='1'; return; }
    // Updating — show message and close soon
    btn.textContent = '✅ 升级已启动';
    setTimeout(function(){ document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:1.2rem;color:var(--accent);">🔄 升级中... 程序将自动重启</div>'; }, 1500);
  } catch(e) {
    alert('升级请求失败: '+e.message);
    btn.textContent = '🆕 重试升级';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}
function openActivationDialog() {
  document.getElementById('activateModal').classList.add('open');
  document.getElementById('activateMid').textContent = '加载中...';
  document.getElementById('activateStatus').textContent = '';
  document.getElementById('activateKeyInput').value = '';
  fetch('/api/license-status').then(function(r){return r.json();}).then(function(d){
    document.getElementById('activateMid').textContent = d.mid || 'Unknown';
  }).catch(function(){
    document.getElementById('activateMid').textContent = '获取失败';
  });
}
function closeActivateModal() { document.getElementById('activateModal').classList.remove('open'); }
function copyMachineId() {
  var mid = document.getElementById('activateMid').textContent;
  navigator.clipboard.writeText(mid).then(function(){showToast('机器码已复制','success');});
}
async function startTrialFromModal() {
  var btn = document.getElementById('btnStartTrial');
  btn.disabled = true; btn.textContent = '正在激活试用...';
  try {
    var res = await fetch('/api/trial-start', {method:'POST'});
    var data = await res.json();
    if (data.status === 'ok') {
      showToast(data.message, 'success');
      setTimeout(function(){ closeActivateModal(); loadLicenseStatus(); }, 800);
    } else {
      showToast(data.message||'失败', 'error');
      btn.disabled = false; btn.textContent = '开始免费试用';
    }
  } catch(e) {
    showToast('请求失败', 'error');
    btn.disabled = false; btn.textContent = '开始免费试用';
  }
}
// First-run: check required settings
async function checkFirstRunSetup() {
  try {
    var res = await fetch('/api/settings');
    var cfg = await res.json();
    // Initialize image gen toggle states from config (fix: model name in toast)
    var gm = cfg.gemini || {};
    var am = cfg.apimart || {};
    document.getElementById('tglGemini').checked = !!gm.enabled;
    document.getElementById('lblGemini').textContent = gm.enabled ? '开启' : '关闭';
    document.getElementById('tglApimart').checked = am.enabled !== false;
    document.getElementById('lblApimart').textContent = (am.enabled !== false) ? '开启' : '关闭';
    var missing = [];
    // Redacted values (containing ***) mean it IS configured — just hidden for security
    var hasApimart = cfg.apimart && cfg.apimart.api_key && cfg.apimart.api_key.length > 0;
    var hasGemini = cfg.gemini && cfg.gemini.api_key && cfg.gemini.api_key.length > 0;
    var hasSif = cfg.sif_mcp && cfg.sif_mcp.endpoint && cfg.sif_mcp.endpoint.length > 0;
    var hasSorftime = cfg.sorftime_mcp && cfg.sorftime_mcp.endpoint && cfg.sorftime_mcp.endpoint.length > 0;
    var hasSellersprite = cfg.sellersprite_mcp && cfg.sellersprite_mcp.endpoint && cfg.sellersprite_mcp.endpoint.length > 0;
    if (!hasApimart && !hasGemini) missing.push('图生图 API Key (GPT-Image-2 或 Gemini)');
    if (!hasSif) missing.push('SIF MCP Endpoint');
    if (!hasSorftime && !hasSellersprite) missing.push('Sorftime 或 卖家精灵 MCP（二选一）');
    if (missing.length > 0) {
      showToast('请先完成系统初始化配置: ' + missing.join(', '), 'error');
      setTimeout(function(){ openInitGuide(); }, 1500);
    }
  } catch(e) {}
}
function submitActivation() {
  var key = document.getElementById('activateKeyInput').value.trim();
  var statusEl = document.getElementById('activateStatus');
  if (!key) { statusEl.textContent = '请输入激活密钥'; statusEl.style.color = 'var(--red)'; return; }
  statusEl.textContent = '验证中...'; statusEl.style.color = 'var(--accent2)';
  fetch('/api/activate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({key:key})})
    .then(function(r){return r.json();})
    .then(function(d){
      if (d.status === 'ok') {
        statusEl.textContent = '激活成功！到期: ' + d.exp_date + ' · 剩余: ' + d.days_left + ' 天';
        statusEl.style.color = 'var(--green)';
        if (d.allowed_tabs && d.allowed_tabs.length > 0) {
          var infoEl = document.getElementById('activateTabsInfo');
          var labels = d.tab_labels || {};
          var names = d.allowed_tabs.map(function(t){return labels[t] || t;});
          if (infoEl) { infoEl.style.display = 'block'; infoEl.textContent = '已授权模块: ' + names.join(' · '); }
          updateTabVisibility(d.allowed_tabs);
        }
        setTimeout(function(){ closeActivateModal(); loadLicenseStatus(); }, 1500);
      } else {
        statusEl.textContent = d.message || '激活失败';
        statusEl.style.color = 'var(--red)';
      }
    })
    .catch(function(e){ statusEl.textContent = '请求失败: ' + e.message; statusEl.style.color = 'var(--red)'; });
}
loadLicenseStatus();
checkUpdate();

// ── API Test ──
async function testApi(service) {
  var statusEl = document.getElementById('status'+service.charAt(0).toUpperCase()+service.slice(1));
  var btnEl = document.getElementById('btnTest'+service.charAt(0).toUpperCase()+service.slice(1));
  statusEl.textContent = '⏳ 检测中...'; statusEl.style.color = 'var(--accent2)';
  btnEl.disabled = true;
  // Collect current field values for testing (even if unsaved)
  var body = {};
  if (service === 'apimart') {
    body.apimart = {api_key: document.getElementById('cfgApimartKey').value, base_url: document.getElementById('cfgApimartUrl').value};
  } else if (service === 'gemini') {
    body.gemini = {api_key: document.getElementById('cfgGeminiKey').value, base_url: document.getElementById('cfgGeminiUrl').value};
  } else if (service === 'sif') {
    body.sif_mcp = {endpoint: document.getElementById('cfgSifEndpoint').value, api_key: document.getElementById('cfgSifKey').value, enabled: true};
  } else if (service === 'sorftime') {
    body.sorftime_mcp = {endpoint: document.getElementById('cfgSorftimeEndpoint').value, api_key: document.getElementById('cfgSorftimeKey').value, enabled: true};
  } else if (service === 'sellersprite') {
    body.sellersprite_mcp = {endpoint: document.getElementById('cfgSellerspriteEndpoint').value, api_key: document.getElementById('cfgSellerspriteKey').value, enabled: true};
  }
  try {
    var res = await fetch('/api/test-connection/'+service, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    var data = await res.json();
    if (data.status === 'ok') {
      statusEl.textContent = '✅ ' + data.message; statusEl.style.color = 'var(--green)';
    } else {
      statusEl.textContent = '❌ ' + (data.message||'Failed'); statusEl.style.color = 'var(--red)';
    }
  } catch(e) {
    statusEl.textContent = '❌ ' + e.message; statusEl.style.color = 'var(--red)';
  }
  btnEl.disabled = false;
}

// ── MCP Toggle (独立开关，不互斥) ──
function onMcpToggle(which) {
  var tgl = document.getElementById(which === 'sellersprite' ? 'tglSellersprite' : 'tglSorftime');
  var lbl = document.getElementById(which === 'sellersprite' ? 'lblSellersprite' : 'lblSorftime');
  lbl.textContent = tgl.checked ? '开启' : '关闭';
}

function onImgGenToggle(which) {
  var tglApt = document.getElementById('tglApimart');
  var tglGem = document.getElementById('tglGemini');
  var lblApt = document.getElementById('lblApimart');
  var lblGem = document.getElementById('lblGemini');
  if (which === 'apimart') {
    if (tglApt.checked) {
      tglGem.checked = false; lblGem.textContent = '关闭'; lblApt.textContent = '开启';
    } else {
      // 不允许两个同时关闭，自动开启另一个
      if (!tglGem.checked) { tglGem.checked = true; lblGem.textContent = '开启'; }
      lblApt.textContent = '关闭';
    }
  } else {
    if (tglGem.checked) {
      tglApt.checked = false; lblApt.textContent = '关闭'; lblGem.textContent = '开启';
    } else {
      // 不允许两个同时关闭，自动开启另一个
      if (!tglApt.checked) { tglApt.checked = true; lblApt.textContent = '开启'; }
      lblGem.textContent = '关闭';
    }
  }
}

// ── Fetch Models ──
async function fetchModels(silent) {
  var sel = document.getElementById('cfgApimartModel');
  var currentVal = sel.value;
  var key = document.getElementById('cfgApimartKey').value;
  var base = document.getElementById('cfgApimartUrl').value;
  if (!silent) sel.innerHTML = '<option>⏳ 获取中...</option>';
  try {
    var res = await fetch('/api/list-models', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({api_key:key, base_url:base})});
    var data = await res.json();
    var models = data.models||[];
    if (models.length > 0) {
      sel.innerHTML = models.map(function(m){return '<option value="'+m+'"'+(m===currentVal?' selected':'')+'>'+m+'</option>';}).join('');
      if (!silent) showToast('已加载 ' + models.length + ' 个模型', 'success');
    } else {
      // Keep current value
      sel.innerHTML = '<option value="'+currentVal+'">'+currentVal+' (API unavailable)</option>';
      if (!silent && data.error) showToast(data.error, 'error');
    }
  } catch(e) {
    sel.innerHTML = '<option value="'+currentVal+'">'+currentVal+'</option>';
    if (!silent) showToast('获取模型列表失败', 'error');
  }
}

function openSettings() {
  document.getElementById('settingsModal').classList.add('open');
  fetch('/api/settings').then(function(r){return r.json();}).then(function(cfg){
    var am = cfg.apimart||{};
    // Show redacted keys so user knows they're configured
    document.getElementById('cfgApimartKey').value = am.api_key||'';
    document.getElementById('cfgApimartUrl').value = am.base_url||'';
    document.getElementById('cfgApimartResolution').value = am.resolution||'1k';
    document.getElementById('cfgApimartQuality').value = am.quality||'high';
    document.getElementById('cfgApimartModel').value = am.model||'gpt-image-2';
    document.getElementById('tglApimart').checked = am.enabled !== false;
    document.getElementById('lblApimart').textContent = am.enabled !== false ? '开启' : '关闭';
    var gm = cfg.gemini||{};
    document.getElementById('cfgGeminiKey').value = gm.api_key||'';
    document.getElementById('cfgGeminiUrl').value = gm.base_url||'https://api.apimart.ai';
    document.getElementById('cfgGeminiModel').value = gm.model||'gemini-3-pro-image-preview';
    document.getElementById('cfgGeminiResolution').value = gm.resolution||'1K';
    document.getElementById('tglGemini').checked = !!gm.enabled;
    document.getElementById('lblGemini').textContent = gm.enabled ? '开启' : '关闭';
    var sf = cfg.sif_mcp||{};
    document.getElementById('cfgSifEndpoint').value = sf.endpoint||'';
    document.getElementById('cfgSifKey').value = sf.api_key||'';
    var st = cfg.sorftime_mcp||{};
    document.getElementById('cfgSorftimeEndpoint').value = st.endpoint||'';
    document.getElementById('cfgSorftimeKey').value = st.api_key||'';
    document.getElementById('tglSorftime').checked = !!st.enabled;
    document.getElementById('lblSorftime').textContent = st.enabled ? '开启' : '关闭';
    var ss = cfg.sellersprite_mcp||{};
    document.getElementById('cfgSellerspriteEndpoint').value = ss.endpoint||'';
    document.getElementById('cfgSellerspriteKey').value = ss.api_key||'';
    document.getElementById('tglSellersprite').checked = !!ss.enabled;
    document.getElementById('lblSellersprite').textContent = ss.enabled ? '开启' : '关闭';
    // Clear test statuses
    document.getElementById('statusApimart').textContent = '';
    document.getElementById('statusSif').textContent = '';
    document.getElementById('statusSorftime').textContent = '';
    document.getElementById('statusSellersprite').textContent = '';
    document.getElementById('statusGemini').textContent = '';
  }).catch(function(){});
}
function closeSettings() { document.getElementById('settingsModal').classList.remove('open'); }
function _saveKey(formValue) {
  // Don't overwrite real key with redacted placeholder
  if (!formValue || formValue.indexOf('***') !== -1) return null;  // null = skip this field
  return formValue;
}
function saveSettings() {
  var sifEndpoint = document.getElementById('cfgSifEndpoint').value.trim();
  var sifKey = document.getElementById('cfgSifKey').value.trim();
  // Only update key if user actually typed a new one (not redacted)
  sifKey = _saveKey(sifKey);
  if (sifKey && sifEndpoint && !sifEndpoint.includes('secret-key=')) {
    sifEndpoint = sifEndpoint + '?secret-key=' + sifKey;
  }
  // Build data object, omitting redacted/unmodified keys
  var data = {
    apimart: {base_url:document.getElementById('cfgApimartUrl').value, model:document.getElementById('cfgApimartModel').value, resolution:document.getElementById('cfgApimartResolution').value, quality:document.getElementById('cfgApimartQuality').value, enabled:!!document.getElementById('tglApimart').checked},
    gemini: {base_url:document.getElementById('cfgGeminiUrl').value, model:document.getElementById('cfgGeminiModel').value, resolution:document.getElementById('cfgGeminiResolution').value, enabled:!!document.getElementById('tglGemini').checked},
    sif_mcp: {endpoint: sifEndpoint, enabled: !!sifEndpoint},
    sorftime_mcp: {endpoint:document.getElementById('cfgSorftimeEndpoint').value, enabled:!!document.getElementById('tglSorftime').checked},
    sellersprite_mcp: {endpoint:document.getElementById('cfgSellerspriteEndpoint').value, enabled:!!document.getElementById('tglSellersprite').checked}
  };
  // Only include keys that user actually changed (not redacted)
  var ak = _saveKey(document.getElementById('cfgApimartKey').value);
  if (ak !== null) data.apimart.api_key = ak;
  var gk = _saveKey(document.getElementById('cfgGeminiKey').value);
  if (gk !== null) data.gemini.api_key = gk;
  if (sifKey !== null) data.sif_mcp.api_key = sifKey;
  var stk = _saveKey(document.getElementById('cfgSorftimeKey').value);
  if (stk !== null) data.sorftime_mcp.api_key = stk;
  var ssk = _saveKey(document.getElementById('cfgSellerspriteKey').value);
  if (ssk !== null) data.sellersprite_mcp.api_key = ssk;
  fetch('/api/settings', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)})
    .then(function(r){
      if (!r.ok) throw new Error('服务器错误 (' + r.status + ')');
      return r.text().then(function(t){
        try { return JSON.parse(t); }
        catch(e) { throw new Error('服务器返回异常，请刷新页面后重试'); }
      });
    })
    .then(function(d){if(d.status==='saved'){closeSettings();showToast('设置已保存','success');}})
    .catch(function(e){alert('保存失败: '+e.message);});
}
document.getElementById('settingsModal').addEventListener('click', function(e){if(e.target===this)closeSettings();});
document.getElementById('activateModal').addEventListener('click', function(e){if(e.target===this)closeActivateModal();});
document.getElementById('initGuideModal').addEventListener('click', function(e){if(e.target===this)closeInitGuide();});
function openInitGuide() { document.getElementById('initGuideModal').classList.add('open'); }
function closeInitGuide() { document.getElementById('initGuideModal').classList.remove('open'); }
function openWechatQr() { document.getElementById('wechatQrModal').classList.add('open'); }
function closeWechatQr() { document.getElementById('wechatQrModal').classList.remove('open'); }
document.getElementById('wechatQrModal').addEventListener('click', function(e){if(e.target===this)closeWechatQr();});
function openZsxqQr() { document.getElementById('zsxqQrModal').classList.add('open'); }
function closeZsxqQr() { document.getElementById('zsxqQrModal').classList.remove('open'); }
document.getElementById('zsxqQrModal').addEventListener('click', function(e){if(e.target===this)closeZsxqQr();});

// ── Clear Cache ──
async function clearAllCache() {
  if (!confirm('确认清除所有历史缓存、生成记录和图片记录？\n\n⚠️ 提示词模板库（prompt_templates/）不会被清除。\n💡 建议先用模板库的「导出」功能备份模板 JSON 文件。\n\n此操作不可恢复，确定继续？')) return;
  var btn = event.target;
  btn.disabled = true; btn.textContent = '⏳ 正在清除...';
  try {
    var res = await fetch('/api/clear-cache', {method:'POST'});
    var data = await res.json();
    if (data.status === 'cleared') {
      showToast('已清除：' + (data.cleared.prompts||0) + ' 缓存 + ' + (data.cleared.input||0) + ' 图片 + ' + (data.cleared.output||0) + ' 输出', 'success');
      // Reset UI
      currentJobId = null; currentAsin = null; selectedPrototype = null; expertData = null; genCount = {};
      document.getElementById('refImageCount').textContent = '0';
      document.getElementById('promptCount').textContent = '0';
      document.getElementById('resultCount').textContent = '0';
      document.getElementById('promptList').innerHTML = '<div class="empty"><div class="icon">💡</div>提示词将在提交后自动生成<br><small>融合 Wiki 知识库 + MCP 商品语义</small></div>';
      document.getElementById('refImageGrid').innerHTML = '<div class="empty"><div class="icon">📷</div>请上传产品图片，或输入 ASIN 后点击「开始采集」<br>点击图片即可设为 GPT Image-2 生成原型</div>';
      document.getElementById('resultGrid').innerHTML = '<div class="empty"><div class="icon">🖼️</div>生成图片将在此展示<br><small>支持 PNG / PSD 格式下载</small></div>';
      document.getElementById('prototypeHint').classList.remove('show');
      document.getElementById('expertBadge').style.display = 'none';
      document.getElementById('expertEmpty').style.display = 'block';
      ['expertTabTitle','expertTabBullets','expertTabQa','expertTabSelling','expertTabInsights'].forEach(function(id){document.getElementById(id).innerHTML='';});
      document.getElementById('asinCategoryInfo').style.display = 'none';
      document.getElementById('mcpWarningBanner').style.display = 'none';
      resetProgress();
      cleanAfterCollect();
    }
  } catch(e) { showToast('清除失败: '+e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = '🗑 清除缓存记录'; }
}

// ── Reset All Data (SQLite + legacy files) ──
async function resetAllData() {
  if (!confirm('⚠️ 重置全部数据\n\n即将清除：\n• 所有分析结果缓存（8 个 Tab × N 个 ASIN）\n• 产品上下文数据库\n• 翻译缓存 + 汇率缓存\n• 操作日志\n• 所有采集图片（input/）\n• 所有生成图片（output/）\n\n保留：\n✓ 提示词模板库\n✓ 应用设置（API Key 等）\n✓ 激活信息\n\n此操作不可恢复，确定继续？')) return;

  try {
    var res1 = await fetch('/api/cache/reset', { method: 'POST' });
    var d1 = await res1.json();

    var res2 = await fetch('/api/clear-cache', { method: 'POST' });
    var d2 = await res2.json();

    // Reset all UI state
    currentJobId = null; currentAsin = null; selectedPrototype = null; expertData = null; genCount = {};
    MKT_STATE = { data: null, loading: false };
    TK_DETAIL_CACHE = {};
    AUDIT_STATE = { data: null, loading: false };
    TA_STATE = { data: null, loading: false };
    document.getElementById('refImageCount').textContent = '0';
    document.getElementById('promptCount').textContent = '0';
    document.getElementById('resultCount').textContent = '0';
    document.getElementById('promptList').innerHTML = '<div class="empty"><div class="icon">💡</div>提示词将在提交后自动生成<br><small>融合 Wiki 知识库 + MCP 商品语义</small></div>';
    document.getElementById('refImageGrid').innerHTML = '<div class="empty"><div class="icon">📷</div>请上传产品图片，或输入 ASIN 后点击「开始采集」<br>点击图片即可设为 GPT Image-2 生成原型</div>';
    document.getElementById('resultGrid').innerHTML = '<div class="empty"><div class="icon">🖼️</div>生成图片将在此展示<br><small>支持 PNG / PSD 格式下载</small></div>';
    document.getElementById('prototypeHint').classList.remove('show');
    document.getElementById('expertBadge').style.display = 'none';
    document.getElementById('expertEmpty').style.display = 'block';
    ['expertTabTitle','expertTabBullets','expertTabQa','expertTabSelling','expertTabInsights'].forEach(function(id){document.getElementById(id).innerHTML='';});
    document.getElementById('asinCategoryInfo').style.display = 'none';
    document.getElementById('mcpWarningBanner').style.display = 'none';
    resetProgress();
    cleanAfterCollect();

    // Clear all analysis tab results
    var tabIds = ['taResults','adTabDashboard','adTabCampaign','adTabKeyword','adTabSearchterm','adTabBidbudget','adTabPlacement','adTabCompete'];
    tabIds.forEach(function(id){ var el = document.getElementById(id); if (el) el.innerHTML = ''; });
    var auditPanels = ['auditTabOverview','auditTabTitle','auditTabBullets','auditTabImages','auditTabAplus','auditTabReviews','auditTabKeywords','auditTabCategory','auditTabPricing'];
    auditPanels.forEach(function(id){ var el = document.getElementById(id); if (el) el.innerHTML = ''; });
    var mktPanels = document.querySelectorAll('.mkt-tab-content');
    mktPanels.forEach(function(el){ el.innerHTML = ''; });

    showToast('✓ 数据已重置（DB表: ' + (d1.tables_dropped||[]).length + ' / 文件: ' + JSON.stringify(d2.cleared||d1.files_cleared||{}) + '）', 'success');
  } catch(e) { showToast('重置失败: '+e.message, 'error'); }
}

// ── Clear Material Tab Cache Only ──
async function clearMaterialCacheOnly() {
  var asin = currentAsin;
  if (!asin) { showToast('当前无 ASIN，请先提交采集'); return; }
  if (!confirm('清除 ' + asin + ' 的产品素材缓存？\n\n将清除：采集的上下文 + 提示词 + 图片索引 + 图片文件\n其他 Tab 的缓存不受影响。')) return;

  try {
    // Get country from current job or settings
    var country = 'US';
    if (currentJobId) {
      try {
        var jr = await fetch('/api/status/' + currentJobId);
        var jd = await jr.json();
        country = jd.marketplace || 'US';
      } catch(e) {}
    }

    var res = await fetch('/api/cache/clear-material/' + asin + '/' + country, { method: 'POST' });
    var data = await res.json();

    // Reset material tab UI
    selectedPrototype = null; genCount = {};
    document.getElementById('refImageCount').textContent = '0';
    document.getElementById('promptCount').textContent = '0';
    document.getElementById('resultCount').textContent = '0';
    document.getElementById('promptList').innerHTML = '<div class="empty"><div class="icon">💡</div>提示词将在提交后自动生成<br><small>融合 Wiki 知识库 + MCP 商品语义</small></div>';
    document.getElementById('refImageGrid').innerHTML = '<div class="empty"><div class="icon">📷</div>请上传产品图片，或输入 ASIN 后点击「开始采集」<br>点击图片即可设为 GPT Image-2 生成原型</div>';
    document.getElementById('resultGrid').innerHTML = '<div class="empty"><div class="icon">🖼️</div>生成图片将在此展示<br><small>支持 PNG / PSD 格式下载</small></div>';
    document.getElementById('prototypeHint').classList.remove('show');
    document.getElementById('asinCategoryInfo').style.display = 'none';
    resetProgress();

    showToast('✓ 素材缓存已清除（上下文:' + (data.cleared.context||0) + ' 缓存:' + (data.cleared.material_cache||0) + ' 图片:' + (data.cleared.files||0) + '）', 'success');
  } catch(e) { showToast('清除失败: '+e.message, 'error'); }
}
