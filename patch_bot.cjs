const fs = require('fs');
let code = fs.readFileSync('whatsapp-bot.ts', 'utf8');

code = code.replace(
/export async function getWhatsappQr\(storeId\) \{([\s\S]*?)\}  \/\//,
`export async function getWhatsappQr(storeId) {
  if (sessions.has(storeId)) {
    const session = sessions.get(storeId);
    if (session.qr) return { qr: session.qr };
    if (session.connected) return { connected: true };
    if (session.initialPromise) return await session.initialPromise;
  }
  //`
);

code = code.replace(
/const sessionState = \{\s*sock,\s*qr: null,\s*connected: false\s*\};\s*sessions\.set\(storeId, sessionState\);\s*sock\.ev\.on\('creds\.update', saveCreds\);\s*return new Promise\(\(resolve\) => \{/,
`const sessionState: any = {
    sock,
    qr: null,
    connected: false,
    initialPromise: null
  };
  sessions.set(storeId, sessionState);
  sock.ev.on('creds.update', saveCreds);

  sessionState.initialPromise = new Promise((resolve) => {`
);

code = code.replace(
/sock\.ev\.on\('messages\.upsert', async \(m\) => \{/,
`return sessionState.initialPromise;
    }); // END OF REPLACE
    
    sock.ev.on('messages.upsert', async (m) => {`
);

code = code.replace(/return sessionState\.initialPromise;\s*\}\); \/\/ END OF REPLACE/, '');

fs.writeFileSync('whatsapp-bot.ts', code);
