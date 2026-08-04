const fs = require('fs');
let code = fs.readFileSync('perfil.html', 'utf8');

code = code.replace(
/        \/\/ Initialize Whatsapp\n        window\.checkWhatsappStatus\(\);/,
`        // Initialize Whatsapp
        window.checkWhatsappStatus();
        if (window.whatsappInterval) clearInterval(window.whatsappInterval);
        window.whatsappInterval = setInterval(window.checkWhatsappStatus, 5000);`
);

fs.writeFileSync('perfil.html', code);
