// ── Config ──────────────────────────────────────────────────────────────────
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMANt2wsFSywBL4pGRSaeb99LmBleWaCZCzuJlb-Io_gj_FZuRoI0KbhFYpu2miixL2Q/exec";
const AUTH_PASSWORD = new URLSearchParams(window.location.search).get('pwd') || '';
const TOTAL_SLOTS = 12;
const SLOT_PX = 600; // each magnet cell rendered at 600×600px

// ── State ────────────────────────────────────────────────────────────────────
let slotImages = new Array(TOTAL_SLOTS).fill(null); // base64 jpeg strings
let activeSlotIndex = null;
let modalCropper = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const uploadScreen    = document.getElementById('uploadScreen');
const cropScreen      = document.getElementById('cropScreen');
const sheetScreen     = document.getElementById('sheetScreen');
const successScreen   = document.getElementById('successScreen');
const imageInput      = document.getElementById('imageInput');
const cropBtn         = document.getElementById('cropBtn');
const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
const resetBtn        = document.getElementById('resetBtn');
const nameInput       = document.getElementById('nameInput');
const sheetGrid       = document.getElementById('sheetGrid');
const slotCountEl     = document.getElementById('slotCount');

// Modal refs
const cropModalOverlay  = document.getElementById('cropModalOverlay');
const cropModalImg      = document.getElementById('cropModalImg');
const cropModalConfirm  = document.getElementById('cropModalConfirm');
const cropModalCancel   = document.getElementById('cropModalCancel');

// ── Build slot grid ──────────────────────────────────────────────────────────
function buildGrid() {
  sheetGrid.innerHTML = '';
  slotImages.forEach((img, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (img ? ' filled' : '');
    slot.dataset.index = i;

    const numEl = document.createElement('span');
    numEl.className = 'slot-num';
    numEl.textContent = i + 1;

    const plusEl = document.createElement('span');
    plusEl.className = 'slot-plus';
    plusEl.textContent = '+';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'slot-remove';
    removeBtn.innerHTML = '×';
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      slotImages[i] = null;
      updateGrid();
    });

    if (img) {
      const imgEl = document.createElement('img');
      imgEl.src = 'data:image/jpeg;base64,' + img;
      slot.appendChild(imgEl);
    }

    slot.appendChild(plusEl);
    slot.appendChild(numEl);
    slot.appendChild(removeBtn);

    slot.addEventListener('click', () => openSlotPicker(i));
    sheetGrid.appendChild(slot);
  });

  const filled = slotImages.filter(Boolean).length;
  slotCountEl.textContent = filled;

  // Show generate button only when all 12 filled
  cropBtn.classList.toggle('hidden', filled < TOTAL_SLOTS);
  if (filled === TOTAL_SLOTS) {
    cropBtn.textContent = 'Generate print sheet →';
    cropBtn.className = 'btn btn-primary';
  }
}

function updateGrid() {
  buildGrid();
}

// ── Slot picker: hidden file input per slot ──────────────────────────────────
const slotFileInput = document.createElement('input');
slotFileInput.type = 'file';
slotFileInput.accept = 'image/*';
slotFileInput.style.display = 'none';
document.body.appendChild(slotFileInput);

function openSlotPicker(index) {
  activeSlotIndex = index;
  slotFileInput.value = '';
  slotFileInput.click();
}

slotFileInput.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file || activeSlotIndex === null) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    openCropModal(ev.target.result, activeSlotIndex);
  };
  reader.readAsDataURL(file);
});

// ── Crop modal ───────────────────────────────────────────────────────────────
function openCropModal(src, slotIndex) {
  cropModalImg.src = src;
  cropModalOverlay.classList.add('active');
  activeSlotIndex = slotIndex;

  if (modalCropper) modalCropper.destroy();
  modalCropper = new Cropper(cropModalImg, {
    aspectRatio: 1,
    viewMode: 1,
    autoCropArea: 0.95,
    responsive: true,
    background: false
  });
}

cropModalConfirm.addEventListener('click', function() {
  if (!modalCropper) return;
  const canvas = modalCropper.getCroppedCanvas({
    width: SLOT_PX,
    height: SLOT_PX,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  slotImages[activeSlotIndex] = dataUrl.split(',')[1];
  closeCropModal();
  updateGrid();
});

cropModalCancel.addEventListener('click', closeCropModal);

function closeCropModal() {
  cropModalOverlay.classList.remove('active');
  if (modalCropper) { modalCropper.destroy(); modalCropper = null; }
  cropModalImg.src = '';
}

// ── First photo upload → straight to sheet ───────────────────────────────────
imageInput.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  // Go straight to sheet builder; first slot will be filled via crop modal
  uploadScreen.classList.add('hidden');
  cropBtn.classList.add('hidden');
  sheetScreen.classList.remove('hidden');
  sheetScreen.style.display = 'flex';
  buildGrid();

  // Immediately open crop for slot 0
  const reader = new FileReader();
  reader.onload = ev => openCropModal(ev.target.result, 0);
  reader.readAsDataURL(file);
});

