let cropper;
let globalBase64Data = ""; 

// =========================================================================
// ⚠️ MANDATORY USER CONFIGURATION FIELD:
// Replace the placeholder link below with your actual Google Web App URL.
// Ensure your link retains the quotes around it, ending with "/exec".
// =========================================================================
const GOOGLE_SCRIPT_URL = "17yX06W7LCJ39WmxvVpvwi3CmzroCSnbz";


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
    reader.readAsDataURL(files);
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
  uploadSubmitBtn.innerText = "Uploading to Drive... 🚀";
  uploadSubmitBtn.className = "w-full bg-slate-400 text-white font-semibold py-4 px-6 rounded-2xl cursor-not-allowed text-center";

  // Formats data payload structure cleanly to pass through Google firewall limits
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
    uploadSubmitBtn.innerText = "Upload Complete! Check Drive ✅";
    uploadSubmitBtn.className = "w-full bg-emerald-600 text-white font-semibold py-4 px-6 rounded-2xl text-center";
  })
  .catch(err => {
    console.error("Upload Error Details:", err);
    uploadSubmitBtn.disabled = false;
    uploadSubmitBtn.innerText = "Error. Try Again";
    uploadSubmitBtn.className = "w-full bg-red-600 text-white font-semibold py-4 px-6 rounded-2xl text-center";
  });
});

// 4. Clean app state framework reset
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
