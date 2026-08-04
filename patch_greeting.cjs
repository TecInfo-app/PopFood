const fs = require('fs');
let code = fs.readFileSync('whatsapp-bot.ts', 'utf8');
code = code.replace(
  /\`3️⃣ \*Fazer Novo Pedido\*\\n\` \+\n                             \`4️⃣ \*Ver Detalhes do Pedido \(\#\$\{activeOrder\.id\}\)\*\`;/g,
  `\`3️⃣ *Fazer Novo Pedido*\\n\` +\n                             \`4️⃣ *Ver Detalhes do Pedido (#\${activeOrder.id})*\\n\` +\n                             \`5️⃣ *Cupons*\\n\` +\n                             \`6️⃣ *Programa Fidelidade*\`;`
);
fs.writeFileSync('whatsapp-bot.ts', code);
