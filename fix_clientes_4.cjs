const fs = require('fs');
let content = fs.readFileSync('clientes.html', 'utf8');

content = content.replace(
  `const nameEscaped = \`"\${c.name.replace(/"/g, '""')}"\`;`,
  `const nameEscaped = \`"\${String(c.name || 'Sem Nome').replace(/"/g, '""')}"\`;`
);

fs.writeFileSync('clientes.html', content);
