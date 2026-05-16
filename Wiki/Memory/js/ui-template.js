// Prompt Template Library — State & Constants
// ═══════════════════════════════════════════════════════════════
var TPL_IMG_TYPES = [
  {key:'main',label_cn:'主图',module:'Main Image'},
  {key:'aplus_header',label_cn:'A+ 顶部横幅',module:'Standard Image Header'},
  {key:'aplus_single',label_cn:'A+ 标准单图',module:'Standard Single Image'},
  {key:'aplus_three',label_cn:'A+ 三栏图文',module:'Standard Three Images & Text'},
  {key:'aplus_four',label_cn:'A+ 四栏图文',module:'Standard Four Images & Text'},
  {key:'aplus_wrap',label_cn:'A+ 单图+文本',module:'Standard Image & Text'},
  {key:'aplus_compare',label_cn:'A+ 对比图表',module:'Standard Comparison Chart'},
  {key:'brand_story_bg',label_cn:'品牌故事背景',module:'Brand Story Background'},
  {key:'brand_story_card',label_cn:'品牌故事卡片',module:'Brand Story Card'},
  {key:'hover_zoom',label_cn:'高清放大图',module:'Hover/Zoom'}
];
var TPL_DATA = {};
var TPL_DEFAULTS = {};
var TPL_EXPANDED = {};
var TPL_HOVER_TIMER = null;
var TPL_COLLAPSED = localStorage.getItem('tplCollapsed') === '1';

function tplTogglePanel() {
  TPL_COLLAPSED = !TPL_COLLAPSED;
  var panel = document.getElementById('templatePanel');
  var btn = panel.querySelector('.tpl-toggle-btn');
  if (TPL_COLLAPSED) {
    panel.classList.add('collapsed');
    if (btn) btn.textContent = '▶';
  } else {
    panel.classList.remove('collapsed');
    if (btn) btn.textContent = '◀';
  }
  localStorage.setItem('tplCollapsed', TPL_COLLAPSED ? '1' : '0');
}

function tplInitCollapsed() {
  if (TPL_COLLAPSED) {
    var panel = document.getElementById('templatePanel');
    if (panel) { panel.classList.add('collapsed'); }
    setTimeout(function() {
      var btn = panel.querySelector('.tpl-toggle-btn');
      if (btn) btn.textContent = '▶';
    }, 300);
  }
}

async function tplLoad() {
  try {
    var res = await fetch('/api/prompt-templates');
    if (!res.ok) throw new Error('HTTP '+res.status);
    var data = await res.json();
    TPL_DEFAULTS = data._defaults || {};
    delete data._defaults;
    TPL_DATA = data;
    for (var t in TPL_DATA) {
      if (TPL_DATA[t].items && TPL_DATA[t].items.length>0) TPL_EXPANDED[t] = true;
    }
    tplRender();
    tplApplyDefaults();
    tplInitCollapsed();
  } catch(e) {
    console.error('tplLoad failed:', e);
    showToast('模板库加载失败，请检查网络连接', 'error');
  }
}

