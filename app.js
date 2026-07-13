// ── Config ──────────────────────────────────────────────────────────────────
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyMANt2wsFSywBL4pGRSaeb99LmBleWaCZCzuJlb-Io_gj_FZuRoI0KbhFYpu2miixL2Q/exec";
const AUTH_PASSWORD = new URLSearchParams(window.location.search).get('pwd') || '';
const TOTAL_SLOTS = 12;

// ── Sheet geometry ────────────────────────────────────────────────────────────
// Magnet face = 50×50mm. Press needs 3mm bleed each side to fold under the shell.
// Print cell = 56×56mm (50mm + 3mm bleed each side) at 300 DPI.
// 56mm × (300 / 25.4) = 661.4 → 661px per cell.
// Cut guide border is drawn at the 50mm boundary (inset 3mm from cell edge).
// Sheet = 8.5×11" = 2550×3300 px. 3 cols × 4 rows.
// Gap between cells = 6mm = 71px.
const DPI         = 300;
const MM_TO_PX    = DPI / 25.4;                     // 11.811 px per mm
const BLEED_MM    = 3;                               // 3mm bleed each side
const MAGNET_MM   = 50;                              // actual magnet face
const CELL_MM     = MAGNET_MM + BLEED_MM * 2;        // 56mm print cell
const CELL        = Math.round(CELL_MM * MM_TO_PX);  // 661px
const BLEED       = Math.round(BLEED_MM * MM_TO_PX); // 35px bleed offset
const MAGNET_PX   = Math.round(MAGNET_MM * MM_TO_PX); // 591px — 50mm face
const COLS        = 3;
const ROWS        = 4;
const SHEET_W     = Math.round(8.5 * DPI);    // 2550
const SHEET_H     = Math.round(11  * DPI);    // 3300
const GAP         = Math.round(6 * MM_TO_PX); // 6mm gap = 71px
const CONTENT_W   = COLS * CELL + (COLS - 1) * GAP;
const CONTENT_H   = ROWS * CELL + (ROWS - 1) * GAP;
const ORIGIN_X    = Math.round((SHEET_W - CONTENT_W) / 2);
const ORIGIN_Y    = Math.round((SHEET_H - CONTENT_H) / 2);
const CORNER_R    = Math.round(1.5 * MM_TO_PX); // very subtle corner radius — square press
const BORDER_W    = 3;
const BORDER_COLOR = '#888888';

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
  slotImages[activeSlotIndex] = canvas.toDataURL('image/jpeg', 1.0).split(',')[1];
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

// ── Draw one cell: photo fills cell, dashed border on same edge ───────────────
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
  window._sheetCanvas  = canvas;
  window._sheetBase64  = canvas.toDataURL('image/jpeg', 1.0).split(',')[1];
  sheetScreen.classList.add('hidden');
  sheetScreen.style.display = '';
  successScreen.classList.remove('hidden');
  successScreen.style.display = 'flex';
  cropBtn.classList.add('hidden');
  cropBtn.disabled = false;
}

// ── PDF Download ──────────────────────────────────────────────────────────────
document.getElementById('downloadPdfBtn').addEventListener('click', function() {
  if (!window._sheetCanvas) return;
  const btn = this;
  btn.textContent = 'Generating PDF…';
  btn.disabled = true;

  setTimeout(() => {
    try {
      const { jsPDF } = window.jspdf;
      // Letter page, portrait, inches
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
      // Add image at exact 8.5×11" — zero margin, no scaling
      const imgData = window._sheetCanvas.toDataURL('image/jpeg', 1.0);
      pdf.addImage(imgData, 'JPEG', 0, 0, 8.5, 11);
      pdf.save('magnets-print.pdf');
      btn.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="18" height="18" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> PDF Downloaded!`;
      btn.style.background = '#1A6B5A';
      setTimeout(() => {
        btn.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="18" height="18" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg> Download Print-Ready PDF`;
        btn.style.background = '';
        btn.disabled = false;
      }, 3000);
    } catch(err) {
      console.error('PDF error:', err);
      btn.textContent = 'PDF failed — try again';
      btn.disabled = false;
    }
  }, 50); // small delay so browser renders the "Generating…" state first
});

// ── Upload ────────────────────────────────────────────────────────────────────
uploadSubmitBtn.addEventListener('click', function() {
  if (!window._sheetBase64) return;

  const name    = nameInput.value.trim();
  const contact = phoneInput.value.trim(); // email or phone
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

  const payload = new FormData();
  // Filename includes name + contact so it's visible directly in Google Drive
  const safeName    = name.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  const safeContact = contact.replace(/[^a-zA-Z0-9@._+-]/g, '').trim();
  const timestamp   = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename    = `${timestamp}_${safeName}_${safeContact}`;
  payload.append('base64Data', window._sheetBase64);
  payload.append('pwd',      AUTH_PASSWORD);
  payload.append('name',     name);
  payload.append('contact',  contact);
  payload.append('filename', filename);

  fetch(GOOGLE_SCRIPT_URL, { method: 'POST', body: payload, redirect: 'follow' })
    .then(r => r.json())
    .then(data => {
      if (data.status === 'success') {
        uploadSubmitBtn.innerText = 'Photos Submitted ✓';
        uploadSubmitBtn.className = 'btn btn-success';
        showConfettiPopup(name);
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
  window._sheetBase64  = null;
  window._sheetCanvas  = null;
  activeSlotIndex = null;
  imageInput.value = '';
  nameInput.value = '';
  phoneInput.value = '';
  [nameInput, phoneInput].forEach(el => el.classList.remove('invalid'));
  document.getElementById('formError').style.display = 'none';
  const pdfBtn = document.getElementById('downloadPdfBtn');
  if (pdfBtn) {
    pdfBtn.innerHTML = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="18" height="18" style="flex-shrink:0"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg> Download Print-Ready PDF`;
    pdfBtn.style.background = '';
    pdfBtn.disabled = false;
  }
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

  // Kick off confetti before wiring events (so canvas is in DOM)
  requestAnimationFrame(() => {
    const canvas = document.getElementById('confettiCanvas');
    const box    = document.getElementById('confettiBox');
    if (!canvas || !box) return;
    canvas.width  = box.offsetWidth;
    canvas.height = box.offsetHeight;
    const ctx = canvas.getContext('2d');

    const COLORS = ['#1A6B5A','#F7C948','#E05C5C','#4A90D9','#9B59B6','#2ECC71','#F39C12','#ffffff','#FF69B4','#00CED1'];

    // More pieces, slower fall, staggered start so confetti lasts much longer
    const pieces = Array.from({ length: 220 }, (_, i) => ({
      x:     Math.random() * canvas.width,
      y:     -20 - Math.random() * canvas.height * 3, // spread start far above so they trickle in over time
      w:     5 + Math.random() * 9,
      h:     9 + Math.random() * 7,
      r:     Math.random() * Math.PI * 2,
      dr:    (Math.random() - 0.5) * 0.12,
      dy:    0.8 + Math.random() * 1.8,   // much slower fall
      dx:    (Math.random() - 0.5) * 1.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      recycled: 0  // how many times it has looped
    }));

    let raf;
    let active = true;

    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let anyVisible = false;
      pieces.forEach(p => {
        p.y += p.dy; p.x += p.dx; p.r += p.dr;

        // Recycle pieces back to top up to 3 times so confetti keeps going
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
      // Return to step 1
      resetBtn.click();
    }

    document.getElementById('confettiClose').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  });
}
