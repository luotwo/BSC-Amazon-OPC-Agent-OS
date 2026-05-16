// ── White-BG Upload ──
var currentWbImageUrl = '';
var wbFileToUpload = null;
var wbUploadPendingPromptIndex = -1;
function openWbUploadPrompt(message) {
  document.getElementById('wbUploadMsg').textContent = message;
  document.getElementById('wbFileInput').value = '';
  document.getElementById('wbUploadPreview').style.display = 'none';
  document.getElementById('btnConfirmWb').disabled = true;
  document.getElementById('wbDropText').textContent = '拖拽图片到此处，或点击上传\n纯白背景 + 产品正面，JPG/PNG';
  wbFileToUpload = null;
  document.getElementById('wbUploadModal').classList.add('open');
}
function closeWbUpload() {
  document.getElementById('wbUploadModal').classList.remove('open');
  wbFileToUpload = null;
  wbUploadPendingPromptIndex = -1;
}
function onWbFileSelected(input) {
  if (input.files && input.files[0]) {
    wbFileToUpload = input.files[0];
    document.getElementById('wbDropText').textContent = wbFileToUpload.name;
    document.getElementById('btnConfirmWb').disabled = false;
    var reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('wbPreviewImg').src = e.target.result;
      document.getElementById('wbUploadPreview').style.display = 'block';
    };
    reader.readAsDataURL(wbFileToUpload);
  }
}
async function confirmWbUpload() {
  if (!wbFileToUpload || !currentAsin) return;
  var btn = document.getElementById('btnConfirmWb');
  btn.disabled = true; btn.textContent = '正在上传...';
  try {
    var formData = new FormData();
    formData.append('file', wbFileToUpload);
    formData.append('asin', currentAsin);
    var res = await fetch('/api/upload-wb-image', {method:'POST', body:formData});
    var data = await res.json();
    if (data.error) { alert('上传失败: ' + data.error); btn.disabled = false; btn.textContent = '确认使用此图'; return; }
    currentWbImageUrl = data.url;
    closeWbUpload();
    showToast('白底图已保存，请重新点击发送生成', 'success');
    // Refresh reference images
    if (currentJobId) loadRefImages(currentJobId);
  } catch(e) {
    alert('上传失败: ' + e.message);
    btn.disabled = false; btn.textContent = '确认使用此图';
  }
}
// Drag-and-drop
var wbDropZone = document.getElementById('wbDropZone');
if (wbDropZone) {
  wbDropZone.addEventListener('dragover', function(e){ e.preventDefault(); });
  wbDropZone.addEventListener('drop', function(e){
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      document.getElementById('wbFileInput').files = e.dataTransfer.files;
      onWbFileSelected(document.getElementById('wbFileInput'));
    }
  });
}
document.getElementById('wbUploadModal').addEventListener('click', function(e){if(e.target===this)closeWbUpload();});

// ── Image Preview Modal ──
function previewImage(url, name) {
  document.getElementById('previewModal').classList.add('open');
  document.getElementById('previewImg').src = url;
}
function closePreview() { document.getElementById('previewModal').classList.remove('open'); }
document.getElementById('previewModal').addEventListener('click', function(e){if(e.target===this)closePreview();});
