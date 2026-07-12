// ── Config ──────────────────────────────────────────────────────────────────
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMANt2wsFSywBL4pGRSaeb99LmBleWaCZCzuJlb-Io_gj_FZuRoI0KbhFYpu2miixL2Q/exec";
const AUTH_PASSWORD = new URLSearchParams(window.location.search).get('pwd') || '';
const TOTAL_SLOTS = 12;

// ── Sheet geometry ────────────────────────────────────────────────────────────
// Each cell = exactly 50×50mm at 300 DPI.
// 50mm × (300 / 25.4) = 590.55 → 591px
// Sheet = 8.5×11" = 2550×3300 px.
// 4 cols × 3 rows. Gap between cells = ~3mm = 35px.
// BORDER: thin solid grey line drawn right on each cell edge as cut guide.
// ROUNDED CORNERS: clipped to match the Chinese 50mm press radius (~3mm).
const DPI         = 300;
const MM_TO_PX    = DPI / 25.4;              // 11.811 px per mm
const CELL        = Math.round(50 * MM_TO_PX); // 591px — exactly 50mm
const COLS        = 4;
const ROWS        = 3;
const SHEET_W     = Math.round(8.5 * DPI);   // 2550
const SHEET_H     = Math.round(11  * DPI);   // 3300
const GAP         = Math.round(3 * MM_TO_PX);  // 3mm gap between cells = 35px
const CONTENT_W   = COLS * CELL + (COLS - 1) * GAP;
const CONTENT_H   = ROWS * CELL + (ROWS - 1) * GAP;
const ORIGIN_X    = Math.round((SHEET_W - CONTENT_W) / 2);
const ORIGIN_Y    = Math.round((SHEET_H - CONTENT_H) / 2);
const CORNER_R    = Math.round(3 * MM_TO_PX); // 3mm radius = 35px — standard Chinese 50mm press
const BORDER_W    = 5;                         // thicker border = more visible cut line
const BORDER_COLOR = '#555555';                // darker grey — clearer cut guide

// Tick marks: short lines extending outside each cell corner into the gap
const TICK_LEN  = Math.round(2.5 * MM_TO_PX); // 2.5mm tick length
const TICK_GAP  = Math.round(0.8 * MM_TO_PX); // small gap between photo edge and tick start
const TICK_W    = 2.5;
const TICK_COLOR = '#333333';

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
const phoneInput       = document.getElementById('phoneInput');
const emailInput       = document.getElementById('emailInput');
const notesInput       = document.getElementById('notesInput');
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
    cropBtn.textContent = `Select Photos (${filled} chosen) →`;
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
    width: CELL,   // 591px = exactly 50mm at 300 DPI
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

// ── Draw a rounded-rect path helper ─────────────────────────────────────────
function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,     x + r, y,     r);
  ctx.closePath();
}

// ── Draw corner tick cutting guides outside a cell ───────────────────────────
// These extend into the gap area so you can see where to cut
function drawCutTicks(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = TICK_COLOR;
  ctx.lineWidth   = TICK_W;
  ctx.setLineDash([]);

  const s = TICK_GAP;           // gap from cell edge to tick start
  const e = s + TICK_LEN;       // tick end distance from cell edge

  // Top-left
  ctx.beginPath(); ctx.moveTo(x - e, y); ctx.lineTo(x - s, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - e); ctx.lineTo(x, y - s); ctx.stroke();
  // Top-right
  ctx.beginPath(); ctx.moveTo(x + CELL + s, y); ctx.lineTo(x + CELL + e, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + CELL, y - e); ctx.lineTo(x + CELL, y - s); ctx.stroke();
  // Bottom-left
  ctx.beginPath(); ctx.moveTo(x - e, y + CELL); ctx.lineTo(x - s, y + CELL); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y + CELL + s); ctx.lineTo(x, y + CELL + e); ctx.stroke();
  // Bottom-right
  ctx.beginPath(); ctx.moveTo(x + CELL + s, y + CELL); ctx.lineTo(x + CELL + e, y + CELL); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + CELL, y + CELL + s); ctx.lineTo(x + CELL, y + CELL + e); ctx.stroke();

  ctx.restore();
}

