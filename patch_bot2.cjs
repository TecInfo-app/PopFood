const fs = require('fs');
let code = fs.readFileSync('whatsapp-bot.ts', 'utf8');

code = code.replace(
/export async function getWhatsappQr\(storeId\) \{[\s\S]*?\/\/ Create new session/m,
`export async function getWhatsappQr(storeId) {
  if (sessions.has(storeId)) {
    const session = sessions.get(storeId);
    if (session.qr) return { qr: session.qr };
    if (session.connected) return { connected: true };
    if (session.initialPromise) return await session.initialPromise;
  }
  // Create new session`
);

code = code.replace(
/sock\.ev\.on\('messages\.upsert', async \(m\) => \{/m,
`  });
  return sessionState.initialPromise;
  
    sock.ev.on('messages.upsert', async (m) => {`
);

fs.writeFileSync('whatsapp-bot.ts', code);
