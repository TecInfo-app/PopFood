const fs = require('fs');

let html = fs.readFileSync('pedidos.html', 'utf-8');

html = html.replace(/fetch\('\/api\/uber-direct\/criar-entrega'/g, `fetch('https://worker-uber.iranildo-tecnologia.workers.dev/criar-entrega'`);
html = html.replace(/fetch\('\/api\/uber-direct\/cancelar-entrega'/g, `fetch('https://worker-uber.iranildo-tecnologia.workers.dev/cancelar-entrega'`);

// We also need to add the credentials to the body of the requests in pedidos.html!