// ── Draw one cell: photo clipped to rounded rect + thick border + tick marks ──
function drawCell(ctx, img, x, y) {
  ctx.save();

  if (img) {
    // Clip to rounded rect then draw photo
    roundedRect(ctx, x, y, CELL, CELL, CORNER_R);
    ctx.clip();
    ctx.drawImage(img, x, y, CELL, CELL);
    ctx.restore();
    ctx.save();
  }

  // Thick rounded border on top — this IS the cut line
  roundedRect(ctx, x, y, CELL, CELL, CORNER_R);
  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth   = BORDER_W;
  ctx.stroke();

  ctx.restore();

  // Corner tick marks outside the cell in the gap area
  drawCutTicks(ctx, x, y);
}

// ── Generate sheet ────────────────────────────────────────────────────────────
cropBtn.addEventListener('click', function() {
  const filled = slotImages.filter(Boolean).length;
  if (filled < 1) return;

  cropBtn.disabled = true;
  cropBtn.textContent = 'Preparing photos…';

  const canvas = document.createElement('canvas');
  canvas.width  = SHEET_W;
  canvas.height = SHEET_H;
  const ctx = canvas.getContext('2d');

  // White sheet background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);

  // Draw empty slots immediately (white fill + border)
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    if (!slotImages[i]) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x   = ORIGIN_X + col * (CELL + GAP);
      const y   = ORIGIN_Y + row * (CELL + GAP);
      drawCell(ctx, null, x, y);
    }
  }

  // Load and draw filled slots
  const toLoad = slotImages.filter(Boolean).length;
  if (toLoad === 0) { finishSheet(canvas); return; }

  let loaded = 0;
  slotImages.forEach((b64, i) => {
    if (!b64) return;
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x   = ORIGIN_X + col * (CELL + GAP);
    const y   = ORIGIN_Y + row * (CELL + GAP);

    const img = new Image();
    img.onload = function() {
      drawCell(ctx, img, x, y);
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

  const name  = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const email = emailInput.value.trim();
  const formError = document.getElementById('formError');

  // Clear previous invalid states
  [nameInput, phoneInput, emailInput].forEach(el => el.classList.remove('invalid'));
  formError.style.display = 'none';

  // Validate — all three required
  let valid = true;
  if (!name)                        { nameInput.classList.add('invalid');  valid = false; }
  if (!phone)                       { phoneInput.classList.add('invalid'); valid = false; }
  if (!email || !email.includes('@')) { emailInput.classList.add('invalid'); valid = false; }

  if (!valid) {
    formError.style.display = 'block';
    // Scroll error into view on mobile
    formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return; // hard stop — do not proceed
  }

  uploadSubmitBtn.disabled = true;
  uploadSubmitBtn.innerText = 'Submitting…';
  uploadSubmitBtn.className = 'btn btn-uploading';

  const payload = new FormData();
  payload.append('base64Data', window._sheetBase64);
  payload.append('pwd',   AUTH_PASSWORD);
  payload.append('name',  name);
  payload.append('phone', phone);
  payload.append('email', email);
  payload.append('notes', notesInput.value.trim());

  fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: payload, redirect: 'follow' })
    .then(r => r.json())
    .then(data => {
      if (data.status === 'success') {
        uploadSubmitBtn.innerText = 'Photos Submitted ✓';
        uploadSubmitBtn.className = 'btn btn-success';
      } else {
        uploadSubmitBtn.disabled = false;
        uploadSubmitBtn.innerText = 'Submission failed — try again';
        uploadSubmitBtn.className = 'btn btn-error';
      }
    })
    .catch(err => {
      console.error('Upload error:', err);
      uploadSubmitBtn.disabled = false;
      uploadSubmitBtn.innerText = 'Submission failed — try again';
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
  phoneInput.value = '';
  emailInput.value = '';
  notesInput.value = '';
  [nameInput, phoneInput, emailInput].forEach(el => el.classList.remove('invalid'));
  document.getElementById('formError').style.display = 'none';
  uploadSubmitBtn.disabled = false;
  uploadSubmitBtn.innerText = 'Submit Photos';
  uploadSubmitBtn.className = 'btn btn-dark';
  successScreen.classList.add('hidden');
  successScreen.style.display = '';
  sheetScreen.classList.add('hidden');
  sheetScreen.style.display = '';
  cropBtn.classList.add('hidden');
  uploadScreen.classList.remove('hidden');
});
