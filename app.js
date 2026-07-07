let cropper;
const imageInput = document.getElementById('imageInput');
const imageToCrop = document.getElementById('imageToCrop');
const uploadScreen = document.getElementById('uploadScreen');
const cropScreen = document.getElementById('cropScreen');
const successScreen = document.getElementById('successScreen');
const cropBtn = document.getElementById('cropBtn');
const resetBtn = document.getElementById('resetBtn');

// 1. Listen for user photo upload
imageInput.addEventListener('change', function(e) {
  const files = e.target.files;
  if (files && files.length > 0) {
    const reader = new FileReader();
    reader.onload = function(event) {
      // Set the uploaded image source
      imageToCrop.src = event.target.result;
      
      // Swap screens to show the cropper
      uploadScreen.classList.add('hidden');
      cropScreen.classList.remove('hidden');
      cropBtn.classList.remove('hidden');

      // Initialize Cropper.js with a locked 1:1 square ratio
      if (cropper) cropper.destroy(); // Clear existing instance if any
      cropper = new Cropper(imageToCrop, {
        aspectRatio: 1, // Locks the selection container to a perfect square
        viewMode: 1,    // Restricts the crop box from exceeding the canvas size
        autoCropArea: 1,
        responsive: true,
        background: false
      });
    };
    reader.readAsDataURL(files);
  }
});

// 2. Process image when user clicks "Lock Square & Crop" (Step 3 Logic)
cropBtn.addEventListener('click', function() {
  if (!cropper) return;

  // Render selection onto a canvas locked strictly at 600x600 pixels
  const canvas = cropper.getCroppedCanvas({
    width: 600,
    height: 600,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high'
  });

  // Convert canvas output to a crisp high-quality JPEG blob
  canvas.toBlob(function(blob) {
    // Create an actual File object out of the raw blob data
    const file = new File([blob], "magnet-photo.jpg", { type: "image/jpeg" });

    // Use a DataTransfer object to safely inject this file into our hidden form field
    const container = new DataTransfer();
    container.items.add(file);
    
    const hiddenFileInput = document.getElementById('hiddenFileInput');
    hiddenFileInput.files = container.files;

    // Transition UI to the success/upload screen
    cropScreen.classList.add('hidden');
    cropBtn.classList.add('hidden');
    successScreen.classList.remove('hidden');
  }, 'image/jpeg', 0.95);
});

// 3. Handle the Form submission directly
document.getElementById('photoForm').addEventListener('submit', function() {
  const btn = document.getElementById('uploadSubmitBtn');
  btn.disabled = true;
  btn.innerText = "Uploading... Please Wait";
  btn.classList.add('opacity-50', 'cursor-not-allowed');
});

// 4. Reset application state to crop a new photo
resetBtn.addEventListener('click', function() {
  imageInput.value = '';
  if (cropper) cropper.destroy();
  successScreen.classList.add('hidden');
  uploadScreen.classList.remove('hidden');
});
