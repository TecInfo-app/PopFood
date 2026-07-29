import fs from 'fs';
let html = fs.readFileSync('perfil.html', 'utf8');

const target1 = `    window.convertLogoToBase64 = function() {
      const fileInput = document.getElementById('logo-file-input');
      const file = fileInput.files[0];
      if (!file) return;

      if (file.size > 1 * 1024 * 1024) {
        alert("🔒 Atenção: O arquivo da logomarca excede os limites de segurança da plataforma: Máximo 950KB compatível com Firestore!");
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        imageBase64Data = reader.result;
        
        const preview = document.getElementById('logo-preview-img');
        const placeholder = document.getElementById('logo-placeholder');
        
        preview.src = imageBase64Data;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        
        saveRestaurantLogo(imageBase64Data);
      };
      reader.readAsDataURL(file);
    }`;

const replace1 = `    window.convertLogoToBase64 = async function() {
      const fileInput = document.getElementById('logo-file-input');
      const file = fileInput.files[0];
      if (!file) return;

      try {
        if (window.optimizeAndConvertToBase64) {
          imageBase64Data = await window.optimizeAndConvertToBase64(file, 950);
        } else {
          if (file.size > 1 * 1024 * 1024) {
            alert("🔒 Atenção: O arquivo da logomarca excede os limites de segurança da plataforma: Máximo 950KB compatível com Firestore!");
            fileInput.value = '';
            return;
          }
          imageBase64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
        
        const preview = document.getElementById('logo-preview-img');
        const placeholder = document.getElementById('logo-placeholder');
        
        preview.src = imageBase64Data;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        
        saveRestaurantLogo(imageBase64Data);
      } catch (err) {
        console.error("Erro ao processar imagem:", err);
        alert("Erro ao processar a imagem.");
        fileInput.value = '';
      }
    }`;

const target2 = `    window.convertBannerToBase64AndAdd = function() {
      const fileInput = document.getElementById('banner-file-input');
      const file = fileInput.files[0];
      if (!file) return;

      // Single file check
      if (file.size > 1 * 1024 * 1024) {
        alert("🔒 Atenção: O banner excede os limites de segurança da plataforma: Máximo 950KB compatível com Firestore!");
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result;
        saveRestaurantBanner(base64Data);
      };
      reader.readAsDataURL(file);
    }`;

const replace2 = `    window.convertBannerToBase64AndAdd = async function() {
      const fileInput = document.getElementById('banner-file-input');
      const file = fileInput.files[0];
      if (!file) return;

      try {
        let base64Data;
        if (window.optimizeAndConvertToBase64) {
          base64Data = await window.optimizeAndConvertToBase64(file, 950);
        } else {
          if (file.size > 1 * 1024 * 1024) {
            alert("🔒 Atenção: O banner excede os limites de segurança da plataforma: Máximo 950KB compatível com Firestore!");
            fileInput.value = '';
            return;
          }
          base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
        saveRestaurantBanner(base64Data);
      } catch (err) {
        console.error("Erro ao processar banner:", err);
        alert("Erro ao processar o banner.");
        fileInput.value = '';
      }
    }`;

html = html.replace(target1, replace1);
html = html.replace(target2, replace2);

if (!html.includes('image-optimizer.js')) {
    html = html.replace('</body>', '  <script src="image-optimizer.js"></script>\n</body>');
}
fs.writeFileSync('perfil.html', html);
