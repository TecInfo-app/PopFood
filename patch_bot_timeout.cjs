const fs = require('fs');
let code = fs.readFileSync('whatsapp-bot.ts', 'utf8');

code = code.replace(
/sessionState\.initialPromise = new Promise\(\(resolve\) => \{([\s\S]*?)  \}\);\n\n  sock\.ev\.on\('messages\.upsert'/m,
`sessionState.initialPromise = new Promise((resolve) => {
    let resolved = false;
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ status: 'connecting' });
      }
    }, 3000);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        sessionState.qr = await QRCode.toDataURL(qr);
        if (!resolved) {
          resolved = true;
          resolve({ qr: sessionState.qr });
        }
      }

      if (connection === 'close') {
        sessionState.connected = false;
        sessionState.qr = null;
        const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
          setTimeout(() => {
             startWhatsappSession(storeId).catch(console.error);
          }, 2000);
        } else {
          sessions.delete(storeId);
        }
      } else if (connection === 'open') {
        sessionState.connected = true;
        sessionState.qr = null;
        if (!resolved) {
          resolved = true;
          resolve({ connected: true });
        }
        console.log(\`WhatsApp connected for store \${storeId}\`);
      }
    });
  });

  sock.ev.on('messages.upsert'`
);

fs.writeFileSync('whatsapp-bot.ts', code);
