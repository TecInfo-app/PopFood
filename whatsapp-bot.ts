import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

const sessions = new Map();
let db;

function clearAuthDirectory(storeId) {
  const dirPath = path.join(process.cwd(), `baileys_auth_info_${storeId}`);
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`[WhatsApp] Cleared auth directory: ${dirPath}`);
    } catch (err) {
      console.error(`[WhatsApp] Failed to delete auth directory ${dirPath}:`, err);
    }
  }
}

async function updateWhatsappDocInFirestore(storeId, data) {
  if (!db) return;
  try {
    const docRef = doc(db, "whatsapp_sessions", storeId);
    await setDoc(docRef, {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error(`Error updating Firestore session for ${storeId}:`, e);
  }
}

let actionsListenerUnsubscribe = null;

export function listenToWhatsappActions() {
  if (!db) return;
  if (actionsListenerUnsubscribe) {
    actionsListenerUnsubscribe();
  }
  
  const colRef = collection(db, "whatsapp_sessions");
  actionsListenerUnsubscribe = onSnapshot(colRef, (snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      if (change.type === "added" || change.type === "modified") {
        const storeId = change.doc.id;
        const data = change.doc.data();
        
        if (data.action === "generate") {
          console.log(`[Firestore Action] Generating QR code for store ${storeId}`);
          // Remove the action trigger to avoid repeated calls
          await updateWhatsappDocInFirestore(storeId, { action: null, status: 'connecting', qr: null, connected: false });
          // Trigger QR generation
          getWhatsappQr(storeId).catch(console.error);
        } else if (data.action === "logout") {
          console.log(`[Firestore Action] Logging out store ${storeId}`);
          await updateWhatsappDocInFirestore(storeId, { action: null });
          stopWhatsappSession(storeId).catch(console.error);
        }
      }
    });
  });
  console.log("Listening to real-time WhatsApp actions on Firestore.");
}

export function initWhatsappBot(firestoreDb) {
  db = firestoreDb;
  // Start listening to real-time actions
  listenToWhatsappActions();
}

export async function getWhatsappQr(storeId) {
  if (sessions.has(storeId)) {
    const session = sessions.get(storeId);
    if (session.connected) return { connected: true };
    
    // If not connected, clean up the old socket and session to start fresh
    if (session.sock) {
      try {
        session.sock.ev.removeAllListeners();
        session.sock.end(undefined);
      } catch (e) {}
    }
    sessions.delete(storeId);
  }
  
  // Clean up any old invalid credentials folder so Baileys is forced to generate a new QR code
  clearAuthDirectory(storeId);

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
      try {
        (session.sock.ev as any).removeAllListeners?.();
        session.sock.end(undefined);
      } catch (e) {}
    }
    sessions.delete(storeId);
  }
  // Clear directory just in case Baileys logout didn't fully delete it
  clearAuthDirectory(storeId);

  await updateWhatsappDocInFirestore(storeId, {
    connected: false,
    qr: null,
    status: 'disconnected'
  });
  return { success: true };
}

