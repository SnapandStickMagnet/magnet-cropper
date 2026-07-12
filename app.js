// ── Config ──────────────────────────────────────────────────────────────────
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMANt2wsFSywBL4pGRSaeb99LmBleWaCZCzuJlb-Io_gj_FZuRoI0KbhFYpu2miixL2Q/exec";
const AUTH_PASSWORD = new URLSearchParams(window.location.search).get('pwd') || '';
const TOTAL_SLOTS = 12;

// ── Sheet geometry ────────────────────────────────────────────────────────────
// Each cell = exactly 2×2" = 600×600 px at 300 DPI.
// Sheet = 8.5×11" = 2550×3300 px.
// 4 cols × 3 rows. Gap between cells = 1/8" = 37.5 → 38px (gives room for crop marks).
// Content block centred on sheet.
const DPI       = 300;
const CELL      = 600;           // 2" × 300 DPI
const COLS      = 4;
const ROWS      = 3;
const SHEET_W   = Math.round(8.5 * DPI);   // 2550
const SHEET_H   = Math.round(11  * DPI);   // 3300
const GAP       = Math.round(0.125 * DPI); // 1/8" = 37px between cells
const CONTENT_W = COLS * CELL + (COLS - 1) * GAP;
const CONTENT_H = ROWS * CELL + (ROWS - 1) * GAP;
const ORIGIN_X  = Math.round((SHEET_W - CONTENT_W) / 2);
const ORIGIN_Y  = Math.round((SHEET_H - CONTENT_H) / 2);

// Crop mark settings
const MARK_LEN   = Math.round(0.125 * DPI); // how far the tick extends outside the cell (1/8")
const MARK_GAP   = Math.round(0.03  * DPI); // small gap between cell edge and start of tick (about 9px)
const MARK_WIDTH = 1.5;                      // stroke width in px
const MARK_COLOR = '#222222';                // near-black

// ── State ────────────────────────────────────────────────────────────────────
let slotImages      = new Array(TOTAL_SLOTS).fill(null);
let activeSlotIndex = null;
let modalCropper    = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────
const uploadScreen     = document.getElementById('uploadScreen');
const cropScreen       = document.getElementById('cropScreen');
const sheetScreen      = document.getElementById('sheetScreen');
const successScreen    = document.getElementById('successScreen');
const imageInput       = document.getElementById('imageInput');
const cropBtn          = document.getElementById('cropBtn');
const uploadSubmitBtn  = document.getElementById('uploadSubmitBtn');
const resetBtn         = document.getElementById('resetBtn');
const nameInput        = document.getElementById('nameInput');
const sheetGrid        = document.getElementById('sheetGrid');
const slotCountEl      = document.getElementById('slotCount');
const cropModalOverlay = document.getElementById('cropModalOverlay');
const cropModalImg     = document.getElementById('cropModalImg');
const cropModalConfirm = document.getElementById('cropModalConfirm');
const cropModalCancel  = document.getElementById('cropModalCancel');

// ── Grid ─────────────────────────────────────────────────────────────────────
function buildGrid() {
  sheetGrid.innerHTML = '';
  slotImages.forEach((img, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (img ? ' filled' : '');
    slot.dataset.index = i;

    const plusEl = document.createElement('span');
    plusEl.className = 'slot-plus';
    plusEl.textContent = '+';

    const numEl = document.createElement('span');
    numEl.className = 'slot-num';
    numEl.textContent = i + 1;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'slot-remove';
    removeBtn.innerHTML = '×';
    removeBtn.addEventListener('click', e => {
      e.stopPropagation();
      slotImages[i] = null;
      buildGrid();
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

  if (filled >= 1) {
    cropBtn.classList.remove('hidden');
    cropBtn.textContent = `Generate sheet (${filled} photo${filled === 1 ? '' : 's'}) →`;
    cropBtn.className = 'btn btn-primary';
  } else {
    cropBtn.classList.add('hidden');
  }
}

// ── Slot picker ───────────────────────────────────────────────────────────────
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
  reader.onload = ev => openCropModal(ev.target.result, activeSlotIndex);
  reader.readAsDataURL(file);
});

// ── Crop modal ────────────────────────────────────────────────────────────────
function openCropModal(src, slotIndex) {
  cropModalImg.src = src;
  cropModalOverlay.classList.add('active');
  activeSlotIndex = slotIndex;
  if (modalCropper) modalCropper.destroy();
  modalCropper = new Cropper(cropModalImg, {
    aspectRatio: 1,
    viewMode: 1,
    autoCropArea: 0.9,
    responsive: true,
    background: false
  });
}

cropModalConfirm.addEventListener('click', function() {
  if (!modalCropper) return;
  const canvas = modalCropper.getCroppedCanvas({
    width: CELL,
    height: CELL,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    fillColor: '#ffffff'
  });
  slotImages[activeSlotIndex] = canvas.toDataURL('image/jpeg', 0.92).split(',')[1];
  closeCropModal();
  buildGrid();
});

cropModalCancel.addEventListener('click', closeCropModal);

function closeCropModal() {
  cropModalOverlay.classList.remove('active');
  if (modalCropper) { modalCropper.destroy(); modalCropper = null; }
  cropModalImg.src = '';
}

// ── First upload ──────────────────────────────────────────────────────────────
imageInput.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  uploadScreen.classList.add('hidden');
  cropBtn.classList.add('hidden');
  sheetScreen.classList.remove('hidden');
  sheetScreen.style.display = 'flex';
  buildGrid();
  const reader = new FileReader();
  reader.onload = ev => openCropModal(ev.target.result, 0);
  reader.readAsDataURL(file);
});