function tplRender(filter) {
  var el = document.getElementById('tplScroll');
  if (!el) return;
  var q = (filter||'').toLowerCase();
  var html = '';
  for (var ti=0; ti<TPL_IMG_TYPES.length; ti++) {
    var t = TPL_IMG_TYPES[ti];
    var items = (TPL_DATA[t.key] && TPL_DATA[t.key].items) ? TPL_DATA[t.key].items : [];
    if (q) {
      items = items.filter(function(it){
        return it.name.toLowerCase().indexOf(q)>=0 || (it.description||'').toLowerCase().indexOf(q)>=0;
      });
    }
    var expanded = TPL_EXPANDED[t.key] || (!!q && items.length>0);
    html += '<div class="tpl-group">';
    html += '<div class="tpl-group-head" onclick="tplToggleGroup(\''+t.key+'\')">';
    html += '<span class="g-arrow" style="transform:'+(expanded?'rotate(0deg)':'rotate(-90deg)')+';">▼</span>';
    html += '<span class="g-label">'+escHtml(t.label_cn)+'</span>';
    html += '<span class="g-count">('+items.length+')</span>';
    html += '<button class="g-add" onclick="event.stopPropagation();tplOpenNewModal(\''+t.key+'\')">+新</button>';
    html += '</div>';
    html += '<div class="tpl-group-body'+(expanded?'':' collapsed')+'" id="tplGroup_'+t.key+'" style="max-height:'+(expanded?'none':'0')+';">';
    if (items.length===0) {
      html += '<div class="tpl-empty">点击 <b>+新</b> 添加第一条模板</div>';
    } else {
      for (var i=0; i<items.length; i++) {
        var it = items[i];
        var isDefault = TPL_DEFAULTS[t.key]===i;
        html += '<div class="tpl-item" id="tplItem_'+t.key+'_'+i+'" data-tpl-key="'+t.key+'" data-tpl-idx="'+i+'">';
        html += '<span class="ti-pin'+(it.pinned?' active':'')+'" title="'+(it.pinned?'取消置顶':'置顶')+'" onclick="event.stopPropagation();tplTogglePin(\''+t.key+'\','+i+')"></span>';
        html += '<div class="ti-body" onmouseenter="tplHover(event,this)" onmouseleave="tplUnhover()" data-prompt="'+escHtml(it.prompt).replace(/"/g,'&quot;')+'">';
        html += '<div class="ti-name" ondblclick="event.stopPropagation();tplRename(event,\''+t.key+'\','+i+')">'+escHtml(it.name)+'</div>';
        html += '<div class="ti-meta">已用 '+(it.use_count||0)+' 次';
        if (it.last_used) html += ' · '+tplTimeAgo(it.last_used);
        html += '</div>';
        html += '</div>';
        html += '<span class="ti-star'+(isDefault?' active':'')+'" title="'+(isDefault?'当前默认':'设为默认')+'" onclick="event.stopPropagation();tplSetDefault(\''+t.key+'\','+i+')">⭐</span>';
        html += '<span class="ti-actions">';
        html += '<button class="btn-edit" title="编辑模板" onclick="event.stopPropagation();tplOpenEditModal(\''+t.key+'\','+i+')">✎</button>';
        html += '<button class="btn-clone" title="复制模板" onclick="event.stopPropagation();tplClone(\''+t.key+'\','+i+')">⎘</button>';
        html += '<button class="btn-del" title="删除" onclick="event.stopPropagation();tplDelete(\''+t.key+'\','+i+')">✕</button>';
        html += '</span>';
        html += '</div>';
      }
    }
    html += '</div></div>';
  }
  el.innerHTML = html;
}

function tplToggleGroup(tkey) {
  var body = document.getElementById('tplGroup_'+tkey);
  if (!body) return;
  if (TPL_EXPANDED[tkey]) {
    body.style.maxHeight = '0';
    body.classList.add('collapsed');
    TPL_EXPANDED[tkey] = false;
  } else {
    body.style.maxHeight = body.scrollHeight + 'px';
    body.classList.remove('collapsed');
    TPL_EXPANDED[tkey] = true;
  }
  var head = body.previousElementSibling;
  if (head) {
    var arrow = head.querySelector('.g-arrow');
    if (arrow) arrow.style.transform = TPL_EXPANDED[tkey] ? 'rotate(0deg)' : 'rotate(-90deg)';
  }
}

function tplApplyDefaults() {
  for (var t in TPL_DEFAULTS) {
    var idx = TPL_DEFAULTS[t];
    var items = TPL_DATA[t] && TPL_DATA[t].items ? TPL_DATA[t].items : [];
    if (idx>=0 && idx<items.length) {
      tplFillCard(t, items[idx].prompt);
    }
  }
}

function tplFillCard(tkey, promptText) {
  var textareas = document.querySelectorAll('.ptext');
  for (var i=0; i<textareas.length; i++) {
    var card = textareas[i].closest('.prompt-card');
    if (!card) continue;
    if (card.getAttribute('data-tkey') === tkey) {
      textareas[i].value = promptText;
      return;
    }
  }
  // Fallback: match by label_cn in ptype text (for cards before tplInjectSelectors runs)
  for (var i2=0; i2<textareas.length; i2++) {
    var card2 = textareas[i2].closest('.prompt-card');
    if (!card2 || card2.hasAttribute('data-tkey')) continue;
    var ptypeEl = card2.querySelector('.ptype');
    if (!ptypeEl) continue;
    for (var j=0; j<TPL_IMG_TYPES.length; j++) {
      if (ptypeEl.textContent.indexOf(TPL_IMG_TYPES[j].label_cn)>=0 && TPL_IMG_TYPES[j].key===tkey) {
        textareas[i2].value = promptText;
        card2.setAttribute('data-tkey', tkey);
        return;
      }
    }
  }
}

async function tplSelect(tkey, index) {
  index = parseInt(index, 10);
  var items = TPL_DATA[tkey] && TPL_DATA[tkey].items ? TPL_DATA[tkey].items : [];
  if (isNaN(index) || index<0 || index>=items.length) return;
  var prompt = items[index].prompt;
  if (!prompt) { showToast('模板提示词为空', 'error'); return; }
  // Direct approach: find matching textarea by data-tkey
  var found = false;
  var textareas = document.querySelectorAll('.ptext');
  for (var i=0; i<textareas.length; i++) {
    var card = textareas[i].closest('.prompt-card');
    if (card && card.getAttribute('data-tkey') === tkey) {
      textareas[i].value = prompt;
      found = true;
    }
  }
  // Fallback: match by label_cn
  if (!found) {
    for (var i2=0; i2<textareas.length; i2++) {
      var card2 = textareas[i2].closest('.prompt-card');
      if (!card2) continue;
      var ptypeEl = card2.querySelector('.ptype');
      if (!ptypeEl) continue;
      for (var j=0; j<TPL_IMG_TYPES.length; j++) {
        if (ptypeEl.textContent.indexOf(TPL_IMG_TYPES[j].label_cn)>=0 && TPL_IMG_TYPES[j].key===tkey) {
          textareas[i2].value = prompt;
          card2.setAttribute('data-tkey', tkey);
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }
  // Also update any selector dropdown on matching cards
  var sel = document.querySelector('.prompt-card[data-tkey="'+tkey+'"] .tpl-sel-row select');
  if (sel) sel.value = index;
  document.querySelectorAll('.tpl-item.selected').forEach(function(el){el.classList.remove('selected');});
  var itemEl = document.getElementById('tplItem_'+tkey+'_'+index);
  if (itemEl) itemEl.classList.add('selected');
  try {
    await fetch('/api/prompt-templates/'+tkey+'/select', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({index:index})});
    items[index].use_count = (items[index].use_count||0)+1;
    items[index].last_used = new Date().toISOString();
    tplRender();
  } catch(e){}
  showToast(found ? '已套用: '+items[index].name : '未找到对应提示词框 (tkey='+tkey+')', found ? 'success' : 'error');
}

async function tplSetDefault(tkey, index) {
  try {
    await fetch('/api/prompt-templates/'+tkey+'/default', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({index:index})});
    TPL_DEFAULTS[tkey] = index;
    tplRender();
    showToast('已设为默认', 'success');
  } catch(e){}
}

async function tplTogglePin(tkey, index) {
  var items = TPL_DATA[tkey] && TPL_DATA[tkey].items ? TPL_DATA[tkey].items : [];
  if (index<0 || index>=items.length) return;
  var newPinned = !items[index].pinned;
  try {
    await fetch('/api/prompt-templates/'+tkey+'/'+index, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({pinned:newPinned})});
    items[index].pinned = newPinned;
    tplRender();
  } catch(e){}
}

async function tplClone(tkey, index) {
  var items = TPL_DATA[tkey] && TPL_DATA[tkey].items ? TPL_DATA[tkey].items : [];
  if (index<0 || index>=items.length) return;
  var src = items[index];
  try {
    var res = await fetch('/api/prompt-templates', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:tkey,name:src.name+' (副本)',prompt:src.prompt,description:src.description||''})});
    if (res.ok) { tplRefresh(); showToast('已复制', 'success'); }
  } catch(e){}
}

