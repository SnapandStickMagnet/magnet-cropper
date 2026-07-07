let cropper;
const imageInput = document.getElementById('imageInput');
const imageToCrop = document.getElementById('imageToCrop');
const uploadScreen = document.getElementById('uploadScreen');
const cropScreen = document.getElementById('cropScreen');
const successScreen = document.getElementById('successScreen');
const cropBtn = document.getElementById('cropBtn');
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

  canvas.toBlob(function(blob) {
    const file = new File([blob], "magnet-photo.jpg", { type: "image/jpeg" });
    const container = new DataTransfer();
    container.items.add(file);
    
    const hiddenFileInput = document.getElementById('hiddenFileInput');
    hiddenFileInput.files = container.files;

    cropScreen.classList.add('hidden');
    cropBtn.classList.add('hidden');
    successScreen.classList.remove('hidden');
  }, 'image/jpeg', 0.95);
});

document.getElementById('photoForm').addEventListener('submit', function() {
  const btn = document.getElementById('uploadSubmitBtn');
  btn.disabled = true;
  btn.innerText = "Uploading... Please Wait 🚀";
  btn.classList.remove('bg-slate-900', 'hover:bg-slate-800');
  btn.classList.add('bg-slate-400', 'cursor-not-allowed');
});

resetBtn.addEventListener('click', function() {
  imageInput.value = '';
  if (cropper) cropper.destroy();
  successScreen.classList.add('hidden');
  uploadScreen.classList.remove('hidden');
});
