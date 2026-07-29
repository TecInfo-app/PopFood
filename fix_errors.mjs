import fs from 'fs';
['index.html', 'perfil.html', 'clientes.html', 'pedidos.html', 'relatorios.html', 'cliente.html'].forEach(file => {
    if (fs.existsSync(file)) {
        let html = fs.readFileSync(file, 'utf8');
        // Fix image-optimizer path
        html = html.replace('<script src="/image-optimizer.js"></script>', '<script src="./image-optimizer.js"></script>');
        
        // Add copyStoreLink if missing
        if (!html.includes('window.copyStoreLink = function()') && html.includes('copyStoreLink()')) {
            const func = `
    window.copyStoreLink = function() {
      if (!window.currentStoreId) return;
      const basePath = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/'));
      const link = \`\${window.location.origin}\${basePath}/cliente.html?store=\${window.currentStoreId}\`;
      navigator.clipboard.writeText(link).then(() => {
        window.customAlert ? window.customAlert("Link do seu cardápio copiado!") : alert("Link copiado!");
      }).catch(err => {
        console.error('Falha ao copiar', err);
        window.customAlert ? window.customAlert("Não foi possível copiar automaticamente. Use este link: " + link) : alert("Use este link: " + link);
      });
    };
`;
            html = html.replace('</script>', func + '\n</script>');
        }
        fs.writeFileSync(file, html);
    }
});
console.log("Fixed errors");
