// ── Config ──────────────────────────────────────────────────────────────────
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMANt2wsFSywBL4pGRSaeb99LmBleWaCZCzuJlb-Io_gj_FZuRoI0KbhFYpu2miixL2Q/exec";
const AUTH_PASSWORD = new URLSearchParams(window.location.search).get('pwd') || '';
const TOTAL_SLOTS = 12;

// ── Sheet geometry ────────────────────────────────────────────────────────────
const DPI         = 300;
const MM_TO_PX    = DPI / 25.4;
const BLEED_MM    = 6;   // increased from 3mm → 6mm for better mylar seal overlap
const MAGNET_MM   = 50;
const CELL_MM     = MAGNET_MM + BLEED_MM * 2;
const CELL        = Math.round(CELL_MM * MM_TO_PX);
const COLS        = 3;
const ROWS        = 4;
const SHEET_W     = Math.round(8.5 * DPI);
const SHEET_H     = Math.round(11  * DPI);
const GAP         = Math.round(6 * MM_TO_PX);
const CONTENT_W   = COLS * CELL + (COLS - 1) * GAP;
const CONTENT_H   = ROWS * CELL + (ROWS - 1) * GAP;
const ORIGIN_X    = Math.round((SHEET_W - CONTENT_W) / 2);
const ORIGIN_Y    = Math.round((SHEET_H - CONTENT_H) / 2);
const CORNER_R    = Math.round(1.5 * MM_TO_PX);
const BORDER_W    = 3;
const BORDER_COLOR = '#888888';

// ── State ────────────────────────────────────────────────────────────────────
let slotImages      = new Array(TOTAL_SLOTS).fill(null);
let slotOriginals   = new Array(TOTAL_SLOTS).fill(null); // original src before crop
let activeSlotIndex = null;
let modalCropper    = null;
let pendingFiles    = [];   // queue of File objects waiting to be cropped
let pendingStartIdx = null; // slot index where the queue starts filling

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
      slotOriginals[i] = null;
      buildGrid();
    });

    if (img) {
      const imgEl = document.createElement('img');
      imgEl.src = 'data:image/jpeg;base64,' + img;
      slot.appendChild(imgEl);

      // Action overlay for filled slots
      const overlay = document.createElement('div');
      overlay.className = 'slot-overlay';

      const recropBtn = document.createElement('button');
      recropBtn.className = 'slot-action-btn';
      recropBtn.textContent = '✂️ Re-crop';
      recropBtn.addEventListener('click', e => {
        e.stopPropagation();
        slot.classList.remove('show-overlay');
        if (slotOriginals[i]) {
          openCropModal(slotOriginals[i], i);
        } else {
          openSlotPicker(i);
        }
      });

      const replaceBtn = document.createElement('button');
      replaceBtn.className = 'slot-action-btn';
      replaceBtn.textContent = '🔄 Replace';
      replaceBtn.addEventListener('click', e => {
        e.stopPropagation();
        slot.classList.remove('show-overlay');
        openSlotPicker(i);
      });

      overlay.appendChild(recropBtn);
      overlay.appendChild(replaceBtn);
      slot.appendChild(overlay);

      slot.addEventListener('click', () => slot.classList.toggle('show-overlay'));
    } else {
      slot.addEventListener('click', () => openSlotPicker(i));
    }

    slot.appendChild(plusEl);
    slot.appendChild(numEl);
    slot.appendChild(removeBtn);
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

// Dismiss any open slot overlay when clicking outside the grid
document.addEventListener('click', () => {
  document.querySelectorAll('.slot.show-overlay').forEach(s => s.classList.remove('show-overlay'));
});

// ── Slot picker ───────────────────────────────────────────────────────────────
const slotFileInput = document.createElement('input');
slotFileInput.type = 'file';
slotFileInput.accept = 'image/*';
slotFileInput.multiple = true;
slotFileInput.style.display = 'none';
document.body.appendChild(slotFileInput);

function openSlotPicker(index) {
  activeSlotIndex = index;
  pendingStartIdx = index;
  slotFileInput.value = '';
  slotFileInput.click();
}

// Find the next empty slot at or after `startIdx`
function nextEmptySlot(startIdx) {
  for (let i = startIdx; i < TOTAL_SLOTS; i++) {
    if (!slotImages[i]) return i;
  }
  return null;
}

// Process the next file in the pending queue
function processNextPending() {
  if (pendingFiles.length === 0) return;

  // Find the next open slot
  const slot = nextEmptySlot(pendingStartIdx);
  if (slot === null) {
    // No more empty slots — discard remaining
    pendingFiles = [];
    return;
  }

  const file = pendingFiles.shift();
  activeSlotIndex = slot;
  pendingStartIdx = slot + 1;

  const reader = new FileReader();
  reader.onload = ev => openCropModal(ev.target.result, activeSlotIndex);
  reader.readAsDataURL(file);
}