async function startWhatsappSession(storeId) {
  // Clean up any existing socket for this store if one exists
  const existingSession = sessions.get(storeId);
  if (existingSession && existingSession.sock) {
    try {
      (existingSession.sock.ev as any).removeAllListeners?.();
      existingSession.sock.end(undefined);
    } catch (e) {}
  }

  // Set initial status to connecting in Firestore
  await updateWhatsappDocInFirestore(storeId, {
    connected: false,
    qr: null,
    status: 'connecting'
  });

  const { state, saveCreds } = await useMultiFileAuthState(`baileys_auth_info_${storeId}`);
  const version: any = [6, 33, 0];
  
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
        await updateWhatsappDocInFirestore(storeId, {
          connected: false,
          qr: sessionState.qr,
          status: 'qr_ready'
        });
        if (!resolved) {
          resolved = true;
          resolve({ qr: sessionState.qr });
        }
      }

      if (connection === 'close') {
        const wasConnected = sessionState.connected === true;
        sessionState.connected = false;
        sessionState.qr = null;
        
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        console.log(`[WhatsApp] Connection closed for store ${storeId}. Status code: ${statusCode}. Was connected: ${wasConnected}. Error:`, lastDisconnect?.error);

        // DisconnectReason.restartRequired (515) occurs during normal login / authentication stream transitions
        const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;
        if (isRestartRequired) {
          console.log(`[WhatsApp] Restart required (515) for store ${storeId}. Reconnecting immediately...`);
          try {
            (sock.ev as any).removeAllListeners?.();
            sock.end(undefined);
          } catch (e) {}
          setTimeout(() => {
            if (sessions.has(storeId)) {
              startWhatsappSession(storeId).catch(console.error);
            }
          }, 1000);
          return;
        }

        // If logged out, timed out during QR code generation (408), or the session is invalidated/bad (e.g. 401, 403, 500, 411), stop reconnecting and clear files
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isBadSession = statusCode === 401 || statusCode === 403 || statusCode === 500 || statusCode === 411;
        const isQrTimeout = !wasConnected && (statusCode === DisconnectReason.timedOut || statusCode === 408);

        if (isLoggedOut || isBadSession || isQrTimeout) {
          console.log(`[WhatsApp] Session closed (isLoggedOut: ${isLoggedOut}, isBadSession: ${isBadSession}, isQrTimeout: ${isQrTimeout}) for store ${storeId}. Clearing auth directory.`);
          sessions.delete(storeId);
          clearAuthDirectory(storeId);
          await updateWhatsappDocInFirestore(storeId, {
            connected: false,
            qr: null,
            status: 'disconnected'
          });
        } else {
          // It's a temporary connection drop. Try to reconnect after a delay.
          await updateWhatsappDocInFirestore(storeId, {
            connected: false,
            qr: null,
            status: 'disconnected'
          });
          
          setTimeout(() => {
            // Only reconnect if the session still exists in our Map and hasn't been deleted
            if (sessions.has(storeId)) {
              startWhatsappSession(storeId).catch(console.error);
            }
          }, 5000);
        }
      } else if (connection === 'open') {
        sessionState.connected = true;
        sessionState.qr = null;
        await updateWhatsappDocInFirestore(storeId, {
          connected: true,
          qr: null,
          status: 'connected'
        });
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

// Phone extraction and matching helpers
function extractPhoneVariations(senderId: string): string[] {
  const clean = (senderId || '').split('@')[0].split(':')[0].replace(/\D/g, '');
  const variations = new Set<string>();
  if (!clean) return [];

  variations.add(clean);

  // If starts with 55 (Brazil country code)
  if (clean.startsWith('55') && clean.length >= 12) {
    const withoutCountry = clean.slice(2); // e.g. 81988887777 or 8188887777
    variations.add(withoutCountry);
    
    // DDD (2 digits) + number
    const ddd = withoutCountry.slice(0, 2);
    const num = withoutCountry.slice(2);
    if (num.length === 9 && num.startsWith('9')) {
      // 8-digit variation without leading 9
      variations.add(ddd + num.slice(1));
    } else if (num.length === 8) {
      // 9-digit variation with leading 9
      variations.add(ddd + '9' + num);
    }
  }

  // Last 8 and 9 digits
  if (clean.length >= 8) variations.add(clean.slice(-8));
  if (clean.length >= 9) variations.add(clean.slice(-9));

  return Array.from(variations);
}

function phoneMatches(orderPhone: string, senderVariations: string[]): boolean {
  if (!orderPhone) return false;
  const cleanOrderPhone = orderPhone.replace(/\D/g, '');
  if (!cleanOrderPhone) return false;

  for (const v of senderVariations) {
    if (cleanOrderPhone === v || cleanOrderPhone.endsWith(v) || v.endsWith(cleanOrderPhone)) {
      return true;
    }
  }
  return false;
}

// Find orders placed by this customer's phone number
async function findOrdersByCustomer(storeId: string, senderId: string): Promise<any[]> {
  const variations = extractPhoneVariations(senderId);
  if (variations.length === 0) return [];

  try {
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("storeId", "==", storeId));
    const qSnap = await getDocs(q);

    const matchedOrders: any[] = [];
    qSnap.forEach(d => {
      const o = d.data();
      const phone = o.customer?.phone || o.phone || o.customerPhone || '';
      if (phoneMatches(phone, variations)) {
        matchedOrders.push({ id: d.id, ...o });
      }
    });

    // Sort descending by creation date
    matchedOrders.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date || 0).getTime();
      const dateB = new Date(b.createdAt || b.date || 0).getTime();
      return dateB - dateA;
    });

    return matchedOrders;
  } catch (e) {
    console.error("[WhatsApp] Error searching orders by customer phone:", e);
    return [];
  }
}