async function tplDelete(tkey, index) {
  if (!confirm('确定删除此模板？')) return;
  try {
    var res = await fetch('/api/prompt-templates/'+tkey+'/'+index, {method:'DELETE'});
    if (res.ok) { tplRefresh(); showToast('已删除', 'success'); }
  } catch(e){}
}

function tplRename(e, tkey, index) {
  var items = TPL_DATA[tkey] && TPL_DATA[tkey].items ? TPL_DATA[tkey].items : [];
  if (index<0 || index>=items.length) return;
  var nameEl = e.target;
  var oldName = items[index].name;
  nameEl.classList.add('editing');
  nameEl.innerHTML = '<input value="'+escHtml(oldName).replace(/"/g,'&quot;')+'" onblur="tplFinishRename(event,\''+tkey+'\','+index+')" onkeydown="if(event.key===\'Enter\')this.blur()">';
  var inp = nameEl.querySelector('input');
  if (inp) { inp.focus(); inp.select(); }
}

async function tplFinishRename(e, tkey, index) {
  var newName = (e.target.value||'').trim();
  var nameEl = e.target.parentElement;
  nameEl.classList.remove('editing');
  if (!newName) { tplRender(); return; }
  var items = TPL_DATA[tkey] && TPL_DATA[tkey].items ? TPL_DATA[tkey].items : [];
  try {
    var res = await fetch('/api/prompt-templates/'+tkey+'/'+index, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:newName})});
    if (res.ok) { items[index].name = newName; tplRender(); }
  } catch(e){ tplRender(); }
}

