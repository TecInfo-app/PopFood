import fs from 'fs';
let html = fs.readFileSync('index.html', 'utf8');

const regex = /let optionImage\s*=\s*\"\";\s*if\s*\(fileInput\s*&&\s*fileInput\.files\s*&&\s*fileInput\.files\[0\]\)\s*\{\s*const\s*file\s*=\s*fileInput\.files\[0\];\s*if\s*\(file\.size\s*>\s*950\s*\*\s*1024\)\s*\{\s*alert\(\"🔒 Erro: Imagem do complemento excede limite de 950KB\.\"\);\s*return;\s*\}\s*try\s*\{\s*optionImage\s*=\s*await\s*new\s*Promise\(\(resolve,\s*reject\)\s*=>\s*\{\s*const\s*reader\s*=\s*new\s*FileReader\(\);\s*reader\.onload\s*=\s*\(\)\s*=>\s*resolve\(reader\.result\);\s*reader\.onerror\s*=\s*\(err\)\s*=>\s*reject\(err\);\s*reader\.readAsDataURL\(file\);\s*\}\);\s*\}\s*catch\s*\(e\)\s*\{\s*alert\(\"Erro ao ler arquivo da imagem\.\"\);\s*return;\s*\}\s*\}/;

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

html = html.replace(regex, replacement);

fs.writeFileSync('index.html', html);
