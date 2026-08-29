const fs = require('fs');
let content = fs.readFileSync('clientes.html', 'utf8');

content = content.replace(
  `const client = globalClientsList.find(c => c.phone.replace(/\\D/g, '') === phone.replace(/\\D/g, ''));`,
  `const client = globalClientsList.find(c => String(c.phone || '').replace(/\\D/g, '') === String(phone || '').replace(/\\D/g, ''));`
);

content = content.replace(
  `const cleanTargetPhone = phone.replace(/\\D/g, '');`,
  `const cleanTargetPhone = String(phone || '').replace(/\\D/g, '');`
);

fs.writeFileSync('clientes.html', content);
