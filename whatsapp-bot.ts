import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import pino from 'pino';

const sessions = new Map();
let db;

export function initWhatsappBot(firestoreDb) {
  db = firestoreDb;
}

export async function getWhatsappQr(storeId) {
  if (sessions.has(storeId)) {
    const session = sessions.get(storeId);
    if (session.qr) return { qr: session.qr };
    if (session.connected) return { connected: true };
    if (session.initialPromise) return await session.initialPromise;
  }
  // Create new session
  return await startWhatsappSession(storeId);
}

export async function getWhatsappStatus(storeId) {
  if (sessions.has(storeId)) {
    const session = sessions.get(storeId);
    return { 
      connected: session.connected, 
      qr: session.qr,
      status: session.connected ? 'connected' : (session.qr ? 'qr_ready' : 'connecting')
    };
  }
  return { status: 'disconnected', connected: false };
}

export async function stopWhatsappSession(storeId) {
  if (sessions.has(storeId)) {
    const session = sessions.get(storeId);
    if (session.sock) {
      session.sock.logout();
    }
    sessions.delete(storeId);
  }
  return { success: true };
}

async function startWhatsappSession(storeId) {
  const { state, saveCreds } = await useMultiFileAuthState(`baileys_auth_info_${storeId}`);
  let version: any = [6, 33, 0];
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
  } catch (err) {
    console.warn("Failed to fetch latest Baileys version, using fallback", err);
  }
  
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
        console.log(`WhatsApp connected for store ${storeId}`);
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

async function handleIncomingMessage(storeId, sock, senderId, text) {
  // Fetch store profile
  const profileRef = doc(db, "restaurantProfile", storeId);
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) return;
  const profile = profileSnap.data();

  if (profile.whatsappBotPaused) {
    return;
  }

  const lowerText = text.toLowerCase();

  // 1. O bordão da loja e mensagem de boas-vindas
  if (lowerText === 'ola' || lowerText === 'olá' || lowerText === 'oi' || lowerText === 'menu') {
    const welcome = `Olá! Bem-vindo(a) ao *${profile.name || 'Nosso Restaurante'}*! 🍔🍕\n_${profile.description || 'A melhor comida da região!'}_`;
    const options = `\n\nDigite o número da opção desejada:\n1️⃣ *Cardápio*\n2️⃣ *Horário de Funcionamento*\n3️⃣ *Fazer Pedido*\n4️⃣ *Status do Pedido*`;
    await sock.sendMessage(senderId, { text: welcome + options });
    return;
  }

  // 2. Os horários de funcionamento da loja
  if (lowerText === '2' || lowerText.includes('horario') || lowerText.includes('horário')) {
    const openTime = profile.openTime || '--:--';
    const closeTime = profile.closeTime || '--:--';
    const days = (profile.operatingDays || []).join(', ');
    const reply = `🕒 *Nosso horário de funcionamento:*\nDas ${openTime} às ${closeTime}\nDias: ${days}`;
    await sock.sendMessage(senderId, { text: reply });
    return;
  }

  // 3. O cardápio atualizado (buscando os dados direto do nosso app)
  if (lowerText === '1' || lowerText.includes('cardapio') || lowerText.includes('cardápio')) {
    const productsRef = collection(db, "products");
    const q = query(productsRef, where("storeId", "==", storeId));
    const qSnap = await getDocs(q);
    
    let menuText = `📋 *Nosso Cardápio:*\n\n`;
    const categories: Record<string, any[]> = {};
    qSnap.forEach(doc => {
      const p = doc.data();
      if (!categories[p.category]) categories[p.category] = [];
      categories[p.category].push(p);
    });

    for (const [cat, items] of Object.entries(categories)) {
      menuText += `*${cat.toUpperCase()}*\n`;
      items.forEach(item => {
        menuText += `- ${item.name}: R$ ${Number(item.price).toFixed(2)}\n`;
      });
      menuText += `\n`;
    }
    
    if (Object.keys(categories).length === 0) {
      menuText = "Desculpe, nosso cardápio está sendo atualizado.";
    }

    await sock.sendMessage(senderId, { text: menuText });
    return;
  }

  // 4. Um comando para o cliente receber o link da página web para finalizar o pedido
  if (lowerText === '3' || lowerText.includes('pedido') || lowerText.includes('fazer pedido')) {
    // Determine the base URL (if deployed, it would be the app URL, otherwise fallback)
    const baseUrl = process.env.VITE_APP_URL || 'https://ais-pre-huiqzqgxqhno7p52tquz6q-756386363755.us-east1.run.app';
    const link = `${baseUrl}/cliente.html?store=${storeId}`;
    const reply = `🛒 *Pronto para pedir?*\nAcesse nosso site para montar seu pedido com facilidade e segurança:\n👉 ${link}`;
    await sock.sendMessage(senderId, { text: reply });
    return;
  }

  // 5. Uma forma de o cliente consultar o status do pedido dele
  if (lowerText === '4' || lowerText.includes('status')) {
    const reply = `🔎 *Status do Pedido:*\nPor favor, acesse o link de acompanhamento que foi enviado no seu e-mail ou visualize direto pelo nosso site através do botão "Acompanhar Pedido".\n\nSe você sabe o ID do pedido, digite *status #SEU_ID* (ex: status #abc123)`;
    await sock.sendMessage(senderId, { text: reply });
    return;
  }

  if (lowerText.startsWith('status #')) {
    const orderId = lowerText.split('#')[1]?.trim();
    if (orderId) {
      const orderRef = doc(db, "orders", orderId);
      const orderSnap = await getDoc(orderRef);
      if (orderSnap.exists()) {
        const order = orderSnap.data();
        if (order.storeId === storeId) {
          const statusMap = {
            'pending': 'Pendente ⏳',
            'accepted': 'Aceito e em Preparo 🍳',
            'dispatch': 'Saiu para Entrega 🏍️',
            'ready': 'Pronto para Retirada 🛍️',
            'completed': 'Concluído ✅',
            'cancelled': 'Cancelado ❌'
          };
          const st = statusMap[order.status] || order.status;
          await sock.sendMessage(senderId, { text: `📦 Status do pedido *#${orderId}*:\n\n*${st}*` });
          return;
        }
      }
    }
    await sock.sendMessage(senderId, { text: `❌ Não encontramos um pedido com esse ID.` });
    return;
  }

  // Default reply
  const defaultReply = `Desculpe, não entendi. Digite *Oi* ou *Menu* para ver as opções.`;
  await sock.sendMessage(senderId, { text: defaultReply });
}