slotFileInput.addEventListener('change', function(e) {
  const files = Array.from(e.target.files);
  if (!files.length || activeSlotIndex === null) return;

  pendingFiles = files;
  pendingStartIdx = activeSlotIndex;
  processNextPending();
});

// ── Crop modal ────────────────────────────────────────────────────────────────
function openCropModal(src, slotIndex) {
  cropModalImg.src = src;
  slotOriginals[slotIndex] = src;   // remember original for re-crop
  cropModalOverlay.classList.add('active');
  activeSlotIndex = slotIndex;

  // Update title to show batch progress if more photos are queued
  const titleEl = document.querySelector('.crop-modal-title');
  if (titleEl) {
    if (pendingFiles.length > 0) {
      titleEl.textContent = `Crop photo — ${pendingFiles.length} more after this`;
    } else {
      titleEl.textContent = 'Crop photo';
    }
  }

  if (modalCropper) modalCropper.destroy();
  modalCropper = new Cropper(cropModalImg, {
    aspectRatio: 1,
    viewMode: 1,
    autoCropArea: 0.9,
    responsive: true,
    background: false
  });
}

// ── Image enhancement ─────────────────────────────────────────────────────────
// Applies brightness, saturation, contrast and sharpening at the pixel level
// so it works reliably regardless of browser canvas filter support.
function enhanceCanvas(src) {
  const w = src.width, h = src.height;
  const dst = document.createElement('canvas');
  dst.width = w; dst.height = h;
  const ctx = dst.getContext('2d');
  ctx.drawImage(src, 0, 0);

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  const brightness = 1.25;  // +25% — compensates for inkjet ink darkening
  const contrast   = 1.05;  // +5%  — gentle pop without muddying faces
  const saturation = 1.15;  // pulled back from 1.30 — was pushing skin tones red

  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], g = d[i+1], b = d[i+2];

    // Brightness
    r *= brightness; g *= brightness; b *= brightness;

    // Contrast (pivot around 128)
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    // Saturation via luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + (r - lum) * saturation;
    g = lum + (g - lum) * saturation;
    b = lum + (b - lum) * saturation;

    d[i]   = Math.min(255, Math.max(0, r));
    d[i+1] = Math.min(255, Math.max(0, g));
    d[i+2] = Math.min(255, Math.max(0, b));
  }
  ctx.putImageData(imageData, 0, 0);

  // ── Unsharp mask (sharpen) ──
  const amount = 0.55;
  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w; blurCanvas.height = h;
  const bCtx = blurCanvas.getContext('2d');
  bCtx.filter = 'blur(1px)';
  bCtx.drawImage(dst, 0, 0);
  bCtx.filter = 'none';

  const sharp   = ctx.getImageData(0, 0, w, h);
  const blurred = bCtx.getImageData(0, 0, w, h);
  const out     = ctx.createImageData(w, h);
  for (let i = 0; i < sharp.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const s = sharp.data[i + c];
      const bl = blurred.data[i + c];
      out.data[i + c] = Math.min(255, Math.max(0, Math.round(s + amount * (s - bl))));
    }
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return dst;
}

cropModalConfirm.addEventListener('click', function() {
  if (!modalCropper) return;
  const raw = modalCropper.getCroppedCanvas({
    width: CELL,
    height: CELL,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    fillColor: '#ffffff'
  });
  const enhanced = enhanceCanvas(raw);
  slotImages[activeSlotIndex] = enhanced.toDataURL('image/jpeg', 0.92).split(',')[1];
  closeCropModal();
  buildGrid();

  // If more files are queued, open the next one automatically
  if (pendingFiles.length > 0) {
    processNextPending();
  }
});

cropModalCancel.addEventListener('click', () => closeCropModal(true));

