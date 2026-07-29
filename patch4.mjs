import fs from 'fs';
let html = fs.readFileSync('perfil.html', 'utf8');

const target1 = `    // Logo upload converter with strict 1MB limit check
    window.convertLogoToBase64 = function() {
      const fileInput = document.getElementById('logo-file-input');
      const file = fileInput.files[0];
      if (!file) return;

      if (file.size > 1 * 1024 * 1024) {
        alert("🔒 Atenção: O arquivo da imagem excede o tamanho limite absoluto de 1MB permitido!");
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        
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
          // Restore visual UI elements if save failed
          document.getElementById('logo-preview-img').src = oldSrc;
          if (oldHidden) {
            document.getElementById('logo-preview-img').classList.add('hidden');
            document.getElementById('logo-placeholder').classList.remove('hidden');
          }
          console.error("Logo update fails:", err);
          alert("Ocorreu um erro ao salvar o logo.");
        }
      };
      reader.readAsDataURL(file);
    }`;

const replace1 = `    // Logo upload converter with strict limit check
    window.convertLogoToBase64 = async function() {
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
          // Restore visual UI elements if save failed
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
    }`;

const target2 = `    window.convertBannerToBase64AndAdd = function() {
      const fileInput = document.getElementById('banner-file-input');
      const file = fileInput.files[0];
      if (!file) return;

      // Single file check
      if (file.size > 1 * 1024 * 1024) {
        alert("🔒 Atenção: O arquivo do banner individualmente excede o tamanho limite de 1MB permitido!");
        fileInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        
        // We need to fetch the existing document, push the new banner and save it back
        try {
          const storeId = window.currentStoreId;
          const ref = doc(db, COLLECTIONS.restaurantProfile, storeId);
          const snap = await getDoc(ref);
          let currentBanners = [];
          if(snap.exists() && snap.data().banners) {
             currentBanners = snap.data().banners;
          }
          currentBanners.push({ image: base64, link: "" });
          await setDoc(ref, { banners: currentBanners }, { merge: true });
          
          // Re-fetch banners after saving to refresh the UI properly
          const newSnap = await getDoc(ref);
          if (newSnap.exists() && newSnap.data().banners) {
            window.restaurantBanners = newSnap.data().banners;
            renderStoreBannersList();
          }
        } catch (err) {
          console.error("Error saving banner:", err);
          alert("Ocorreu um erro ao salvar o banner, pode ser devido ao tamanho excessivo (Firestore limita documentos a 1MB no total).");
        }
      };
      reader.readAsDataURL(file);
    }`;

const replace2 = `    window.convertBannerToBase64AndAdd = async function() {
      const fileInput = document.getElementById('banner-file-input');
      const file = fileInput.files[0];
      if (!file) return;

      try {
        let base64;
        if (window.optimizeAndConvertToBase64) {
          base64 = await window.optimizeAndConvertToBase64(file, 950);
        } else {
          // Single file check
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
        
        // We need to fetch the existing document, push the new banner and save it back
        try {
          const storeId = window.currentStoreId;
          const ref = doc(db, COLLECTIONS.restaurantProfile, storeId);
          const snap = await getDoc(ref);
          let currentBanners = [];
          if(snap.exists() && snap.data().banners) {
             currentBanners = snap.data().banners;
          }
          currentBanners.push({ image: base64, link: "" });
          await setDoc(ref, { banners: currentBanners }, { merge: true });
          
          // Re-fetch banners after saving to refresh the UI properly
          const newSnap = await getDoc(ref);
          if (newSnap.exists() && newSnap.data().banners) {
            window.restaurantBanners = newSnap.data().banners;
            renderStoreBannersList();
          }
        } catch (err) {
          console.error("Error saving banner:", err);
          alert("Ocorreu um erro ao salvar o banner, pode ser devido ao tamanho excessivo (Firestore limita documentos a 1MB no total).");
        }
      } catch (err) {
        console.error("Error optimizing banner:", err);
        alert("Erro ao processar o arquivo do banner.");
        fileInput.value = '';
      }
    }`;

html = html.replace(target1, replace1);
html = html.replace(target2, replace2);

if (!html.includes('image-optimizer.js')) {
    html = html.replace('</body>', '  <script src="image-optimizer.js"></script>\n</body>');
}
fs.writeFileSync('perfil.html', html);
