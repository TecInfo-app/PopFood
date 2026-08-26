const fs = require('fs');
let content = fs.readFileSync('pedidos.html', 'utf8');
const search = 'return \\`* PAGAMENTO NA ENTREGA *<br>\\${m} - COBRAR\\`;';
content = content.replace(search, 'return "* PAGAMENTO NA ENTREGA *<br>" + m + " - COBRAR";');
fs.writeFileSync('pedidos.html', content);