async function tplRefresh() {
  try {
    var res = await fetch('/api/prompt-templates');
    if (!res.ok) throw new Error('HTTP '+res.status);
    var data = await res.json();
    TPL_DEFAULTS = data._defaults || {};
    delete data._defaults;
    TPL_DATA = data;
    tplRender();
  } catch(e) {
    console.error('tplRefresh failed:', e);
    showToast('刷新模板库失败', 'error');
  }
}

function tplHover(e, el) {
  var prompt = el.getAttribute('data-prompt')||'';
  if (!prompt.trim()) return;
  clearTimeout(TPL_HOVER_TIMER);
  TPL_HOVER_TIMER = setTimeout(function(){
    var tip = document.getElementById('tplPreviewTip');
    if (!tip) return;
    var lines = prompt.split('\n').slice(0,6);
    var preview = lines.join('\n');
    if (lines.length>=6) preview += '\n<span class="fade">...</span>';
    tip.innerHTML = preview.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    tip.style.display = 'block';
    var x = e.clientX + 18, y = e.clientY - 10;
    if (x+360 > window.innerWidth) x = e.clientX - 370;
    if (y+180 > window.innerHeight) y = window.innerHeight - 190;
    tip.style.left = x+'px';
    tip.style.top = y+'px';
  }, 400);
}

function tplUnhover() {
  clearTimeout(TPL_HOVER_TIMER);
  var tip = document.getElementById('tplPreviewTip');
  if (tip) tip.style.display = 'none';
}

function tplFilter(query) {
  tplRender(query||'');
}

var TPL_EDIT_KEY = null;
var TPL_EDIT_IDX = -1;

function tplOpenNewModal(prefillType) {
  TPL_EDIT_KEY = null; TPL_EDIT_IDX = -1;
  var sel = document.getElementById('tplNewType');
  if (!sel) return;
  sel.innerHTML = TPL_IMG_TYPES.map(function(t){
    return '<option value="'+t.key+'"'+(t.key===prefillType?' selected':'')+'>'+t.label_cn+' · '+t.module+'</option>';
  }).join('');
  sel.disabled = false;
  document.getElementById('tplNewName').value = '';
  document.getElementById('tplNewDesc').value = '';
  document.getElementById('tplNewPrompt').value = '';
  document.getElementById('tplModalTitle').textContent = '新建提示词模板';
  var modal = document.getElementById('tplNewModal');
  if (modal) modal.classList.add('open');
}

