import fs from 'fs';
let html = fs.readFileSync('index.html', 'utf8');

const target = `      let optionImage = "";
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        if (file.size > 950 * 1024) {
          alert("🔒 Erro: Imagem do complemento excede limite de 950KB.");
          return;
        }
          
        try {
          optionImage = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });
        } catch (e) {
          alert("Erro ao ler arquivo da imagem.");
          return;
        }
      }`;

const replacement = `      let optionImage = "";
      if (fileInput && fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
          
        try {
          if (window.optimizeAndConvertToBase64) {
            optionImage = await window.optimizeAndConvertToBase64(file, 950);
          } else {
            if (file.size > 950 * 1024) {
              alert("🔒 Erro: Imagem do complemento excede limite de 950KB.");
              return;
            }
            optionImage = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = (err) => reject(err);
              reader.readAsDataURL(file);
            });
          }
        } catch (e) {
          alert("Erro ao ler/otimizar arquivo da imagem.");
          return;
        }
      }`;

html = html.replace(target, replacement);

if (!html.includes('image-optimizer.js')) {
    html = html.replace('</body>', '  <script src="image-optimizer.js"></script>\n</body>');
}
fs.writeFileSync('index.html', html);
