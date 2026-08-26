const fs = require('fs');
let content = fs.readFileSync('pedidos.html', 'utf8');
content = content.replace(/return `\* PAGAMENTO NA ENTREGA \*<br>\$\{m\} - COBRAR`;/g, 'return "* PAGAMENTO NA ENTREGA *<br>" + m + " - COBRAR";');
fs.writeFileSync('pedidos.html', content);
