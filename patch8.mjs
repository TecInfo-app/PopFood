import fs from 'fs';
['index.html', 'perfil.html'].forEach(file => {
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace('<script src="image-optimizer.js"></script>', '<script src="/image-optimizer.js"></script>');
    fs.writeFileSync(file, html);
});
