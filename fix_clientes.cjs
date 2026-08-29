const fs = require('fs');
let content = fs.readFileSync('clientes.html', 'utf8');

content = content.replace(
  `const cleanPhone = client.phone.replace(/\\D/g, '');`,
  `const cleanPhone = String(client.phone || '').replace(/\\D/g, '');`
);

content = content.replace(
  `const allC = globalOrdersListForCrm.filter(o => o.customer.phone.replace(/\\D/g, '') === cleanPhone);`,
  `const allC = globalOrdersListForCrm.filter(o => String((o.customer && o.customer.phone) || '').replace(/\\D/g, '') === cleanPhone);`
);

content = content.replace(
  `const clientOrders = globalOrdersListForCrm.filter(o => o.customer.phone.replace(/\\D/g, '') === cleanTargetPhone);`,
  `const clientOrders = globalOrdersListForCrm.filter(o => String((o.customer && o.customer.phone) || '').replace(/\\D/g, '') === cleanTargetPhone);`
);

// Check if any instances of client.phone.toLowerCase() exist and protect them too
content = content.replace(
  `c.phone.toLowerCase().includes(searchQuery) ||`,
  `String(c.phone || '').toLowerCase().includes(searchQuery) ||`
);
content = content.replace(
  `c.name.toLowerCase().includes(searchQuery) ||`,
  `String(c.name || '').toLowerCase().includes(searchQuery) ||`
);

fs.writeFileSync('clientes.html', content);
