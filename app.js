let cropper;
let globalBase64Data = ""; // Stores compressed picture bits
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwbFuDm3upARtNqENkme8Q1WPKAr1HZvu399d9jydKQ-B-dLhjNplX54pLEtJ8Ms5Rkmw/exec";

const imageInput = document.getElementById('imageInput');
const imageToCrop = document.getElementById('imageToCrop');
const uploadScreen = document.getElementById('uploadScreen');
const cropScreen = document.getElementById('cropScreen');
const successScreen = document.getElementById('successScreen');
const cropBtn = document.getElementById('cropBtn');
const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
const resetBtn = document.getElementById('resetBtn');

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
        aspectRatio: 1,
        viewMode: 1,
        autoCropArea: 1,
        responsive: true,
        background: false
      });
    };
    reader.readAsDataURL(files);
  }
});

cropBtn.addEventListener('click', function() {
  if (!cropper) return;

  const canvas = cropper.getCroppedCanvas({
    width: 600,
    height: 600,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });

  // Convert canvas to a Base64 URL layout string for native Google processing
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  globalBase64Data = dataUrl.split(',')[1]; // Strips header to isolate raw picture bytes

  cropScreen.classList.add('hidden');
  cropBtn.classList.add('hidden');
  successScreen.classList.remove('hidden');
});

// Directly handles execution connection to Google Apps Script Web App
uploadSubmitBtn.addEventListener('click', function() {
  uploadSubmitBtn.disabled = true;
  uploadSubmitBtn.innerText = "Uploading to Drive... 🚀";
  uploadSubmitBtn.className = "w-full bg-slate-400 text-white font-semibold py-4 px-6 rounded-2xl cursor-not-allowed text-center";

  fetch(GOOGLE_SCRIPT_URL, {
    method: "POST",
    mode: "no-cors", // Bypasses browser cross-origin pre-checks seamlessly
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Data: globalBase64Data })
  })
  .then(() => {
    uploadSubmitBtn.innerText = "Upload Complete! Check Drive ✅";
    uploadSubmitBtn.className = "w-full bg-emerald-600 text-white font-semibold py-4 px-6 rounded-2xl text-center";
  })
  .catch(err => {
    console.error(err);
    uploadSubmitBtn.disabled = false;
    uploadSubmitBtn.innerText = "Error. Try Again";
    uploadSubmitBtn.className = "w-full bg-red-600 text-white font-semibold py-4 px-6 rounded-2xl text-center";
  });
});

resetBtn.addEventListener('click', function() {
  imageInput.value = '';
  globalBase64Data = "";
  if (cropper) cropper.destroy();
  uploadSubmitBtn.disabled = false;
  uploadSubmitBtn.innerText = "Upload Photo to Google Drive";
  uploadSubmitBtn.className = "w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 px-6 rounded-2xl transition-all duration-200";
  successScreen.classList.add('hidden');
  uploadScreen.classList.remove('hidden');
});