function tplOpenEditModal(tkey, index) {
  var items = TPL_DATA[tkey] && TPL_DATA[tkey].items ? TPL_DATA[tkey].items : [];
  if (index < 0 || index >= items.length) return;
  var it = items[index];
  TPL_EDIT_KEY = tkey;
  TPL_EDIT_IDX = index;
  var sel = document.getElementById('tplNewType');
  if (!sel) return;
  sel.innerHTML = TPL_IMG_TYPES.map(function(t){
    return '<option value="'+t.key+'"'+(t.key===tkey?' selected':'')+'>'+t.label_cn+' · '+t.module+'</option>';
  }).join('');
  sel.disabled = true;
  document.getElementById('tplNewName').value = it.name || '';
  document.getElementById('tplNewDesc').value = it.description || '';
  document.getElementById('tplNewPrompt').value = it.prompt || '';
  document.getElementById('tplModalTitle').textContent = '编辑提示词模板';
  var modal = document.getElementById('tplNewModal');
  if (modal) modal.classList.add('open');
}

function tplCloseNewModal() {
  var modal = document.getElementById('tplNewModal');
  if (modal) modal.classList.remove('open');
  TPL_EDIT_KEY = null; TPL_EDIT_IDX = -1;
}

async function tplSaveNew() {
  var type = document.getElementById('tplNewType').value;
  var name = document.getElementById('tplNewName').value.trim();
  var desc = document.getElementById('tplNewDesc').value.trim();
  var prompt = document.getElementById('tplNewPrompt').value.trim();
  if (!name) { showToast('请输入模板名称', 'error'); return; }
  if (!prompt) { showToast('请输入提示词内容', 'error'); return; }
  try {
    var isEdit = TPL_EDIT_KEY !== null && TPL_EDIT_IDX >= 0;
    var url, method, body;
    if (isEdit) {
      url = '/api/prompt-templates/' + TPL_EDIT_KEY + '/' + TPL_EDIT_IDX;
      method = 'PUT';
      body = JSON.stringify({name:name, prompt:prompt, description:desc});
    } else {
      url = '/api/prompt-templates';
      method = 'POST';
      body = JSON.stringify({type:type, name:name, prompt:prompt, description:desc});
    }
    var res = await fetch(url, {method:method, headers:{'Content-Type':'application/json'}, body:body});
    if (res.ok) {
      tplCloseNewModal();
      tplRefresh();
      showToast(isEdit ? '模板已更新' : '模板已保存', 'success');
    } else {
      var err = await res.json();
      showToast(err.error||'保存失败', 'error');
    }
  } catch(e){}
}

function tplSaveFromCard(promptIndex) {
  var ta = document.getElementById('promptText_'+promptIndex);
  if (!ta) return;
  var promptText = ta.value.trim();
  if (!promptText) { showToast('提示词为空', 'error'); return; }
  var card = ta.closest('.prompt-card');
  var ptypeEl = card ? card.querySelector('.ptype') : null;
  var ptypeText = ptypeEl ? ptypeEl.textContent : '';
  var matchedType = '';
  for (var i=0; i<TPL_IMG_TYPES.length; i++) {
    if (ptypeText.indexOf(TPL_IMG_TYPES[i].label_cn)>=0) { matchedType = TPL_IMG_TYPES[i].key; break; }
  }
  if (!matchedType) matchedType = 'main';
  var name = prompt('模板名称（便于识别）:', matchedType ? TPL_IMG_TYPES.filter(function(t){return t.key===matchedType;})[0].label_cn+' 模板' : '');
  if (!name || !name.trim()) return;
  var desc = prompt('备注说明（选填）:', '')||'';
  tplDoSave(matchedType, name.trim(), promptText, desc.trim());
}

