const fs = require('fs');
let content = fs.readFileSync('clientes.html', 'utf8');

content = content.replace(
  `const clientPhone = (client.phone || "").replace(/\\D/g, '');`,
  `const clientPhone = String(client.phone || "").replace(/\\D/g, '');`
);

content = content.replace(
  `const orderPhone = (o.customer && o.customer.phone || "").replace(/\\D/g, '');`,
  `const orderPhone = String(o.customer && o.customer.phone || "").replace(/\\D/g, '');`
);

fs.writeFileSync('clientes.html', content);
