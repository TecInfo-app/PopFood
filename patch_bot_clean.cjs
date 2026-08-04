const fs = require('fs');
let code = fs.readFileSync('whatsapp-bot.ts', 'utf8');

const regex = /async function startWhatsappSession\(storeId\) \{[\s\S]*?async function handleIncomingMessage/m;
const replacement = `async function startWhatsappSession(storeId) {
  const { state, saveCreds } = await useMultiFileAuthState(\`baileys_auth_info_\${storeId}\`);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false,
    logger: pino({ level: 'silent' })
  });

  const sessionState: any = {
    sock,
    qr: null,
    connected: false,
    initialPromise: null
  };
  sessions.set(storeId, sessionState);
  sock.ev.on('creds.update', saveCreds);

  sessionState.initialPromise = new Promise((resolve) => {
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        sessionState.qr = await QRCode.toDataURL(qr);
        resolve({ qr: sessionState.qr });
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
        resolve({ connected: true });
        console.log(\`WhatsApp connected for store \${storeId}\`);
      }
    });
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const senderId = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    
    await handleIncomingMessage(storeId, sock, senderId, text.trim());
  });

  return sessionState.initialPromise;
}

async function handleIncomingMessage`;

code = code.replace(regex, replacement);
fs.writeFileSync('whatsapp-bot.ts', code);