// ── Draw L-shaped crop marks around a cell ────────────────────────────────────
// (x, y) = top-left corner of the cell on the canvas
function drawCropMarks(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = MARK_COLOR;
  ctx.lineWidth   = MARK_WIDTH;
  ctx.setLineDash([]);  // solid lines

  const s = MARK_GAP;   // gap between cell edge and tick start
  const e = s + MARK_LEN; // how far the tick extends beyond cell

  // Top-left corner
  ctx.beginPath(); ctx.moveTo(x - e, y); ctx.lineTo(x - s, y); ctx.stroke(); // horizontal
  ctx.beginPath(); ctx.moveTo(x, y - e); ctx.lineTo(x, y - s); ctx.stroke(); // vertical

  // Top-right corner
  ctx.beginPath(); ctx.moveTo(x + CELL + s, y); ctx.lineTo(x + CELL + e, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + CELL, y - e); ctx.lineTo(x + CELL, y - s); ctx.stroke();

  // Bottom-left corner
  ctx.beginPath(); ctx.moveTo(x - e, y + CELL); ctx.lineTo(x - s, y + CELL); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + CELL + s); ctx.lineTo(x, y + CELL + e); ctx.stroke();

  // Bottom-right corner
  ctx.beginPath(); ctx.moveTo(x + CELL + s, y + CELL); ctx.lineTo(x + CELL + e, y + CELL); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + CELL, y + CELL + s); ctx.lineTo(x + CELL, y + CELL + e); ctx.stroke();

  ctx.restore();
}

// ── Generate sheet ────────────────────────────────────────────────────────────
cropBtn.addEventListener('click', function() {
  const filled = slotImages.filter(Boolean).length;
  if (filled < 1) return;

  cropBtn.disabled = true;
  cropBtn.textContent = 'Building sheet…';

  const canvas = document.createElement('canvas');
  canvas.width  = SHEET_W;
  canvas.height = SHEET_H;
  const ctx = canvas.getContext('2d');

  // White sheet
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);

  // Draw all crop marks first (so they sit under the photos on filled slots)
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = ORIGIN_X + col * (CELL + GAP);
    const y = ORIGIN_Y + row * (CELL + GAP);
    drawCropMarks(ctx, x, y);
  }

  const toLoad = slotImages.filter(Boolean).length;
  if (toLoad === 0) { finishSheet(canvas); return; }

  let loaded = 0;
  slotImages.forEach((b64, i) => {
    if (!b64) return;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = ORIGIN_X + col * (CELL + GAP);
    const y = ORIGIN_Y + row * (CELL + GAP);

    const img = new Image();
    img.onload = function() {
      // Draw photo (exactly CELL×CELL — guaranteed square from cropper)
      ctx.drawImage(img, x, y, CELL, CELL);

      // Re-draw crop marks on top so they remain visible over the photo edge
      drawCropMarks(ctx, x, y);

      loaded++;
      if (loaded === toLoad) finishSheet(canvas);
    };
    img.src = 'data:image/jpeg;base64,' + b64;
  });
});

function finishSheet(canvas) {
  window._sheetBase64 = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
  sheetScreen.classList.add('hidden');
  sheetScreen.style.display = '';
  successScreen.classList.remove('hidden');
  successScreen.style.display = 'flex';
  cropBtn.classList.add('hidden');
  cropBtn.disabled = false;
}

// ── Upload ────────────────────────────────────────────────────────────────────
uploadSubmitBtn.addEventListener('click', function() {
  if (!window._sheetBase64) return;
  uploadSubmitBtn.disabled = true;
  uploadSubmitBtn.innerText = 'Uploading to Drive…';
  uploadSubmitBtn.className = 'btn btn-uploading';

  const payload = new FormData();
  payload.append('base64Data', window._sheetBase64);
  payload.append('pwd', AUTH_PASSWORD);
  payload.append('name', nameInput.value.trim() || 'unknown');

  fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: payload, redirect: 'follow' })
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

// ── Reset ─────────────────────────────────────────────────────────────────────
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
  cropBtn.classList.add('hidden');
  uploadScreen.classList.remove('hidden');
});