async function tplDoSave(type, name, prompt, desc) {
  try {
    var res = await fetch('/api/prompt-templates', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:type,name:name,prompt:prompt,description:desc,asin:currentAsin||''})});
    if (res.ok) { tplRefresh(); showToast('已保存: '+name, 'success'); }
    else { var err = await res.json(); showToast(err.error||'保存失败', 'error'); }
  } catch(e){}
}

function tplBatchSave() {
  var checkboxes = document.querySelectorAll('.prompt-check:checked');
  if (checkboxes.length===0) { showToast('请先勾选要保存的提示词', 'error'); return; }
  var prefix = prompt('统一命名前缀（各条自动加序号）:', '');
  if (prefix===null) return;
  var batch = [];
  checkboxes.forEach(function(cb){
    var idx = parseInt(cb.getAttribute('data-pi'));
    var ta = document.getElementById('promptText_'+idx);
    if (!ta) return;
    var promptText = ta.value.trim();
    if (!promptText) return;
    var card = ta.closest('.prompt-card');
    var ptypeEl = card ? card.querySelector('.ptype') : null;
    var ptypeText = ptypeEl ? ptypeEl.textContent : '';
    var matchedType = '';
    for (var i=0; i<TPL_IMG_TYPES.length; i++) {
      if (ptypeText.indexOf(TPL_IMG_TYPES[i].label_cn)>=0) { matchedType = TPL_IMG_TYPES[i].key; break; }
    }
    if (!matchedType) return;
    batch.push({type:matchedType, name:(prefix||'模板')+(batch.length+1), prompt:promptText});
  });
  if (batch.length===0) { showToast('无有效提示词', 'error'); return; }
  tplDoBatchSave(batch);
}

async function tplDoBatchSave(batch) {
  try {
    var res = await fetch('/api/prompt-templates/batch', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(batch)});
    if (res.ok) { var data = await res.json(); tplRefresh(); showToast('批量保存 '+data.count+' 条', 'success'); }
  } catch(e){}
}

async function tplExport() {
  try {
    var res = await fetch('/api/prompt-templates/export', {method:'POST'});
    var data = await res.json();
    var blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'prompt-templates-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('模板已导出', 'success');
  } catch(e){}
}

