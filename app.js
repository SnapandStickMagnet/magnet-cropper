let cropper;
let globalBase64Data = ""; 

// =========================================================================
// ⚠️ MANDATORY USER CONFIGURATION FIELD:
// Replace the placeholder link below with your actual Google Web App URL.
// Ensure your link retains the quotes around it, ending with "/exec".
// =========================================================================
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwGJ4Q33F-95EUGtcn6XiTj9BoMbospvGnJgwpHuWvBknJY_3eSdndZ9-kV1VDljpZ87g/exec";


const imageInput = document.getElementById('imageInput');
const imageToCrop = document.getElementById('imageToCrop');
const uploadScreen = document.getElementById('uploadScreen');
const cropScreen = document.getElementById('cropScreen');
const successScreen = document.getElementById('successScreen');
const cropBtn = document.getElementById('cropBtn');
const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
const resetBtn = document.getElementById('resetBtn');

// 1. Listen for mobile user photo uploads
imageInput.addEventListener('change', function(e) {
  const files = e.target.files;
  if (files && files.length > 0) {
    const reader = new FileReader();
    reader.onload = function(event) {
      imageToCrop.src = event.target.result;
      uploadScreen.classList.add('hidden');
      cropScreen.classList.remove('hidden');
      cropBtn.classList.remove('hidden');

      if (cropper) cropper.destroy();
      cropper = new Cropper(imageToCrop, {
        aspectRatio: 1, // Strict locked 1:1 format for magnets
        viewMode: 1,
        autoCropArea: 1,
        responsive: true,
        background: false
      });
    };
    reader.readAsDataURL(files[0]);
  }
});

// 2. Crop processing (Downscales strictly to 600x600 pixels)
cropBtn.addEventListener('click', function() {
  if (!cropper) return;

  const canvas = cropper.getCroppedCanvas({
    width: 600,
    height: 600,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });

  // Extract raw base64 data stream to hand off natively to Google
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  globalBase64Data = dataUrl.split(',')[1]; 

  cropScreen.classList.add('hidden');
  cropBtn.classList.add('hidden');
  successScreen.classList.remove('hidden');
});

// 3. Direct Streaming Connection Upload to your Personal Google Drive Folder
uploadSubmitBtn.addEventListener('click', function() {
  if (!globalBase64Data) return;

  uploadSubmitBtn.disabled = true;
  uploadSubmitBtn.innerText = "Uploading to Drive…";
  uploadSubmitBtn.className = "btn btn-uploading";

  const payload = new URLSearchParams();
  payload.append("base64Data", globalBase64Data);

  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    body: payload,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    }
  })
  .then(response => {
    uploadSubmitBtn.innerText = "Upload complete — check Drive ✓";
    uploadSubmitBtn.className = "btn btn-success";
  })
  .catch(err => {
    console.error("Upload Error Details:", err);
    uploadSubmitBtn.disabled = false;
    uploadSubmitBtn.innerText = "Upload failed — try again";
    uploadSubmitBtn.className = "btn btn-error";
  });
});

// 4. Clean app state framework reset
resetBtn.addEventListener('click', function() {
  imageInput.value = '';
  globalBase64Data = "";
  if (cropper) cropper.destroy();
  uploadSubmitBtn.disabled = false;
  uploadSubmitBtn.innerText = "Upload to Google Drive";
  uploadSubmitBtn.className = "btn btn-dark";
  successScreen.classList.add('hidden');
  uploadScreen.classList.remove('hidden');
});