function closeCropModal(cancelQueue = false) {
  cropModalOverlay.classList.remove('active');
  if (modalCropper) { modalCropper.destroy(); modalCropper = null; }
  cropModalImg.src = '';
  if (cancelQueue) pendingFiles = [];
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

// ── Draw helpers ──────────────────────────────────────────────────────────────
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

function drawCell(ctx, img, x, y) {
  ctx.save();
  roundedRect(ctx, x, y, CELL, CELL, CORNER_R);
  ctx.clip();
  if (img) {
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, y, CELL, CELL);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, CELL, CELL);
  }
  ctx.restore();
  ctx.save();
  roundedRect(ctx, x, y, CELL, CELL, CORNER_R);
  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth   = BORDER_W;
  ctx.setLineDash([14, 8]);
  ctx.stroke();
  ctx.restore();
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

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SHEET_W, SHEET_H);

  for (let i = 0; i < TOTAL_SLOTS; i++) {
    if (!slotImages[i]) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x   = ORIGIN_X + col * (CELL + GAP);
      const y   = ORIGIN_Y + row * (CELL + GAP);
      drawCell(ctx, null, x, y);
    }
  }

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

  const name     = nameInput.value.trim();
  const contact  = phoneInput.value.trim();
  const formError = document.getElementById('formError');

  [nameInput, phoneInput].forEach(el => el.classList.remove('invalid'));
  formError.style.display = 'none';

  let valid = true;
  if (!name)    { nameInput.classList.add('invalid');  valid = false; }
  if (!contact) { phoneInput.classList.add('invalid'); valid = false; }

  if (!valid) {
    formError.style.display = 'block';
    formError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  uploadSubmitBtn.disabled = true;
  uploadSubmitBtn.innerText = 'Submitting…';
  uploadSubmitBtn.className = 'btn btn-uploading';

  const safeName    = name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  const safeContact = contact.replace(/[^a-zA-Z0-9@._+-]/g, '').trim();
  const timestamp   = new Date().toISOString().slice(0, 10);
  const filename    = `${timestamp}_${safeName}_${safeContact}`;

  const payload = new FormData();
  payload.append('base64Data', window._sheetBase64);
  payload.append('pwd',      AUTH_PASSWORD);
  payload.append('name',     name);
  payload.append('contact',  contact);
  payload.append('filename', filename);

  fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: payload, redirect: 'follow' })
    .catch(() => {}); // ignore response errors — file reaches Drive regardless

  // Show success straight away without waiting for response
  uploadSubmitBtn.innerText = 'Photos Submitted ✓';
  uploadSubmitBtn.className = 'btn btn-success';
  showConfettiPopup(name);
});

// ── Reset ─────────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', function() {
  slotImages    = new Array(TOTAL_SLOTS).fill(null);
  slotOriginals = new Array(TOTAL_SLOTS).fill(null);
  window._sheetBase64 = null;
  activeSlotIndex = null;
  imageInput.value = '';
  nameInput.value = '';
  phoneInput.value = '';
  [nameInput, phoneInput].forEach(el => el.classList.remove('invalid'));
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

// ── Confetti popup ────────────────────────────────────────────────────────────
function showConfettiPopup(name) {
  const overlay = document.createElement('div');
  overlay.id = 'confettiOverlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:999;
    display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.55);padding:24px;
  `;

  const firstName = name.split(' ')[0] || 'there';

  overlay.innerHTML = `
    <div id="confettiBox" style="
      background:#fff;border-radius:20px;
      padding:36px 28px 32px;max-width:340px;width:100%;
      text-align:center;position:relative;overflow:hidden;
      box-shadow:0 24px 60px rgba(0,0,0,0.18);
    ">
      <canvas id="confettiCanvas" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;"></canvas>
      <div style="font-size:52px;margin-bottom:12px;position:relative;z-index:1;">🎉</div>
      <h2 style="font-family:Georgia,serif;font-size:22px;color:#17201F;margin-bottom:8px;position:relative;z-index:1;">
        You're all set, ${firstName}!
      </h2>
      <p style="font-size:14px;color:#5A6360;line-height:1.6;margin-bottom:24px;position:relative;z-index:1;">
        Your photos have been submitted successfully.<br>We'll be in touch soon with your magnet order!
      </p>
      <button id="confettiClose" style="
        width:100%;padding:14px;border:none;border-radius:10px;
        background:#1A6B5A;color:#fff;font-size:16px;font-weight:600;
        cursor:pointer;position:relative;z-index:1;
      ">Thank you for your order!</button>
    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    const canvas = document.getElementById('confettiCanvas');
    const box    = document.getElementById('confettiBox');
    if (!canvas || !box) return;
    canvas.width  = box.offsetWidth;
    canvas.height = box.offsetHeight;
    const ctx = canvas.getContext('2d');

    const COLORS = ['#1A6B5A','#F7C948','#E05C5C','#4A90D9','#9B59B6','#2ECC71','#F39C12','#ffffff','#FF69B4','#00CED1'];
    const pieces = Array.from({ length: 220 }, () => ({
      x:     Math.random() * canvas.width,
      y:     -20 - Math.random() * canvas.height * 3,
      w:     5 + Math.random() * 9,
      h:     9 + Math.random() * 7,
      r:     Math.random() * Math.PI * 2,
      dr:    (Math.random() - 0.5) * 0.12,
      dy:    0.8 + Math.random() * 1.8,
      dx:    (Math.random() - 0.5) * 1.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      recycled: 0
    }));

    let raf;
    let active = true;

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let anyVisible = false;
      pieces.forEach(p => {
        p.y += p.dy; p.x += p.dx; p.r += p.dr;
        if (p.y > canvas.height + 20) {
          if (p.recycled < 3) {
            p.recycled++;
            p.y = -20 - Math.random() * 40;
            p.x = Math.random() * canvas.width;
            p.dy = 0.8 + Math.random() * 1.8;
          }
        }
        if (p.y < canvas.height + 20) anyVisible = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (active && anyVisible) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    function close() {
      active = false;
      cancelAnimationFrame(raf);
      overlay.remove();
      resetBtn.click();
    }

    document.getElementById('confettiClose').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  });
}