async function tplImport(input) {
  var file = input.files[0];
  if (!file) return;
  try {
    var text = await file.text();
    var data = JSON.parse(text);
    if (!data.templates) { showToast('无效的模板文件', 'error'); return; }
    var res = await fetch('/api/prompt-templates/import', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    if (res.ok) {
      var result = await res.json();
      tplRefresh();
      showToast('导入: +'+result.added+' 跳过 '+result.skipped, 'success');
    }
  } catch(e){ showToast('导入失败: '+e.message, 'error'); }
  input.value = '';
}

function tplTimeAgo(iso) {
  if (!iso) return '';
  try {
    var dt = new Date(iso), now = new Date(), diff = now - dt;
    var mins = Math.floor(diff/60000);
    if (mins<1) return '刚刚';
    if (mins<60) return mins+' 分钟前';
    var hours = Math.floor(mins/60);
    if (hours<24) return hours+' 小时前';
    var days = Math.floor(hours/24);
    if (days<7) return days+' 天前';
    if (days<30) return Math.floor(days/7)+' 周前';
    return Math.floor(days/30)+' 月前';
  } catch(e){ return ''; }
}

// Patch loadPrompts: inject template selectors + batch toolbar after render
var _origLoadPrompts = loadPrompts;
loadPrompts = async function(jobId) {
  await _origLoadPrompts(jobId);
  setTimeout(function(){
    tplInjectSelectors();
    tplLoad();
  }, 100);
};

function tplInjectSelectors() {
  var promptList = document.getElementById('promptList');
  if (!promptList) return;
  // Batch toolbar
  if (!promptList.querySelector('.batch-bar')) {
    var bar = document.createElement('div');
    bar.className = 'batch-bar';
    bar.innerHTML = '<label><input type="checkbox" class="prompt-check" id="promptCheckAll" onchange="var c=this.checked;document.querySelectorAll(\'.prompt-check:not(#promptCheckAll)\').forEach(function(cb){cb.checked=c;});"> 全选</label><button class="btn-batch-save" onclick="tplBatchSave()">💾 批量保存</button><button class="btn-batch-new" onclick="tplOpenNewModal()">+ 新建模板</button>';
    promptList.insertBefore(bar, promptList.firstChild);
  }
  // Per-card: checkbox + template selector + save button
  var cards = promptList.querySelectorAll('.prompt-card');
  cards.forEach(function(card, i) {
    var ptypeEl = card.querySelector('.ptype');
    var ptypeText = ptypeEl ? ptypeEl.textContent : '';
    var tkey = '';
    for (var j=0; j<TPL_IMG_TYPES.length; j++) {
      if (ptypeText.indexOf(TPL_IMG_TYPES[j].label_cn)>=0) { tkey = TPL_IMG_TYPES[j].key; break; }
    }
    if (!tkey) return;
    card.setAttribute('data-tkey', tkey);
    // Checkbox on header
    if (!card.querySelector('.prompt-check')) {
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.className = 'prompt-check';
      cb.setAttribute('data-pi', i);
      ptypeEl.insertBefore(cb, ptypeEl.firstChild);
    }
    // Template selector
    var body = card.querySelector('.prompt-body');
    if (body && !body.querySelector('.tpl-sel-row')) {
      var items = (TPL_DATA[tkey] && TPL_DATA[tkey].items) ? TPL_DATA[tkey].items : [];
      var selRow = document.createElement('div');
      selRow.className = 'tpl-sel-row';
      var opts = '<option value="">无（使用本次生成）</option>';
      for (var k=0; k<items.length; k++) {
        opts += '<option value="'+k+'">'+escHtml(items[k].name)+(TPL_DEFAULTS[tkey]===k?' ⭐':'')+'</option>';
      }
      selRow.innerHTML = '<span class="sel-hint">模板:</span><select data-tpl-key="'+tkey+'">'+opts+'</select><span class="tpl-hint-en">图生图以英文提示词为主</span><button class="tpl-btn-cnen" onclick="translatePromptCNtoEN('+i+')" title="将右侧中文翻译为英文填入左侧">中→英</button><button class="copy-btn" onclick="copyPrompt('+i+')" title="复制英文" style="width:24px;height:24px;font-size:.7rem;flex-shrink:0;">📋</button>';
      if (TPL_DEFAULTS[tkey]!==undefined) {
        var defIdx = TPL_DEFAULTS[tkey];
        if (defIdx>=0 && defIdx<items.length) {
          selRow.querySelector('select').value = defIdx;
          var ta = body.querySelector('.ptext');
          if (ta && items[defIdx]) ta.value = items[defIdx].prompt;
        }
      }
      var txtArea = body.querySelector('.ptext');
      if (txtArea) txtArea.parentElement.insertBefore(selRow, txtArea);
    }
    // Save button
    var pactions = card.querySelector('.pactions');
    if (pactions && !pactions.querySelector('.btn-save-tpl')) {
      var saveBtn = document.createElement('button');
      saveBtn.className = 'btn-save-tpl';
      saveBtn.textContent = '存为模板';
      saveBtn.onclick = (function(idx){ return function(){ tplSaveFromCard(idx); }; })(i);
      pactions.appendChild(saveBtn);
    }
  });
}

// Event delegation for template item clicks (replaces inline onclick)
document.getElementById('tplScroll').addEventListener('click', function(e){
  var item = e.target.closest('.tpl-item');
  if (!item) return;
  var key = item.getAttribute('data-tpl-key');
  var idx = item.getAttribute('data-tpl-idx');
  if (key && idx !== null) tplSelect(key, idx);
});

// Event delegation for template selector dropdowns (replaces inline onchange)
document.getElementById('promptList').addEventListener('change', function(e){
  if (!e.target.matches('select[data-tpl-key]')) return;
  var key = e.target.getAttribute('data-tpl-key');
  var val = e.target.value;
  if (val !== '') tplSelect(key, val);
});
