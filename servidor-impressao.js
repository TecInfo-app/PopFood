const http = require('http');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 8080;

// Função para pegar o IP da rede local
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      resolve(stdout.trim());
    });
  });
}

const server = http.createServer(async (req, res) => {
  // === CONFIGURAÇÃO DE CORS (Essencial para não bloquear no navegador) ===
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Continua na requisição OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 1. ROTA: Listar Impressoras
  if (req.method === 'GET' && req.url === '/impressoras') {
    try {
      // Usa o PowerShell do Windows para listar todas as impressoras
      const stdout = await executeCommand('powershell -command "Get-Printer | Select-Object -ExpandProperty Name"');
      const printers = stdout.split('\n').map(p => p.trim()).filter(p => p.length > 0);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ impressoras: printers }));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  } 
  
  // 2. ROTA: Mandar Imprimir
  else if (req.method === 'POST' && req.url === '/imprimir') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        const printerName = payload.impressora;
        const texto = payload.texto || payload.content;
        const pedidoId = payload.id ? String(payload.id).slice(-6).toUpperCase() : Date.now();

        if (!printerName || !texto) {
          throw new Error("Impressora ou conteúdo para impressão não enviados.");
        }

        // Cria um arquivo temporário com os dados da comanda
        const tempFile = path.join(os.tmpdir(), `Comanda_${pedidoId}.txt`);
        fs.writeFileSync(tempFile, texto, 'utf8');

        // Usa o Wordpad para imprimir em segundo plano na impressora específica
        console.log(`Imprimindo na impressora: ${printerName}`);
        const cmd = `wordpad /pt "${tempFile}" "${printerName}"`;
        await executeCommand(cmd);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Enviado para impressão!' }));
        
        // Remove o arquivo após 5 segundos
        setTimeout(() => { if(fs.existsSync(tempFile)) fs.unlinkSync(tempFile); }, 5000);
      } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } 
  
  else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const ip = getLocalIp();
server.listen(PORT, '0.0.0.0', () => {
  console.log('===================================================');
  console.log(' SERVIDOR DE IMPRESSÃO POPFOOD ONLINE');
  console.log('===================================================');
  console.log(' O servidor está rodando na sua máquina e pode');
  console.log(' ser encontrado neste IP (Digite isso no painel):');
  console.log(' ');
  console.log(`          http://${ip}:${PORT}`);
  console.log(' ');
  console.log('===================================================');
  console.log(' * Minimize esta janela preta, não feche!');
});