// ── Generate sheet canvas ────────────────────────────────────────────────────
// Output: 2550 × 3300 px = 8.5 × 11 in @ 300 DPI
// 12 cells in a 4×3 grid with margins
cropBtn.addEventListener('click', function() {
  if (slotImages.filter(Boolean).length < TOTAL_SLOTS) return;

  cropBtn.disabled = true;
  cropBtn.textContent = 'Building sheet…';

  const DPI = 300;
  const sheetW = Math.round(8.5 * DPI);   // 2550
  const sheetH = Math.round(11 * DPI);    // 3300
  const cols = 4, rows = 3;
  const marginX = Math.round(0.25 * DPI); // 75px side margin
  const marginY = Math.round(0.5 * DPI);  // 150px top/bottom
  const gapX = Math.round(0.08 * DPI);
  const gapY = Math.round(0.08 * DPI);
  const cellW = Math.round((sheetW - 2 * marginX - (cols - 1) * gapX) / cols);
  const cellH = Math.round((sheetH - 2 * marginY - (rows - 1) * gapY) / rows);

  const canvas = document.createElement('canvas');
  canvas.width = sheetW;
  canvas.height = sheetH;
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheetW, sheetH);

  // Draw dashed cut guides
  ctx.strokeStyle = '#bbbbbb';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);

  // Load all images then draw
  let loaded = 0;
  const imgEls = slotImages.map((b64, i) => {
    const img = new Image();
    img.onload = function() {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = marginX + col * (cellW + gapX);
      const y = marginY + row * (cellH + gapY);
      ctx.drawImage(img, x, y, cellW, cellH);

      // Dashed border around cell
      ctx.strokeRect(x, y, cellW, cellH);

      loaded++;
      if (loaded === TOTAL_SLOTS) finishSheet(canvas);
    };
    img.src = 'data:image/jpeg;base64,' + b64;
    return img;
  });
});

function finishSheet(canvas) {
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const base64 = dataUrl.split(',')[1];

  sheetScreen.classList.add('hidden');
  sheetScreen.style.display = '';
  successScreen.classList.remove('hidden');
  successScreen.style.display = 'flex';
  cropBtn.classList.add('hidden');
  cropBtn.disabled = false;

  // Store for upload
  window._sheetBase64 = base64;
}

// ── Upload sheet to Drive ────────────────────────────────────────────────────
uploadSubmitBtn.addEventListener('click', function() {
  if (!window._sheetBase64) return;

  uploadSubmitBtn.disabled = true;
  uploadSubmitBtn.innerText = 'Uploading to Drive…';
  uploadSubmitBtn.className = 'btn btn-uploading';

  const payload = new FormData();
  payload.append('base64Data', window._sheetBase64);
  payload.append('pwd', AUTH_PASSWORD);
  payload.append('name', nameInput.value.trim() || 'unknown');

  fetch(GOOGLE_SCRIPT_URL, {
    method: 'POST',
    body: payload,
    redirect: 'follow'
  })
  .then(r => r.json())
  .then(data => {
    if (data.status === 'success') {
      uploadSubmitBtn.innerText = 'Upload complete — check Drive ✓';
      uploadSubmitBtn.className = 'btn btn-success';
    } else {
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.innerText = 'Upload failed — try again';
      uploadSubmitBtn.className = 'btn btn-error';
    }
  })
  .catch(err => {
    console.error('Upload error:', err);
    uploadSubmitBtn.disabled = false;
    uploadSubmitBtn.innerText = 'Upload failed — try again';
    uploadSubmitBtn.className = 'btn btn-error';
  });
});

// ── Reset ────────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', function() {
  slotImages = new Array(TOTAL_SLOTS).fill(null);
  window._sheetBase64 = null;
  activeSlotIndex = null;
  imageInput.value = '';
  nameInput.value = '';
  uploadSubmitBtn.disabled = false;
  uploadSubmitBtn.innerText = 'Upload sheet to Google Drive';
  uploadSubmitBtn.className = 'btn btn-dark';
  successScreen.classList.add('hidden');
  successScreen.style.display = '';
  sheetScreen.classList.add('hidden');
  sheetScreen.style.display = '';
  cropScreen.classList.add('hidden');
  cropBtn.classList.add('hidden');
  cropBtn.textContent = 'Generate print sheet →';
  uploadScreen.classList.remove('hidden');
});
