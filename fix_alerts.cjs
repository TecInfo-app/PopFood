const fs = require('fs');
let content = fs.readFileSync('rapido.html', 'utf8');

content = content.replace(
    /Swal\.fire\(\{\s*title:\s*'Atenção!',\s*text:\s*(`Excedeu o limite no grupo "\$\{groupName\}": máximo permitido \$\{group\.max\} opção\(ões\)\.`),[\s\S]*?\}\);/,
    "alert($1);"
);

fs.writeFileSync('rapido.html', content);
