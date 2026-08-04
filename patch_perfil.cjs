const fs = require('fs');
let code = fs.readFileSync('perfil.html', 'utf8');
code = code.replace(
  /'Olá! Bem-vindo\(a\) ao \*{name}\*! 🍔🍕\\n_\{description\}_\\n\\nDigite o número da opção desejada:\\n1️⃣ \*Cardápio\*\\n2️⃣ \*Horário de Funcionamento\*\\n3️⃣ \*Fazer Pedido\*\\n4️⃣ \*Status do Pedido*'/g,
  `'Olá! Bem-vindo(a) ao *{name}*! 🍔🍕\\n_{description}_\\n\\nDigite o número da opção desejada:\\n1️⃣ *Cardápio*\\n2️⃣ *Horário de Funcionamento*\\n3️⃣ *Fazer Pedido*\\n4️⃣ *Status do Pedido*\\n5️⃣ *Cupons*\\n6️⃣ *Programa Fidelidade*'`
);
fs.writeFileSync('perfil.html', code);
