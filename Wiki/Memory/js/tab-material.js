// ── Upload Zone ──
var uploadedFiles = [];
(function(){
  var zone = document.getElementById('uploadZone');
  var input = document.getElementById('fileInput');
  zone.addEventListener('click', function(){ input.click(); });
  zone.addEventListener('dragover', function(e){ e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', function(){ zone.classList.remove('dragover'); });
  zone.addEventListener('drop', function(e){
    e.preventDefault(); zone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  input.addEventListener('change', function(){ handleFiles(input.files); });
})();

function handleFiles(files) {
  for (var i=0;i<files.length;i++) {
    var f = files[i];
    if (!f.type.match(/image\/(jpeg|png|webp)/)) continue;
    if (!uploadedFiles.some(function(uf){return uf.name===f.name && uf.size===f.size;})) {
      uploadedFiles.push(f);
    }
  }
  renderUploadedToRefGrid();
  updateAsinDivider();
}

// Renders drag-dropped / clicked local images directly into the product-reference grid
function renderUploadedToRefGrid() {
  var container = document.getElementById('refImageGrid');
  if (!container) return;
  if (uploadedFiles.length === 0) {
    container.innerHTML = '<div class="empty"><div class="icon">📷</div>请上传产品图片，或输入 ASIN 后点击「开始采集」<br>点击图片即可设为 GPT Image-2 生成原型</div>';
    return;
  }
  var html = '<div class="ref-section-label">📦 主ASIN图 <span class="ref-section-count">'+uploadedFiles.length+'</span></div>';
  html += '<div class="ref-image-grid">';
  uploadedFiles.forEach(function(f, i){
    var url = URL.createObjectURL(f);
    var sel = (selectedPrototype && selectedPrototype.filename === f.name && selectedPrototype._uploaded) ? ' selected' : '';
    html += '<div class="ref-image-card'+sel+'" onclick="var u=URL.createObjectURL(uploadedFiles['+i+']);selectedPrototype={url:u,filename:uploadedFiles['+i+'].name,type:\'main\',_uploaded:true};renderUploadedToRefGrid();" title="点击选为产品原型"><span class="img-type main">主图</span><img src="'+url+'" alt="'+f.name+'" loading="lazy"><div class="img-name" title="'+f.name+'">'+f.name+'</div></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// ── Job Flow ──
var progressTimer = null;
var progressStartTime = null;
function startProgressTimer() {
  progressStartTime = Date.now();
  document.getElementById('elapsedTime').style.display = 'inline';
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = setInterval(function(){
    var elapsed = Math.round((Date.now() - progressStartTime) / 1000);
    var min = Math.floor(elapsed / 60);
    var sec = elapsed % 60;
    document.getElementById('elapsedTime').textContent = '⏱ ' + (min > 0 ? min + 'm ' : '') + sec + 's';
  }, 1000);
}
function stopProgressTimer() {
  if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
}

function updateAsinDivider() {
  var c1688Url = document.getElementById('c1688Url').value.trim();
  var hasUploaded = uploadedFiles.length > 0;
  var divider = document.getElementById('asinDivider');
  if (c1688Url || hasUploaded) {
    divider.textContent = '― 需要输入亚马逊 ASIN 采集参考数据 ―';
  } else {
    divider.textContent = '― 或输入 ASIN 从亚马逊采集 ―';
  }
}

async function startJob() {
  var asin = document.getElementById('asinInput').value.trim();
  var marketplace = document.getElementById('marketplaceSelect').value;
  if (!marketplace) { showToast('请选择站点'); return; }
  var c1688Url = document.getElementById('c1688Url').value.trim();
  var hasUploaded = uploadedFiles.length > 0;
  var _uploaded = uploadedFiles.slice(); // snapshot survives async submission
  // Clear 1688 fields only (keep uploaded images visible until SSE completion)
  document.getElementById('c1688Url').value = '';
  document.getElementById('c1688Status').style.display = 'none';
  updateAsinDivider();

  // 【校验1】1688链接和上传图片不能同时有值
  if (c1688Url && hasUploaded) {
    alert('1688 商品链接和拖拽上传图片不能同时使用，请只选择其中一种图片来源。');
    return;
  }
  // 【校验2】无外部图片时必须输入ASIN（原逻辑）
  if (!c1688Url && !hasUploaded && !asin) {
    alert('请输入 ASIN');
    return;
  }
  // 【校验3】有外部图片时必须输入ASIN
  if ((c1688Url || hasUploaded) && !asin) {
    alert('已提供外部图片来源（1688/上传），请输入亚马逊 ASIN 以采集参考数据（标题、关键词等）。');
    return;
  }
  // VPN check for all marketplaces (Amazon blocks Chinese IPs)
  var isCn = true;
  try {
    var geoRes = await fetch('http://ip-api.com/json/?fields=countryCode');
    if (geoRes.ok) {
      var geoData = await geoRes.json();
      isCn = (geoData.countryCode === 'CN');
    }
  } catch(e) {}
  if (isCn) {
    alert('⚠️ 检测到当前为中国 IP，Amazon 站点对中国 IP 有区域限制\n\n' +
      '请开启 VPN 全局模式，连接任意非中国节点（美国、日本等均可）。\n\n' +
      '注意：必须开启全局模式，分流/智能模式可能导致 Amazon 流量未走 VPN。\n\n' +
      '切换 VPN 后请重新点击「开始采集」按钮。');
    return;
  }
  var btn = document.getElementById('startBtn');
  btn.disabled = true; btn.textContent = '⏳ 采集中...';
  resetProgress();
  startProgressTimer();

  // 【1688 采集】有1688链接时先采集图片
  if (c1688Url) {
    var status = document.getElementById('c1688Status');
    status.style.display = 'block'; status.textContent = '正在采集1688商品图片…';
    try {
      var c1688Res = await fetch('/api/collect-1688', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({url:c1688Url})});
      var c1688Data = await c1688Res.json();
      if (c1688Data.images && c1688Data.images.length > 0) {
        status.textContent = '已采集 ' + c1688Data.images.length + ' 张1688图片' + (c1688Data.title ? ' | ' + c1688Data.title : '');
      } else {
        status.textContent = '1688未采集到图片，继续参考数据采集…';
      }
    } catch(e) { status.textContent = '1688采集失败: ' + e.message; }
  }

  var hasExternalImages = c1688Url || hasUploaded;
  var formData = new FormData();
  formData.append('asin', asin); formData.append('marketplace', marketplace);
  formData.append('c1688_url', c1688Url);
  formData.append('skip_amazon_images', hasExternalImages ? '1' : '0');
  // Append uploaded files if any (use snapshot to survive cleanAfterCollect)
  _uploaded.forEach(function(f){
    formData.append('images', f);
  });
  try {
    var res = await fetch('/api/submit', {method:'POST', body:formData});
    var data = await res.json();
    if (data.error) { alert(data.error); btn.disabled=false; btn.textContent='📥 开始采集'; return; }
    currentJobId = data.job_id;
    startSSE(currentJobId);
  } catch(e) { alert('提交失败: '+e.message); btn.disabled=false; btn.textContent='📥 开始采集'; }
}

function startSSE(jobId) {
  if (eventSource) eventSource.close();
  eventSource = new EventSource('/api/stream/' + jobId);
  eventSource.onmessage = function(e) {
    var msg = JSON.parse(e.data);
    updateProgress(msg);
    if (msg.step==='mcp'&&msg.progress>=50) loadAsinCategory(jobId);
    if (msg.step==='prompt'&&msg.progress>=95) { document.getElementById('startBtn').disabled=false; document.getElementById('startBtn').textContent='📥 开始采集'; loadRefImages(jobId); loadPrompts(jobId); markStepDone('stepDone'); document.getElementById('progressFill').style.width='100%'; document.getElementById('progressPercent').textContent='100%'; stopProgressTimer(); cleanAfterCollect(); }
    if (msg.step==='error') { eventSource.close(); document.getElementById('startBtn').disabled=false; document.getElementById('startBtn').textContent='📥 开始采集'; stopProgressTimer(); }
  };
  eventSource.onerror = function() { setTimeout(function(){if(eventSource&&eventSource.readyState===EventSource.CLOSED)document.getElementById('startBtn').disabled=false;},3000); };
}

// ── Progress ──
var stepMap = {collect:'stepCollect',mcp:'stepMcp',prompt:'stepPrompt',generate:'stepGenerate'};
function updateProgress(msg) {
  var stepKey = stepMap[msg.step]; if (!stepKey) return;
  var allSteps = ['stepCollect','stepMcp','stepPrompt','stepGenerate','stepDone'];
  var stepOrder = ['collect','mcp','prompt','generate'];
  var currentIdx = stepOrder.indexOf(msg.step);
  allSteps.forEach(function(id,i){
    var dot = document.querySelector('#'+id+' .step-dot');
    dot.className = 'step-dot';
    if (i<currentIdx) dot.classList.add('done');
    else if (i===currentIdx && msg.step!=='error') dot.classList.add('active');
  });
  var msgEl = document.querySelector('#'+stepKey+' .step-msg');
  if (msgEl) msgEl.textContent = msg.message;
  if (msg.step==='prompt'&&msg.progress>=85) {
    var pDot = document.querySelector('#stepPrompt .step-dot');
    if (pDot) pDot.className = 'step-dot done';
  }
  document.getElementById('progressFill').style.width = msg.progress+'%';
  document.getElementById('progressPercent').textContent = msg.progress+'%';
}
function cleanAfterCollect() {
  document.getElementById('c1688Url').value = '';
  document.getElementById('c1688Status').style.display = 'none';
  uploadedFiles = [];
  renderUploadedToRefGrid();
  updateAsinDivider();
}

function resetProgress() {
  ['stepCollect','stepMcp','stepPrompt','stepGenerate','stepDone'].forEach(function(id){
    document.querySelector('#'+id+' .step-dot').className = 'step-dot';
    document.querySelector('#'+id+' .step-msg').textContent = '等待开始';
  });
  document.getElementById('progressFill').style.width='0%';
  document.getElementById('progressPercent').textContent='0%';
  document.getElementById('elapsedTime').style.display = 'none';
  document.getElementById('elapsedTime').textContent = '⏱ 0s';
  document.getElementById('genTaskList').innerHTML='';
  document.getElementById('genTaskList').style.display='none';
  stopProgressTimer();
}
function markStepDone(stepId) {
  var dot = document.querySelector('#'+stepId+' .step-dot');
  if (dot) dot.className = 'step-dot done';
}

// ── Category Info ──
async function loadAsinCategory(jobId) {
  try {
    var res = await fetch('/api/context/'+jobId);
    var ctx = await res.json();
    if (ctx.category) {
      var el = document.getElementById('asinCategoryInfo');
      el.style.display='block';
      el.innerHTML = '📂 ' + escHtml(ctx.category) + (ctx.price?' | 💰 '+escHtml(ctx.price):'');
    }
    // MCP warning banner
    var warnEl = document.getElementById('mcpWarningBanner');
    var warnText = document.getElementById('mcpWarningText');
    if (ctx._mcp_warning === 'not_enabled') {
      warnEl.style.display = 'flex';
      warnText.textContent = '⚠️ 未启用产品数据源，请在设置中开启「卖家精灵 MCP」或「Sorftime MCP」';
    } else if (ctx._mcp_warning === 'incomplete') {
      warnEl.style.display = 'flex';
      warnText.textContent = '⚠️ 产品数据源已开启但 Endpoint 或 API Key 未填写，请在设置中补全';
    } else {
      // call_failed or empty — don't show banner (MCP configured, network issues are normal)
      warnEl.style.display = 'none';
    }
  } catch(e){}
}

// ── Reference Images ──
async function loadRefImages(jobId) {
  try {
    var statusRes = await fetch('/api/status/'+jobId);
    var status = await statusRes.json();
    var asin = status.asin;
    if (!asin) return;
    currentAsin = asin;
    var res = await fetch('/api/images/'+asin);
    var data = await res.json();
    renderRefImages(data.images||[], data.product_wb_image||'');
    await loadResultsByAsin(asin);
  } catch(e){}
}

function renderRefImages(images, wbImageUrl) {
  var refOnly = images.filter(function(img){return img.type!=='generated'&&!(img.url||'').includes('/output/');});
  // Prepend white-bg product image if available
  if (wbImageUrl) {
    refOnly.unshift({type:'wb', filename:'白底产品图（抠图）', url:wbImageUrl});
    currentWbImageUrl = wbImageUrl;
  }
  document.getElementById('refImageCount').textContent = refOnly.length + ' 张';
  var container = document.getElementById('refImageGrid');
  var hint = document.getElementById('prototypeHint');
  if (refOnly.length===0) {
    container.innerHTML='<div class="empty"><div class="icon">📷</div>请上传产品图片，或输入 ASIN 后点击「开始采集」<br>点击图片即可设为 GPT Image-2 生成原型</div>';
    hint.classList.remove('show');
    return;
  }
  hint.classList.add('show');

  // Split into main ASIN images vs variant images (uploads go into mainImgs)
  var mainImgs = [], varImgs = [];
  var asinPrefix = (currentAsin || '') + '_';
  refOnly.forEach(function(img){
    var fn = img.filename || '';
    if (img.type === 'wb') { mainImgs.unshift(img); }
    else if (fn.indexOf('_variant') >= 0) { varImgs.push(img); }
    else { mainImgs.push(img); }
  });

  function _renderCard(img, typeOverride){
    var typeCls = typeOverride || img.type;
    var typeLabelMap = {wb:'白底抠图', main:'主图', variant:'变体', aplus:'A+', uploaded:'本地上传'};
    var typeLabel = typeLabelMap[typeCls] || typeCls;
    // Match selected prototype by filename (survives blob→server URL transition)
    var sel = '';
    if (selectedPrototype) {
      if (selectedPrototype.url === img.url) sel = ' selected';
      else if (selectedPrototype.filename === img.filename) sel = ' selected';
    }
    return '<div class="ref-image-card'+sel+'" onclick="selectPrototype(\''+img.url.replace(/'/g,"\\'")+'\',\''+img.filename.replace(/'/g,"\\'")+'\',\''+img.type+'\')" title="点击选为产品原型"><span class="img-type '+typeCls+'">'+typeLabel+'</span><button class="ref-preview-btn" onclick="event.stopPropagation();previewImage(\''+img.url.replace(/'/g,"\\'")+'\',\''+img.filename.replace(/'/g,"\\'")+'\')" title="预览大图">🔍</button><img src="'+img.url+'" alt="'+img.filename+'" loading="lazy"><div class="img-name" title="'+img.filename+'">'+img.filename+'</div></div>';
  }

  var html = '';
  if (mainImgs.length > 0) {
    html += '<div class="ref-section-label">📦 主ASIN图 <span class="ref-section-count">'+mainImgs.length+'</span></div>';
    html += '<div class="ref-image-grid">'+mainImgs.map(function(img){return _renderCard(img, img.type==='wb'?'wb':'main');}).join('')+'</div>';
  }
  if (varImgs.length > 0) {
    html += '<div class="ref-section-label">🎨 变体图 <span class="ref-section-count">'+varImgs.length+'</span></div>';
    html += '<div class="ref-image-grid">'+varImgs.map(function(img){return _renderCard(img, 'variant');}).join('')+'</div>';
  }
  container.innerHTML = html;
}

function selectPrototype(url, filename, type) {
  selectedPrototype = {url:url, filename:filename, type:type};
  if (currentJobId) {
    loadRefImages(currentJobId);
    loadPrompts(currentJobId);
  }
}

// ── Prompts ──
async function loadPrompts(jobId) {
  try {
    var res = await fetch('/api/prompts/'+jobId);
    var data = await res.json();
    var list = data.prompts||[];
    document.getElementById('promptCount').textContent = list.length;
    var container = document.getElementById('promptList');
    var promptCard = function(p,i,isOpen){
      var pid = 'promptBody_'+i;
      var mainHint = (p.type==='main') ? ' <span style="font-size:.58rem;color:var(--accent2);">（默认生成白底主图，其它6张主图提示词需用户自定义保存到模板库，自行选择模板）</span>' : '';
      return '<div class="prompt-card"><div class="ptype'+(isOpen?'':' collapsed')+'" onclick="togglePromptBody(\''+pid+'\',this)"><span class="toggle-arrow">▼</span> '+(p.label_cn||p.type)+' · '+(p.module_size||'')+' · '+p.aspect+mainHint+'</div><div class="prompt-body'+(isOpen?'':' collapsed')+'" id="'+pid+'"><div style="display:flex;gap:8px;margin-top:8px;"><div style="flex:1;min-width:0;display:flex;flex-direction:column;"><textarea class="ptext" id="promptText_'+i+'" rows="5">'+escHtml(p.prompt)+'</textarea></div><div style="flex:1;min-width:0;display:flex;flex-direction:column;"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;"><span style="font-size:.65rem;color:var(--muted);">中文参考</span><div style="display:flex;gap:4px;"><button class="translate-btn" onclick="translatePrompt('+i+')" title="翻译英文提示词为中文">翻译中文</button><button class="copy-btn" onclick="copyPromptCN('+i+')" title="复制中文" style="width:24px;height:24px;font-size:.7rem;">📋</button></div></div><textarea class="ptext" id="promptTextCN_'+i+'" rows="5" placeholder="点击翻译按钮翻译英文提示词..."></textarea></div></div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;"><div class="pmeta" style="margin:0;">Prompt #'+(i+1)+' · '+(document.getElementById('tglGemini').checked?'Gemini-3-Nano':'GPT-Image-2')+'</div></div></div><div class="pactions"><button class="btn-send-chatgpt" onclick="sendToChatGPT('+i+')">🚀 发送生成'+((genCount[i]||0)>0?' (已生成' + genCount[i] + '次)':'')+'</button></div></div>';
    };
    var html = '';
    // Prompts 1-2: always open
    for (var i=0; i<Math.min(2,list.length); i++) { html += promptCard(list[i], i, true); }
    // Prompts 3+: wrapped in collapsible group
    if (list.length > 2) {
      var rest = list.length - 2;
      html += '<div class="prompt-group" style="margin-top:8px;">';
      html += '<div class="prompt-group-header" onclick="togglePromptGroup(this)" style="cursor:pointer;padding:8px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px;font-size:.72rem;font-weight:700;color:var(--muted);display:flex;align-items:center;gap:6px;user-select:none;">';
      html += '<span class="group-arrow" style="transition:transform .2s;transform:rotate(-90deg);display:inline-block;">▼</span> 📋 更多提示词 ('+rest+')';
      html += '</div>';
      html += '<div class="prompt-group-body" id="restGroupBody" style="overflow:hidden;transition:max-height .3s ease;max-height:0;">';
      for (var j=2; j<list.length; j++) { html += promptCard(list[j], j, false); }
      html += '</div></div>';
    }
    container.innerHTML = html;
    initGenTaskList(list);
    if (list.length>0) switchMainTab('material');
  } catch(e){}
}

function togglePromptBody(id, header) {
  var body = document.getElementById(id);
  if (!body) return;
  var isCollapsed = body.classList.contains('collapsed');
  if (isCollapsed) { body.classList.remove('collapsed'); header.classList.remove('collapsed'); }
  else { body.classList.add('collapsed'); header.classList.add('collapsed'); }
}
function togglePromptGroup(header) {
  var body = document.getElementById('restGroupBody');
  if (!body) return;
  // Toggle: collapse by setting max-height to 0
  if (body.style.maxHeight === '0px') {
    body.style.maxHeight = '2500px';
    header.querySelector('.group-arrow').style.transform = 'rotate(0deg)';
  } else {
    body.style.maxHeight = '0px';
    header.querySelector('.group-arrow').style.transform = 'rotate(-90deg)';
  }
}
function copyPrompt(i) {
  var ta = document.getElementById('promptText_'+i);
  if (ta) { ta.select(); navigator.clipboard.writeText(ta.value).then(function(){showToast('已复制','success');}); }
}

async function translatePrompt(i) {
  var src = document.getElementById('promptText_'+i);
  var dst = document.getElementById('promptTextCN_'+i);
  var text = (src.value||'').trim();
  if (!text) { showToast('英文提示词为空，无需翻译', 'warning'); return; }
  dst.value = '翻译中...';
  try {
    var res = await fetch('/api/translate-prompt', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:text, target:'zh-CN'})});
    var data = await res.json();
    dst.value = data.translated || text;
  } catch(e) { dst.value = text; showToast('翻译失败，请重试', 'error'); }
}

function copyPromptCN(i) {
  var ta = document.getElementById('promptTextCN_'+i);
  if (ta) { navigator.clipboard.writeText(ta.value).then(function(){showToast('已复制中文翻译','success');}); }
}

async function translatePromptCNtoEN(i) {
  var src = document.getElementById('promptTextCN_'+i);
  var dst = document.getElementById('promptText_'+i);
  var text = (src.value||'').trim();
  if (!text) { showToast('右侧中文提示词为空，请先翻译或输入中文', 'warning'); return; }
  showToast('正在从右侧中文翻译为英文，翻译结果仅供参考，请核对准确性！', 'info');
  try {
    var res = await fetch('/api/translate-prompt', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:text, target:'en'})});
    var data = await res.json();
    dst.value = data.translated || text;
    showToast('已从中文翻译为英文，请核对翻译准确性！', 'warning');
  } catch(e) { showToast('翻译失败，请重试', 'error'); }
}

// ── Image Generation ──
async function sendToChatGPT(promptIndex) {
  if (!currentAsin) { alert('任务状态丢失，请重新提交'); return; }
  if (!selectedPrototype) { showToast('请先选择一张产品主图作为生成原型（点击图片即可选中）', 'error'); return; }
  if (typeof selectedPrototype.url === 'string' && selectedPrototype.url.startsWith('blob:')) {
    showToast('请先点击「开始采集」提交任务，将本地图片上传到服务器后再生成', 'error'); return;
  }
  var textarea = document.getElementById('promptText_'+promptIndex);
  var editedPrompt = textarea?textarea.value.trim():'';
  if (!editedPrompt) { alert('提示词为空，请检查'); return; }

  var genModelName = (document.getElementById('tglGemini')||{}).checked ? 'Gemini-3 Nano Banana' : 'GPT-Image-2';
  showToast('图片生成速度取决于 AI 生图平台，预计 10-60 秒，请耐心等待…', 'info');

  var genDot = document.querySelector('#stepGenerate .step-dot');
  if (genDot) genDot.className = 'step-dot active';
  var genMsg = document.querySelector('#stepGenerate .step-msg');
  if (genMsg) genMsg.textContent = '正在生成...';

  var startTime = Date.now();
  var currentStatus = 'uploading';
  updateGenTask(promptIndex, 'uploading', 0);
  var thisBtn = document.querySelectorAll('.btn-send-chatgpt')[promptIndex];
  if (thisBtn) { thisBtn.disabled=true; thisBtn.textContent='⏳ 生成中 0s...'; }
  var timerInterval = setInterval(function(){
    var elapsed = Math.round((Date.now()-startTime)/1000);
    if (elapsed>2) currentStatus = 'generating';
    updateGenTask(promptIndex, currentStatus, elapsed);
    if (thisBtn) { thisBtn.textContent='⏳ 生成中 ' + elapsed + 's...'; }
  }, 1000);

  try {
    var res = await fetch('/api/send-to-chatgpt', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({asin:currentAsin, prompt_index:promptIndex, prompt_text:editedPrompt, prototype_image_url:selectedPrototype?selectedPrototype.url:''})
    });
    clearInterval(timerInterval);
    var data = await res.json();
    if (data.error) {
      if (data.error === 'WHITE_BG_NOT_FOUND') {
        updateGenTask(promptIndex, 'failed');
        openWbUploadPrompt(data.message);
      } else {
        updateGenTask(promptIndex, 'failed');
        alert('生成失败: ' + (data.message || data.error));
      }
    }
    else {
      var elapsed = Math.round((Date.now()-startTime)/1000);
      updateGenTask(promptIndex,'done',elapsed);
      if (genDot) genDot.className = 'step-dot done';
      if (genMsg) genMsg.textContent = '✓ 已完成 ('+elapsed+'s)';
      showToast('✅ 图片已生成 ('+elapsed+'秒)','success');
      genCount[promptIndex] = (genCount[promptIndex]||0) + 1;
      addResultCard(data.url, data.filename, currentAsin);
      markStepDone('stepDone');
    }
  } catch(e) {
    clearInterval(timerInterval);
    updateGenTask(promptIndex,'failed');
    alert('请求失败: '+e.message);
  } finally {
    if (thisBtn) { thisBtn.disabled=false; thisBtn.textContent='🚀 发送生成'+((genCount[promptIndex]||0)>0?' (已生成' + genCount[promptIndex] + '次)':''); }
  }
}

// ── Gen Task List ──
function initGenTaskList(prompts) {
  var el = document.getElementById('genTaskList');
  if (!el||!prompts||prompts.length===0) { if(el)el.style.display='none'; return; }
  el.style.display='block';
  el.innerHTML = prompts.map(function(p,i){
    return '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;" id="genTask_'+i+'"><span style="width:8px;height:8px;border-radius:50%;background:var(--border);flex-shrink:0;" id="genDot_'+i+'"></span><span style="font-size:.6rem;color:var(--muted);flex:1;">'+escHtml((p.label_cn||p.type||'')+' · '+(p.aspect||''))+'</span><span style="font-size:.58rem;color:var(--muted);" id="genStatus_'+i+'">待生成</span></div>';
  }).join('');
}

function updateGenTask(index, status, elapsed) {
  var dot = document.getElementById('genDot_'+index);
  var st = document.getElementById('genStatus_'+index);
  if (dot) {
    dot.style.background = status==='done'?'var(--green)':status==='generating'?'var(--accent)':status==='uploading'?'var(--accent2)':status==='failed'?'var(--red)':'var(--border)';
  }
  if (st) {
    if (status==='done') { st.textContent='✓ 完成'; st.style.color='var(--green)'; }
    else if (status==='generating') { st.textContent='⏳ '+(elapsed||'')+'s'; st.style.color='var(--accent)'; }
    else if (status==='uploading') { st.textContent='↑ 上传中'; st.style.color='var(--accent2)'; }
    else if (status==='failed') { st.textContent='✗ 失败'; st.style.color='var(--red)'; }
  }
}

// ── Results ──
async function loadResultsByAsin(asin) {
  if (!asin) return;
  // If ASIN changed, clear the grid
  if (currentAsin && currentAsin !== asin) {
    document.getElementById('resultGrid').innerHTML = '<div class="empty"><div class="icon">🖼️</div>生成图片将在此展示<br><small>选中产品原型图 + 点击提示词按钮来生成</small></div>';
    document.getElementById('resultCount').textContent = '0';
  }
  currentAsin = asin;
  try {
    var imgRes = await fetch('/api/images/'+asin);
    var imgData = await imgRes.json();
    var allImages = imgData.images||[];
    var generated = allImages.filter(function(img){return img.url&&img.url.includes('/output/');});
    document.getElementById('resultCount').textContent = generated.length;
    var container = document.getElementById('resultGrid');
    if (generated.length===0) {
      container.innerHTML = '<div class="empty"><div class="icon">🖼️</div>生成图片将在此展示<br><small>选中产品原型图 + 点击提示词按钮来生成</small></div>';
      return;
    }
    container.innerHTML = generated.map(function(g){
      return '<div class="result-card"><span class="label">'+g.filename+'</span><img src="'+g.url+'" alt="'+g.filename+'" loading="lazy" onclick="previewImage(\''+g.url+'\',\''+g.filename+'\')" title="点击预览"><div class="actions"><a class="dl-png" href="'+g.url+'" download>📥 导出PNG图片</a><a class="dl-psd" href="#" data-name="'+g.filename.replace('.png','')+'" data-asin="'+asin+'" onclick="exportPSD(this.dataset.name,this.dataset.asin);return false;">📦 导出PSD图片</a></div></div>';
    }).join('');
  } catch(e) {}
}

function addResultCard(url, filename, asin) {
  // Only add card if it belongs to the current ASIN
  if (currentAsin && asin && currentAsin !== asin) return;
  var container = document.getElementById('resultGrid');
  var emptyEl = container.querySelector('.empty');
  if (emptyEl) emptyEl.remove();
  var card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = '<span class="label">'+filename+'</span><img src="'+url+'" alt="'+filename+'" loading="lazy" onclick="previewImage(\''+url+'\',\''+filename+'\')" title="点击预览"><div class="actions"><a class="dl-png" href="'+url+'" download>📥 导出PNG图片</a><a class="dl-psd" href="#" data-name="'+filename.replace('.png','')+'" data-asin="'+asin+'" onclick="exportPSD(this.dataset.name,this.dataset.asin);return false;">📦 导出PSD图片</a></div>';
  container.insertBefore(card, container.firstChild);
  // Scroll result into view
  card.scrollIntoView({behavior:'smooth',block:'nearest'});
  var badge = document.getElementById('resultCount');
  badge.textContent = (parseInt(badge.textContent)||0) + 1;
}

async function exportPSD(name, asin) {
  try {
    var res = await fetch('/api/export-psd', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name_stem:name,asin:asin})});
    if (res.ok) {
      var blob = await res.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name+'.psd';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      showToast('PSD 导出成功','success');
    } else { alert('PSD导出失败，请稍后再试'); }
  } catch(e) { alert('PSD导出失败: '+e.message); }
}
