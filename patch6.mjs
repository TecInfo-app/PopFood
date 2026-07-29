import fs from 'fs';
let html = fs.readFileSync('perfil.html', 'utf8');

// Regex replace for convertLogoToBase64
html = html.replace(/window\.convertLogoToBase64\s*=\s*function\(\)\s*\{[\s\S]*?reader\.readAsDataURL\(file\);\s*\}/, `window.convertLogoToBase64 = async function() {
      const fileInput = document.getElementById('logo-file-input');
      const file = fileInput.files[0];
      if (!file) return;

      try {
        let base64;
        if (window.optimizeAndConvertToBase64) {
          base64 = await window.optimizeAndConvertToBase64(file, 950);
        } else {
          if (file.size > 1 * 1024 * 1024) {
            alert("🔒 Atenção: O arquivo da imagem excede o tamanho limite absoluto de 1MB permitido!");
            fileInput.value = '';
            return;
          }
          base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
        
        const oldSrc = document.getElementById('logo-preview-img').src;
        const oldHidden = document.getElementById('logo-preview-img').classList.contains('hidden');

        try {
          document.getElementById('logo-preview-img').src = base64;
          document.getElementById('logo-preview-img').classList.remove('hidden');
          document.getElementById('logo-placeholder').classList.add('hidden');

          await setDoc(doc(db, COLLECTIONS.restaurantProfile, window.currentStoreId + "_logo"), {
            logo: base64
          }, { merge: true });
          alert("Logomarca updated!");
        } catch (err) {
          document.getElementById('logo-preview-img').src = oldSrc;
          if (oldHidden) {
            document.getElementById('logo-preview-img').classList.add('hidden');
            document.getElementById('logo-placeholder').classList.remove('hidden');
          }
          console.error("Logo update fails:", err);
          alert("Ocorreu um erro ao salvar o logo.");
        }
      } catch (err) {
        console.error("Error optimizing logo:", err);
        alert("Erro ao processar a imagem do logo.");
        fileInput.value = '';
      }
    }`);

// Regex replace for convertBannerToBase64AndAdd
html = html.replace(/window\.convertBannerToBase64AndAdd\s*=\s*function\(\)\s*\{[\s\S]*?reader\.readAsDataURL\(file\);\s*\}/, `window.convertBannerToBase64AndAdd = async function() {
      const fileInput = document.getElementById('banner-file-input');
      const file = fileInput.files[0];
      if (!file) return;

      try {
        let base64;
        if (window.optimizeAndConvertToBase64) {
          base64 = await window.optimizeAndConvertToBase64(file, 950);
        } else {
          if (file.size > 1 * 1024 * 1024) {
            alert("🔒 Atenção: O arquivo do banner individualmente excede o tamanho limite de 1MB permitido!");
            fileInput.value = '';
            return;
          }
          base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }
        
        try {
          bannersList.push({ banner: base64, linkUrl: "" });
          await saveAllBannersToDb();
          renderStoreBannersList();
        } catch (err) {
          console.error("Error saving banner:", err);
          alert("Ocorreu um erro ao salvar o banner.");
        }
      } catch (err) {
        console.error("Error optimizing banner:", err);
        alert("Erro ao processar o arquivo do banner.");
        fileInput.value = '';
      }
    }`);

if (!html.includes('image-optimizer.js')) {
    html = html.replace('</body>', '  <script src="image-optimizer.js"></script>\n</body>');
}
fs.writeFileSync('perfil.html', html);
