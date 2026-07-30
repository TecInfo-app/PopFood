window.optimizeAndConvertToBase64 = function(file, maxKB = 950) {
  return new Promise((resolve, reject) => {
    if (!file) return reject("No file provided");
    
    // Show loading overlay
    let overlay = document.getElementById('image-optimization-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'image-optimization-overlay';
      overlay.className = 'fixed inset-0 bg-black/60 z-[99999] flex flex-col items-center justify-center text-white backdrop-blur-sm transition-opacity duration-300 opacity-0 hidden';
      overlay.innerHTML = `
        <div class="bg-white rounded-2xl p-6 flex flex-col items-center max-w-[200px] w-full shadow-2xl">
          <svg class="animate-spin h-8 w-8 text-orange-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-xs font-bold text-gray-800 text-center" id="optimization-status-text">Otimizando imagem...</span>
          <div class="w-full bg-gray-200 h-1.5 rounded-full mt-3 overflow-hidden">
             <div id="optimization-progress-bar" class="bg-orange-500 h-full w-0 transition-all duration-300"></div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }
    
    // Animate in
    overlay.classList.remove('hidden');
    setTimeout(() => {
      overlay.classList.remove('opacity-0');
      overlay.classList.add('opacity-100');
    }, 10);
    
    const statusText = document.getElementById('optimization-status-text');
    const progressBar = document.getElementById('optimization-progress-bar');
    
    const closeOverlay = () => {
      overlay.classList.remove('opacity-100');
      overlay.classList.add('opacity-0');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 300);
    };

    statusText.textContent = "Lendo arquivo...";
    progressBar.style.width = "20%";

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(event) {
      statusText.textContent = "Processando...";
      progressBar.style.width = "40%";
      const img = new Image();
      img.src = event.target.result;
      img.onload = function() {
        statusText.textContent = "Comprimindo...";
        progressBar.style.width = "60%";
        
        let width = img.width;
        let height = img.height;
        
        // Max dimensions to avoid huge canvases
        const MAX_DIM = 1200; 
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round(height * (MAX_DIM / width));
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round(width * (MAX_DIM / height));
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Iterative compression to hit target size
        let quality = 0.9;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        let sizeKB = Math.round(dataUrl.length * 3 / 4 / 1024); // approx size in KB
        
        const compress = () => {
          if (sizeKB > maxKB && quality > 0.1) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            sizeKB = Math.round(dataUrl.length * 3 / 4 / 1024);
            setTimeout(compress, 10); // yield to UI
          } else {
             progressBar.style.width = "100%";
             statusText.textContent = "Concluído!";
             setTimeout(() => {
               closeOverlay();
               resolve(dataUrl);
             }, 500);
          }
        };
        setTimeout(compress, 50);
      };
      img.onerror = function() {
        closeOverlay();
        reject("Failed to load image");
      }
    };
    reader.onerror = function() {
      closeOverlay();
      reject("Failed to read file");
    }
  });
};
