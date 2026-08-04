const fs = require('fs');
let code = fs.readFileSync('perfil.html', 'utf8');

code = code.replace(
/window\.checkWhatsappStatus = async function\(\) \{[\s\S]*?console\.error\("Failed to check whatsapp status", e\);\n      \}\n    \};/,
`window.checkWhatsappStatus = async function() {
      if (!window.currentStoreId) return;
      try {
        const res = await fetch(\`/api/whatsapp/status?storeId=\${window.currentStoreId}\`);
        const data = await res.json();
        
        document.getElementById('whatsapp-status-container').classList.add('hidden');
        if (data.connected) {
          document.getElementById('whatsapp-connected-container').classList.remove('hidden');
          document.getElementById('whatsapp-qr-container').classList.add('hidden');
          if (window.whatsappInterval) clearInterval(window.whatsappInterval);
        } else if (data.qr) {
          document.getElementById('whatsapp-qr-container').classList.remove('hidden');
          document.getElementById('whatsapp-qr-image').src = data.qr;
          document.getElementById('whatsapp-connected-container').classList.add('hidden');
        } else {
          document.getElementById('whatsapp-qr-container').classList.add('hidden');
          document.getElementById('whatsapp-status-container').classList.remove('hidden');
          document.getElementById('whatsapp-connected-container').classList.add('hidden');
        }
      } catch (e) {
        console.error("Failed to check whatsapp status", e);
      }
    };`
);

code = code.replace(
/window\.loadWhatsappQr = async function\(\) \{[\s\S]*?console\.error\("Failed to load whatsapp qr", e\);\n      \}\n    \};/,
`window.loadWhatsappQr = async function() {
      if (!window.currentStoreId) return;
      document.getElementById('whatsapp-status-container').classList.remove('hidden');
      document.getElementById('whatsapp-qr-container').classList.add('hidden');
      document.getElementById('whatsapp-connected-container').classList.add('hidden');
      
      try {
        await fetch(\`/api/whatsapp/qr?storeId=\${window.currentStoreId}\`);
        window.checkWhatsappStatus();
        if (window.whatsappInterval) clearInterval(window.whatsappInterval);
        window.whatsappInterval = setInterval(window.checkWhatsappStatus, 3000);
      } catch (e) {
        console.error("Failed to load whatsapp qr", e);
        if (window.whatsappInterval) clearInterval(window.whatsappInterval);
        window.whatsappInterval = setInterval(window.checkWhatsappStatus, 3000);
      }
    };`
);

fs.writeFileSync('perfil.html', code);