// Find order by typed ID or number (e.g. PF123456, #PF123456, 123456, #123456)
async function findOrderByIdOrNumber(storeId: string, text: string): Promise<any | null> {
  const clean = text.trim();
  const candidates: string[] = [];

  // Match PF123456 or pf123456
  const pfMatches = clean.match(/pf\s*(\d+)/gi);
  if (pfMatches) {
    pfMatches.forEach(m => {
      const numOnly = m.replace(/pf\s*/i, '');
      candidates.push('PF' + numOnly);
    });
  }

  // Match #123456 or #PF123456
  const hashMatches = clean.match(/#\s*([a-z0-9]+)/gi);
  if (hashMatches) {
    hashMatches.forEach(m => {
      const cleanVal = m.replace(/#\s*/, '').trim().toUpperCase();
      candidates.push(cleanVal);
      if (!cleanVal.startsWith('PF')) {
        candidates.push('PF' + cleanVal);
      }
    });
  }

  // Match standalone number of 4 to 8 digits
  const numMatches = clean.match(/\b\d{4,8}\b/g);
  if (numMatches) {
    numMatches.forEach(n => {
      candidates.push(n);
      candidates.push('PF' + n);
    });
  }

  // If text without prefix words is an ID
  const stripped = clean
    .replace(/^(status|pedido|consultar|ver|rastrear|rastreio|id|numero|número)\s*/i, '')
    .replace(/^[#\s]+/, '')
    .trim()
    .toUpperCase();
  if (stripped && stripped.length >= 3) {
    candidates.push(stripped);
    if (!stripped.startsWith('PF')) {
      candidates.push('PF' + stripped);
    }
  }

  const uniqueCandidates = Array.from(new Set(candidates.filter(c => c && c.length >= 3)));

  // 1. Direct lookup by document ID
  for (const cand of uniqueCandidates) {
    try {
      const snap = await getDoc(doc(db, "orders", cand));
      if (snap.exists()) {
        const data = snap.data();
        if (data.storeId === storeId) {
          return { id: snap.id, ...data };
        }
      }
    } catch (e) {}
  }

  // 2. Query orders for the store if direct lookup misses
  try {
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("storeId", "==", storeId));
    const qSnap = await getDocs(q);

    for (const d of qSnap.docs) {
      const o = d.data();
      const orderId = (o.id || d.id || '').toString().toUpperCase();
      for (const cand of uniqueCandidates) {
        if (orderId === cand || orderId.endsWith(cand) || cand.endsWith(orderId)) {
          return { id: d.id, ...o };
        }
      }
    }
  } catch (e) {
    console.error("[WhatsApp] Error querying orders by ID:", e);
  }

  return null;
}

// Format full order status message
function formatOrderStatusMessage(order: any, storeId: string, profile: any): string {
  const statusMap: Record<string, string> = {
    'Pendente': '⏳ Pendente (Aguardando Restaurante)',
    'pending': '⏳ Pendente (Aguardando Restaurante)',
    'AguardandoPagamento': '💳 Aguardando Pagamento',
    'Aceito': '🍳 Aceito e em Preparo',
    'Em Preparo': '🍳 Aceito e em Preparo',
    'Preparando': '🍳 Aceito e em Preparo',
    'accepted': '🍳 Aceito e em Preparo',
    'Saiu para Entrega': '🛵 Saiu para Entrega (A caminho)',
    'Saiu para entrega': '🛵 Saiu para Entrega (A caminho)',
    'dispatch': '🛵 Saiu para Entrega (A caminho)',
    'Em Rota': '🛵 Saiu para Entrega (A caminho)',
    'Pronto para Retirada': '🛍️ Pronto para Retirada no Balcão',
    'ready': '🛍️ Pronto para Retirada no Balcão',
    'Pronto': '🛍️ Pronto para Retirada no Balcão',
    'Finalizado': '✅ Concluído e Entregue',
    'Concluído': '✅ Concluído e Entregue',
    'completed': '✅ Concluído e Entregue',
    'Entregue': '✅ Concluído e Entregue',
    'Cancelado': '❌ Pedido Cancelado',
    'cancelled': '❌ Pedido Cancelado'
  };

  const st = statusMap[order.status] || order.status || 'Em Processamento';

  const customBaseUrl = profile?.whatsappLinkUrl || 'https://tecinfo-app.github.io/PopFood';
  const normalizedBaseUrl = customBaseUrl.endsWith('/') ? customBaseUrl.slice(0, -1) : customBaseUrl;
  const trackUrl = `${normalizedBaseUrl}/acompanhamento.html?store=${storeId}&order=${order.id}`;

  let itemsText = '';
  if (Array.isArray(order.items) && order.items.length > 0) {
    itemsText = '\n\n📋 *Itens do Pedido:*\n' + order.items.map((i: any) => {
      const q = i.quantity || 1;
      const price = Number(i.totalItemPrice || i.price || 0);
      return `• ${q}x ${i.name || 'Item'} (R$ ${price.toFixed(2).replace('.', ',')})`;
    }).join('\n');
  }

  let deliveryInfo = '';
  if (order.customer?.type === 'pickup' || order.customer?.address === 'Retirada no Restaurante') {
    deliveryInfo = '\n🏪 *Tipo:* Retirada no Balcão';
  } else if (order.customer?.address) {
    deliveryInfo = `\n📍 *Entrega em:* ${order.customer.address}`;
    if (order.customer.complement) deliveryInfo += ` (${order.customer.complement})`;
  }

  let pinText = '';
  if (order.deliveryPin && order.status !== 'Finalizado' && order.status !== 'Concluído' && order.status !== 'Entregue' && order.status !== 'Cancelado') {
    pinText = `\n🔑 *PIN de Entrega:* *${order.deliveryPin}*`;
  }

  const totalVal = Number(order.total || 0).toFixed(2).replace('.', ',');
  const payMethod = order.paymentMethod ? ` (${order.paymentMethod})` : '';
  const orderDate = order.date || (order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : 'Hoje');

  return `📦 *Status do Pedido #${order.id}*\n\n` +
         `🚦 *Status:* ${st}\n` +
         `🕒 *Data:* ${orderDate}` +
         `${itemsText}\n\n` +
         `💰 *Total:* R$ ${totalVal}${payMethod}` +
         `${deliveryInfo}` +
         `${pinText}\n\n` +
         `👉 *Acompanhe em tempo real:* \n${trackUrl}`;
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

  // Render template helpers
  function renderTemplate(template, profile, storeId) {
    const name = profile.name || 'Nosso Restaurante';
    const description = profile.description || 'A melhor comida da região!';
    const openTime = profile.openTime || '--:--';
    const closeTime = profile.closeTime || '--:--';
    
    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const operatingDays = (profile.operatingDays || [])
      .map(d => typeof d === 'number' ? (dayNames[d] || d) : d)
      .join(', ');

    const customBaseUrl = profile.whatsappLinkUrl || 'https://tecinfo-app.github.io/PopFood';
    const normalizedBaseUrl = customBaseUrl.endsWith('/') ? customBaseUrl.slice(0, -1) : customBaseUrl;
    const link = `${normalizedBaseUrl}/cliente.html?store=${storeId}`;

    return template
      .replace(/{name}/g, name)
      .replace(/{description}/g, description)
      .replace(/{openTime}/g, openTime)
      .replace(/{closeTime}/g, closeTime)
      .replace(/{operatingDays}/g, operatingDays)
      .replace(/{link}/g, link);
  }

  const lowerText = text.toLowerCase().trim();

  // A. Check if the message contains an explicit Order ID or Order Number search
  const isExplicitIdQuery = /^(status|pedido|rastrear|rastreio|ver|consultar)\s*[#\s]*[a-z0-9]+/i.test(lowerText) ||
                            /^#\s*[a-z0-9]+/i.test(lowerText) ||
                            /^pf\s*\d+/i.test(lowerText) ||
                            /^\d{4,8}$/.test(lowerText);

  if (isExplicitIdQuery) {
    const foundOrder = await findOrderByIdOrNumber(storeId, text);
    if (foundOrder) {
      const reply = formatOrderStatusMessage(foundOrder, storeId, profile);
      await sock.sendMessage(senderId, { text: reply });
      return;
    }

    // If it was explicitly trying to check an ID and not found
    if (!['1', '2', '3', '4'].includes(lowerText)) {
      const customBaseUrl = profile.whatsappLinkUrl || 'https://tecinfo-app.github.io/PopFood';
      const normalizedBaseUrl = customBaseUrl.endsWith('/') ? customBaseUrl.slice(0, -1) : customBaseUrl;
      const link = `${normalizedBaseUrl}/cliente.html?store=${storeId}`;

      const notFoundMsg = `❌ *Pedido não localizado.*\n\nNão encontramos nenhum pedido com esse número em nossa loja.\n\nPor favor, verifique o código digitado (ex: *#PF123456* ou *123456*) ou faça um novo pedido em nosso cardápio:\n👉 ${link}`;
      await sock.sendMessage(senderId, { text: notFoundMsg });
      return;
    }
  }

  // B. Option 4 or General Status queries -> Automatically check customer phone!
  const isStatusIntent = lowerText === '4' ||
                         lowerText === 'status' ||
                         lowerText.includes('meu pedido') ||
                         lowerText.includes('meus pedidos') ||
                         lowerText.includes('rastrear') ||
                         lowerText.includes('rastreio') ||
                         lowerText.includes('rastreamento') ||
                         lowerText.includes('onde esta meu pedido') ||
                         lowerText.includes('onde está meu pedido') ||
                         lowerText.includes('como esta meu pedido') ||
                         lowerText.includes('como está meu pedido') ||
                         lowerText.includes('consultar pedido') ||
                         lowerText.includes('status do pedido');

  if (isStatusIntent) {
    const customerOrders = await findOrdersByCustomer(storeId, senderId);
    if (customerOrders.length > 0) {
      // Find active order or fallback to the latest order
      const activeStatuses = ['Pendente', 'pending', 'AguardandoPagamento', 'Aceito', 'Em Preparo', 'Preparando', 'accepted', 'Saiu para Entrega', 'Saiu para entrega', 'dispatch', 'Em Rota', 'Pronto para Retirada', 'ready', 'Pronto'];
      const activeOrder = customerOrders.find(o => activeStatuses.includes(o.status)) || customerOrders[0];

      let reply = formatOrderStatusMessage(activeOrder, storeId, profile);
      if (customerOrders.length > 1) {
        reply += `\n\n💡 _Identificamos seu pedido recente. Para consultar outro pedido específico, digite o número dele (ex: #PF123456 ou 123456)._`;
      }
      await sock.sendMessage(senderId, { text: reply });
      return;
    }

    // If no order found for this phone number, send polite guidance
    const customStatusTemplate = profile.whatsappStatus;
    if (customStatusTemplate && customStatusTemplate.trim()) {
      const reply = renderTemplate(customStatusTemplate, profile, storeId);
      await sock.sendMessage(senderId, { text: reply });
      return;
    }

    const customBaseUrl = profile.whatsappLinkUrl || 'https://tecinfo-app.github.io/PopFood';
    const normalizedBaseUrl = customBaseUrl.endsWith('/') ? customBaseUrl.slice(0, -1) : customBaseUrl;
    const link = `${normalizedBaseUrl}/cliente.html?store=${storeId}`;

    const noOrderReply = `🔎 *Consulta de Status de Pedido*\n\nNão localizamos nenhum pedido recente associado ao seu número de WhatsApp no momento.\n\n👉 Se você já realizou um pedido, digite o código dele aqui (ex: *#PF123456* ou *123456*) para consultar.\n\n👉 Ou monte seu pedido em nosso cardápio online:\n${link}`;
    await sock.sendMessage(senderId, { text: noOrderReply });
    return;
  }

  // 1. Mensagem de Boas-Vindas / Menu Principal
  if (lowerText === 'ola' || lowerText === 'olá' || lowerText === 'oi' || lowerText === 'menu' || lowerText === 'bom dia' || lowerText === 'boa tarde' || lowerText === 'boa noite' || lowerText === 'inicio' || lowerText === 'início' || lowerText === 'opcoes' || lowerText === 'opções') {
    const welcomeTemplate = profile.whatsappWelcome || `Olá! Bem-vindo(a) ao *{name}*! 🍔🍕\n_{description}_\n\nDigite o número da opção desejada:\n1️⃣ *Cardápio*\n2️⃣ *Horário de Funcionamento*\n3️⃣ *Fazer Pedido*\n4️⃣ *Status do Pedido*`;
    const reply = renderTemplate(welcomeTemplate, profile, storeId);
    await sock.sendMessage(senderId, { text: reply });
    return;
  }

  // 2. Horários de funcionamento da loja
  if (lowerText === '2' || lowerText.includes('horario') || lowerText.includes('horário') || lowerText.includes('funcionamento') || lowerText.includes('aberto') || lowerText.includes('fechado')) {
    const hoursTemplate = profile.whatsappHours || `🕒 *Nosso horário de funcionamento:*\nDas {openTime} às {closeTime}\nDias: {operatingDays}`;
    const reply = renderTemplate(hoursTemplate, profile, storeId);
    await sock.sendMessage(senderId, { text: reply });
    return;
  }

  // 3. Cardápio atualizado (buscando os dados direto do nosso banco)
  if (lowerText === '1' || lowerText.includes('cardapio') || lowerText.includes('cardápio') || lowerText.includes('produtos') || lowerText.includes('catalogo') || lowerText.includes('catálogo')) {
    const productsRef = collection(db, "products");
    const q = query(productsRef, where("storeId", "==", storeId));
    const qSnap = await getDocs(q);
    
    let menuText = `📋 *Nosso Cardápio:*\n\n`;
    const categories: Record<string, any[]> = {};
    qSnap.forEach(docSnap => {
      const p = docSnap.data();
      const cat = p.category || 'Geral';
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push(p);
    });

    for (const [cat, items] of Object.entries(categories)) {
      menuText += `*${cat.toUpperCase()}*\n`;
      items.forEach(item => {
        menuText += `- ${item.name}: R$ ${Number(item.price || 0).toFixed(2).replace('.', ',')}\n`;
      });
      menuText += `\n`;
    }
    
    if (Object.keys(categories).length === 0) {
      menuText = "Desculpe, nosso cardápio está sendo atualizado no momento.";
    } else {
      const customBaseUrl = profile.whatsappLinkUrl || 'https://tecinfo-app.github.io/PopFood';
      const normalizedBaseUrl = customBaseUrl.endsWith('/') ? customBaseUrl.slice(0, -1) : customBaseUrl;
      const link = `${normalizedBaseUrl}/cliente.html?store=${storeId}`;
      menuText += `👉 *Peça online com fotos e adicionais:* \n${link}`;
    }

    await sock.sendMessage(senderId, { text: menuText });
    return;
  }

  // 4. Fazer Pedido / Link do Cardápio
  if (lowerText === '3' || lowerText.includes('fazer pedido') || lowerText.includes('pedir') || lowerText.includes('comprar') || lowerText.includes('link')) {
    const orderTemplate = profile.whatsappOrder || `🛒 *Pronto para pedir?*\nAcesse nosso site para montar seu pedido com facilidade e segurança:\n👉 {link}`;
    const reply = renderTemplate(orderTemplate, profile, storeId);
    await sock.sendMessage(senderId, { text: reply });
    return;
  }

  // Default fallback reply
  const defaultReply = `Desculpe, não entendi. Digite *Oi* ou *Menu* para ver as opções disponíveis ou *4* para consultar seu pedido.`;
  await sock.sendMessage(senderId, { text: defaultReply });
}
