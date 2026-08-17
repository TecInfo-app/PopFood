import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import { getFirestore, doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import pino from 'pino';
import fs from 'fs';
import path from 'path';

const sessions = new Map();
const startingLocks = new Map<string, Promise<any>>();
const reconnectTimers = new Map();
const conflictAttempts = new Map<string, number>();
let db;

interface CachedProfile {
  profile: any;
  fetchedAt: number;
}
interface CachedCoupons {
  coupons: any[];
  fetchedAt: number;
}
interface CachedOrders {
  orders: any[];
  fetchedAt: number;
}

const profileCache = new Map<string, CachedProfile>();
const couponsCache = new Map<string, CachedCoupons>();
const ordersCache = new Map<string, CachedOrders>();

const PROFILE_CACHE_TTL_MS = 60000; // 1 minute
const COUPONS_CACHE_TTL_MS = 300000; // 5 minutes
const ORDERS_CACHE_TTL_MS = 15000; // 15 seconds

async function getRestaurantProfileWithCache(storeId: string): Promise<any | null> {
  const cached = profileCache.get(storeId);
  const now = Date.now();
  if (cached && (now - cached.fetchedAt < PROFILE_CACHE_TTL_MS)) {
    console.log(`[Cache Hit] Using cached profile for store ${storeId}`);
    return cached.profile;
  }

  console.log(`[Cache Miss] Fetching profile from Firestore for store ${storeId}`);
  const profileRef = doc(db, "restaurantProfile", storeId);
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) {
    return null;
  }
  const profile = profileSnap.data();
  profileCache.set(storeId, {
    profile,
    fetchedAt: now
  });
  return profile;
}

async function getStoreCouponsWithCache(storeId: string): Promise<any[]> {
  const cached = couponsCache.get(storeId);
  const now = Date.now();
  if (cached && (now - cached.fetchedAt < COUPONS_CACHE_TTL_MS)) {
    console.log(`[Cache Hit] Using cached coupons for store ${storeId}`);
    return cached.coupons;
  }

  console.log(`[Cache Miss] Fetching coupons from Firestore for store ${storeId}`);
  const couponsRef = collection(db, "coupons");
  const q = query(couponsRef, where("storeId", "==", storeId));
  const qSnap = await getDocs(q);

  const coupons: any[] = [];
  qSnap.forEach(docSnap => {
    const c = docSnap.data();
    if (c.active) coupons.push(c);
  });

  couponsCache.set(storeId, {
    coupons,
    fetchedAt: now
  });

  return coupons;
}

async function getStoreOrdersWithCache(storeId: string): Promise<any[]> {
  const cached = ordersCache.get(storeId);
  const now = Date.now();
  if (cached && (now - cached.fetchedAt < ORDERS_CACHE_TTL_MS)) {
    console.log(`[Cache Hit] Using cached orders for store ${storeId}`);
    return cached.orders;
  }

  console.log(`[Cache Miss] Fetching orders from Firestore for store ${storeId}`);
  const ordersRef = collection(db, "orders");
  const q = query(ordersRef, where("storeId", "==", storeId));
  const qSnap = await getDocs(q);

  const orders: any[] = [];
  qSnap.forEach(d => {
    orders.push({ id: d.id, ...d.data() });
  });

  ordersCache.set(storeId, {
    orders,
    fetchedAt: now
  });

  return orders;
}

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
        
        if (data.action === "generate" || data.action === "force_reset") {
          console.log(`[Firestore Action] Generating / resetting QR code for store ${storeId}`);
          // Clear action and reset document state immediately
          await updateWhatsappDocInFirestore(storeId, { action: null, status: 'connecting', qr: null, connected: false });
          // Stop and clean any old session, then start fresh
          try {
            await stopWhatsappSession(storeId);
          } catch (e) {}
          getWhatsappQr(storeId).catch(console.error);
        } else if (data.action === "logout") {
          console.log(`[Firestore Action] Logging out store ${storeId}`);
          await updateWhatsappDocInFirestore(storeId, { action: null, connected: false, qr: null, status: 'disconnected' });
          stopWhatsappSession(storeId).catch(console.error);
        }
      }
    });
  });
  console.log("Listening to real-time WhatsApp actions on Firestore.");
}

async function restoreSavedSessions() {
  try {
    const cwd = process.cwd();
    const files = fs.readdirSync(cwd);
    for (const f of files) {
      if (f.startsWith('baileys_auth_info_')) {
        const storeId = f.replace('baileys_auth_info_', '');
        const credsPath = path.join(cwd, f, 'creds.json');
        if (fs.existsSync(credsPath)) {
          console.log(`[WhatsApp Bot] Found existing credentials for store: ${storeId}. Restoring session...`);
          startWhatsappSession(storeId).catch((err) => {
            console.error(`[WhatsApp Bot] Failed to restore session for store ${storeId}:`, err);
          });
        }
      }
    }
  } catch (e) {
    console.error("[WhatsApp Bot] Error restoring saved sessions:", e);
  }
}

export function initWhatsappBot(firestoreDb) {
  db = firestoreDb;
  // Start listening to real-time actions
  listenToWhatsappActions();
  // Restore any existing connected sessions on server boot
  restoreSavedSessions().catch(console.error);
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
  // If a session is already starting for this store, wait for it
  if (startingLocks.has(storeId)) {
    return startingLocks.get(storeId);
  }

  const startPromise = (async () => {
    // Clear any pending reconnect timer for this store
    if (reconnectTimers.has(storeId)) {
      clearTimeout(reconnectTimers.get(storeId));
      reconnectTimers.delete(storeId);
    }

    // Clean up any existing socket for this store if one exists
    const existingSession = sessions.get(storeId);
    if (existingSession && existingSession.sock) {
      try {
        (existingSession.sock.ev as any).removeAllListeners?.('connection.update');
        (existingSession.sock.ev as any).removeAllListeners?.('creds.update');
        (existingSession.sock.ev as any).removeAllListeners?.('messages.upsert');
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
    let version: any = [2, 3000, 1017531234];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v && v.version) {
        version = v.version;
      }
    } catch (e) {}
    
    const sock = makeWASocket({
      version,
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      markOnlineOnConnect: false,
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 2000,
      maxMsgRetryCount: 5,
      shouldIgnoreJid: (jid) => jid.includes('status@broadcast') || jid.includes('newsletter'),
      getMessage: async () => ({ conversation: '' }),
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
        // Ensure this update belongs to the current active socket instance
        const currentSession = sessions.get(storeId);
        if (!currentSession || currentSession.sock !== sock) {
          return;
        }

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
          
          const errObj = lastDisconnect?.error as any;
          const statusCode = errObj?.output?.statusCode || errObj?.statusCode;
          const errMsg = String(errObj?.message || errObj || '');
          const isConflict = errMsg.toLowerCase().includes('conflict') || statusCode === 440 || statusCode === DisconnectReason.connectionReplaced;

          // DisconnectReason.restartRequired (515) occurs during normal login / authentication stream transitions
          const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515 || errMsg.includes('515') || errMsg.includes('restart required');
          if (isRestartRequired) {
            console.log(`[WhatsApp] Stream restart required (515) for store ${storeId}. Reconnecting session...`);
            try {
              (sock.ev as any).removeAllListeners?.();
              sock.end(undefined);
            } catch (e) {}
            
            if (reconnectTimers.has(storeId)) clearTimeout(reconnectTimers.get(storeId));
            const t = setTimeout(() => {
              reconnectTimers.delete(storeId);
              startWhatsappSession(storeId).catch(console.error);
            }, 1500);
            reconnectTimers.set(storeId, t);
            return;
          }

          console.log(`[WhatsApp] Connection closed for store ${storeId}. Status code: ${statusCode}. Was connected: ${wasConnected}. Reason: ${errMsg}`);

          // Only permanently clear session if explicitly logged out (and NOT just a temporary stream conflict) or if QR timed out before scanning
          const isLoggedOut = (statusCode === DisconnectReason.loggedOut || statusCode === 401) && !isConflict;
          const isQrTimeout = !wasConnected && (statusCode === DisconnectReason.timedOut || statusCode === 408);

          // Teardown the closed socket instance
          try {
            (sock.ev as any).removeAllListeners?.();
            sock.end(undefined);
          } catch (e) {}

          if (isLoggedOut || isQrTimeout) {
            console.log(`[WhatsApp] Session permanently closed (isLoggedOut: ${isLoggedOut}, isQrTimeout: ${isQrTimeout}) for store ${storeId}. Clearing auth directory.`);
            conflictAttempts.delete(storeId);
            sessions.delete(storeId);
            clearAuthDirectory(storeId);
            await updateWhatsappDocInFirestore(storeId, {
              connected: false,
              qr: null,
              status: 'disconnected'
            });
          } else if (isConflict) {
            const currentAttempts = (conflictAttempts.get(storeId) || 0) + 1;
            conflictAttempts.set(storeId, currentAttempts);

            if (currentAttempts > 2) {
              console.log(`[WhatsApp] Session replaced on another device/browser tab for store ${storeId}. Stopping reconnection attempts.`);
              conflictAttempts.delete(storeId);
              sessions.delete(storeId);
              clearAuthDirectory(storeId);
              await updateWhatsappDocInFirestore(storeId, {
                connected: false,
                qr: null,
                status: 'disconnected'
              });
            } else {
              // Stream conflict (duplicate socket or other WhatsApp Web tab). Back off cleanly and auto-reconnect once
              console.log(`[WhatsApp] Stream conflict detected for store ${storeId} (attempt ${currentAttempts}/2). Re-establishing clean connection in 4s...`);
              await updateWhatsappDocInFirestore(storeId, {
                connected: false,
                qr: null,
                status: 'connecting'
              });

              if (reconnectTimers.has(storeId)) clearTimeout(reconnectTimers.get(storeId));
              const t = setTimeout(() => {
                reconnectTimers.delete(storeId);
                startWhatsappSession(storeId).catch(console.error);
              }, 4000);
              reconnectTimers.set(storeId, t);
            }
          } else {
            // It's a temporary connection drop (network drop, socket timeout, 503 stream error, etc). Reconnect automatically!
            console.log(`[WhatsApp] Temporary disconnect (code: ${statusCode}) for store ${storeId}. Auto-reconnecting in 3s...`);
            await updateWhatsappDocInFirestore(storeId, {
              connected: false,
              qr: null,
              status: 'connecting'
            });
            
            if (reconnectTimers.has(storeId)) clearTimeout(reconnectTimers.get(storeId));
            const t = setTimeout(() => {
              reconnectTimers.delete(storeId);
              startWhatsappSession(storeId).catch(console.error);
            }, 3000);
            reconnectTimers.set(storeId, t);
          }
        } else if (connection === 'open') {
          conflictAttempts.delete(storeId);
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
      for (const msg of (m.messages || [])) {
        try {
          if (!msg.message || msg.key.fromMe) continue;
          const senderId = msg.key.remoteJid || '';
          const participantId = msg.key.participant || (msg as any).participant || (msg.key as any).participantAlt || (msg.key as any).remoteJidAlt || '';
          
          const text = 
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            msg.message.documentMessage?.caption ||
            msg.message.buttonsResponseMessage?.selectedButtonId ||
            msg.message.buttonsResponseMessage?.selectedDisplayText ||
            msg.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
            msg.message.listResponseMessage?.title ||
            msg.message.templateButtonReplyMessage?.selectedId ||
            msg.message.templateButtonReplyMessage?.selectedDisplayText ||
            msg.message.interactiveResponseMessage?.body?.text ||
            '';

          await handleIncomingMessage(storeId, sock, senderId, text.trim(), participantId, msg);
        } catch (msgErr) {
          console.error(`[WhatsApp Bot] Error processing incoming message for ${storeId}:`, msgErr);
        }
      }
    });

    return sessionState.initialPromise;
  })();

  startingLocks.set(storeId, startPromise);
  try {
    const result = await startPromise;
    return result;
  } finally {
    startingLocks.delete(storeId);
  }
}

// Comprehensive Brazilian & international phone extraction and variation helper
function normalizePhoneVariants(input: string): string[] {
  if (!input) return [];
  const clean = input.split('@')[0].split(':')[0].replace(/\D/g, '');
  if (!clean || clean.length < 8) return [];

  const variations = new Set<string>();
  variations.add(clean);

  // If starts with 55 (Brazil country code) and has 12 or 13 digits
  if (clean.startsWith('55') && clean.length >= 12) {
    const withoutCountry = clean.slice(2); // e.g. 81988887777 or 8188887777
    variations.add(withoutCountry);

    const ddd = withoutCountry.slice(0, 2);
    const num = withoutCountry.slice(2);

    if (num.length === 9 && num.startsWith('9')) {
      variations.add(num); // 9-digit local (e.g. 988887777)
      variations.add(num.slice(1)); // 8-digit local (e.g. 88887777)
      variations.add(ddd + num.slice(1)); // DDD + 8-digit (e.g. 8188887777)
      variations.add('55' + ddd + num.slice(1)); // 55 + DDD + 8-digit (e.g. 558188887777)
      variations.add(ddd + num); // DDD + 9-digit (e.g. 81988887777)
    } else if (num.length === 8) {
      variations.add(num); // 8-digit local (e.g. 88887777)
      variations.add('9' + num); // 9-digit local (e.g. 988887777)
      variations.add(ddd + '9' + num); // DDD + 9-digit (e.g. 81988887777)
      variations.add('55' + ddd + '9' + num); // 55 + DDD + 9-digit (e.g. 5581988887777)
      variations.add(ddd + num); // DDD + 8-digit (e.g. 8188887777)
    }
  } else if (clean.length === 10 || clean.length === 11) {
    // DDD (2 digits) + number without country code
    variations.add('55' + clean);
    const ddd = clean.slice(0, 2);
    const num = clean.slice(2);

    if (num.length === 9 && num.startsWith('9')) {
      variations.add(num);
      variations.add(num.slice(1));
      variations.add(ddd + num.slice(1));
      variations.add('55' + ddd + num.slice(1));
      variations.add(clean);
    } else if (num.length === 8) {
      variations.add(num);
      variations.add('9' + num);
      variations.add(ddd + '9' + num);
      variations.add('55' + ddd + '9' + num);
      variations.add(clean);
    }
  } else if (clean.length === 8 || clean.length === 9) {
    if (clean.length === 9 && clean.startsWith('9')) {
      variations.add(clean.slice(1));
    } else if (clean.length === 8) {
      variations.add('9' + clean);
    }
  }

  // Always include the core 8 digits and 9 digits if available
  if (clean.length >= 8) variations.add(clean.slice(-8));
  if (clean.length >= 9) variations.add(clean.slice(-9));

  return Array.from(variations);
}

function phoneMatches(orderPhone: string, senderVariants: string[]): boolean {
  if (!orderPhone) return false;
  const orderVariants = normalizePhoneVariants(orderPhone);
  if (orderVariants.length === 0) return false;

  const senderSet = new Set(senderVariants);
  for (const ov of orderVariants) {
    if (senderSet.has(ov)) return true;
  }

  const cleanOrder = orderPhone.replace(/\D/g, '');
  if (!cleanOrder || cleanOrder.length < 8) return false;

  for (const sv of senderVariants) {
    if (!sv || sv.length < 8) continue;
    if (cleanOrder === sv) return true;
    if (cleanOrder.endsWith(sv) || sv.endsWith(cleanOrder)) return true;

    // Check last 8 digits matching
    if (cleanOrder.slice(-8) === sv.slice(-8)) {
      // If both have at least 10 digits (DDD present), verify DDD
      if (cleanOrder.length >= 10 && sv.length >= 10) {
        const dddOrder = cleanOrder.startsWith('55') ? cleanOrder.slice(2, 4) : cleanOrder.slice(0, 2);
        const dddSender = sv.startsWith('55') ? sv.slice(2, 4) : sv.slice(0, 2);
        if (dddOrder === dddSender) return true;
      } else {
        return true;
      }
    }
  }
  return false;
}

// Find orders placed by this customer's phone number or typed phone
async function findOrdersByCustomer(storeId: string, senderId: string, altSenderId?: string, typedText?: string): Promise<any[]> {
  const allVariants = new Set<string>();

  normalizePhoneVariants(senderId).forEach(v => allVariants.add(v));
  if (altSenderId) {
    normalizePhoneVariants(altSenderId).forEach(v => allVariants.add(v));
  }

  // If customer typed a phone number in the message text (e.g. 10 or 11 digits)
  if (typedText) {
    const extractedPhones = typedText.match(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}\b/g);
    if (extractedPhones) {
      for (const p of extractedPhones) {
        normalizePhoneVariants(p).forEach(v => allVariants.add(v));
      }
    }
  }

  const senderVariants = Array.from(allVariants);
  if (senderVariants.length === 0) return [];

  try {
    const docs = await getStoreOrdersWithCache(storeId);

    const matchedOrders: any[] = [];
    for (const o of docs) {
      const phoneCandidates = [
        o.customer?.phone,
        o.customer?.telefone,
        o.customer?.celular,
        o.customer?.whatsapp,
        o.phone,
        o.customerPhone,
        o.clientPhone,
        o.customer_phone,
        o.telephone
      ].filter(Boolean);

      let matched = false;
      for (const p of phoneCandidates) {
        if (phoneMatches(String(p), senderVariants)) {
          matched = true;
          break;
        }
      }

      if (matched) {
        matchedOrders.push(o);
      }
    }

    // Sort descending by creation date
    matchedOrders.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date || 0).getTime();
      const dateB = new Date(b.createdAt || b.date || 0).getTime();
      return dateB - dateA;
    });

    console.log(`[WhatsApp Bot] Found ${matchedOrders.length} order(s) for customer phone variations:`, senderVariants.slice(0, 5));
    return matchedOrders;
  } catch (e) {
    console.error("[WhatsApp Bot] Error searching orders by customer phone:", e);
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
        if (!data.storeId || data.storeId === storeId || String(data.storeId).toLowerCase() === String(storeId).toLowerCase()) {
          return { id: snap.id, ...data };
        }
      }
    } catch (e) {}
  }

  // 2. Query orders for the store using the cached store orders
  try {
    const docs = await getStoreOrdersWithCache(storeId);

    for (const o of docs) {
      const orderId = (o.id || '').toString().toUpperCase();
      for (const cand of uniqueCandidates) {
        if (orderId === cand || orderId.endsWith(cand) || cand.endsWith(orderId)) {
          return o;
        }
      }
    }
  } catch (e) {
    console.error("[WhatsApp Bot] Error querying orders by ID:", e);
  }

  return null;
}

// Status labels formatter
function getStatusLabel(rawStatus: string): string {
  const statusMap: Record<string, string> = {
    'Pendente': '⏳ Pendente (Aguardando Restaurante)',
    'pending': '⏳ Pendente (Aguardando Restaurante)',
    'AguardandoPagamento': '💳 Aguardando Pagamento',
    'Aguardando Pagamento': '💳 Aguardando Pagamento',
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
  return statusMap[rawStatus] || rawStatus || 'Em Processamento';
}

function isOrderRecent(order: any, maxHours = 48): boolean {
  if (!order) return false;
  const dateVal = order.createdAt || order.date;
  if (!dateVal) return true;
  const orderTime = new Date(dateVal).getTime();
  if (isNaN(orderTime) || orderTime <= 0) return true;
  const now = Date.now();
  const diffHours = (now - orderTime) / (1000 * 60 * 60);
  return diffHours <= maxHours;
}

// Format full order status message
function formatOrderStatusMessage(order: any, storeId: string, profile: any): string {
  const st = getStatusLabel(order.status);

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

async function handleIncomingMessage(storeId: string, sock: any, senderId: string, text: string, participantId?: string, rawMsg?: any) {
  // Ignore broadcast, status, newsletter, or empty sender
  if (!senderId || senderId.includes('status@broadcast') || senderId.includes('newsletter')) {
    return;
  }

  // Fetch store profile (using cache to reduce Firestore reads)
  const profile = await getRestaurantProfileWithCache(storeId);
  if (!profile) return;

  if (profile.whatsappBotPaused) {
    return;
  }

  // Render template helpers
  function renderTemplate(template: string, profile: any, storeId: string) {
    const name = profile.name || 'Nosso Restaurante';
    const description = profile.description || 'A melhor comida da região!';
    const openTime = profile.openTime || '--:--';
    const closeTime = profile.closeTime || '--:--';
    
    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const operatingDays = (profile.operatingDays || [])
      .map((d: any) => typeof d === 'number' ? (dayNames[d] || d) : d)
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

  // AUTOMATIC CUSTOMER ORDER LOOKUP BY PHONE
  const customerOrders = await findOrdersByCustomer(storeId, senderId, participantId, text);
  const activeStatuses = [
    'Pendente', 'pending',
    'AguardandoPagamento', 'Aguardando Pagamento',
    'Aceito', 'Em Preparo', 'Preparando', 'accepted',
    'Saiu para Entrega', 'Saiu para entrega', 'dispatch', 'Em Rota',
    'Pronto para Retirada', 'ready', 'Pronto'
  ];
  const activeOrder = customerOrders.find(o => activeStatuses.includes(o.status)) || customerOrders[0];
  const hasActiveOrder = !!activeOrder && (activeStatuses.includes(activeOrder.status) || isOrderRecent(activeOrder, 48));

  // A. Check if the message contains an explicit Order ID or Order Number search
  const isExplicitIdQuery = /^(status|pedido|rastrear|rastreio|ver|consultar)\s*[#\s]*[a-z0-9]+/i.test(lowerText) ||
                            /^#\s*[a-z0-9]+/i.test(lowerText) ||
                            /^pf\s*\d+/i.test(lowerText) ||
                            /^\d{4,8}$/.test(lowerText);

  if (isExplicitIdQuery && !['1', '2', '3', '4'].includes(lowerText)) {
    const foundOrder = await findOrderByIdOrNumber(storeId, text);
    if (foundOrder) {
      const reply = formatOrderStatusMessage(foundOrder, storeId, profile);
      await sock.sendMessage(senderId, { text: reply });
      return;
    }

    // If ID not found, but customer has active order, show their active order
    if (hasActiveOrder) {
      let reply = `❌ *Pedido não localizado com o código digitado.*\n\n` +
                  `📦 *Identificamos este pedido ativo no seu WhatsApp:*\n\n` +
                  formatOrderStatusMessage(activeOrder, storeId, profile);
      await sock.sendMessage(senderId, { text: reply });
      return;
    }

    const customBaseUrl = profile.whatsappLinkUrl || 'https://tecinfo-app.github.io/PopFood';
    const normalizedBaseUrl = customBaseUrl.endsWith('/') ? customBaseUrl.slice(0, -1) : customBaseUrl;
    const link = `${normalizedBaseUrl}/cliente.html?store=${storeId}`;

    const notFoundMsg = `❌ *Pedido não localizado.*\n\nNão encontramos nenhum pedido com esse número em nossa loja.\n\nPor favor, verifique o código digitado (ex: *#PF123456* ou *123456*) ou faça um novo pedido em nosso cardápio:\n👉 ${link}`;
    await sock.sendMessage(senderId, { text: notFoundMsg });
    return;
  }

  // B. Option 4 or General Status queries -> Automatically return customer order status!
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
                         lowerText.includes('status do pedido') ||
                         lowerText.includes('cade meu pedido') ||
                         lowerText.includes('cadê meu pedido') ||
                         lowerText.includes('ja saiu') ||
                         lowerText.includes('já saiu');

  if (isStatusIntent) {
    if (customerOrders.length > 0) {
      let reply = formatOrderStatusMessage(activeOrder, storeId, profile);
      if (customerOrders.length > 1) {
        reply += `\n\n💡 _Identificamos seu pedido mais recente. Para consultar outro pedido anterior específico, digite o número dele (ex: #PF123456 ou 123456)._`;
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
  const isGreetingIntent = lowerText === 'ola' || lowerText === 'olá' || lowerText === 'oi' || lowerText === 'oie' ||
                           lowerText === 'menu' || lowerText === 'bom dia' || lowerText === 'boa tarde' || lowerText === 'boa noite' ||
                           lowerText === 'inicio' || lowerText === 'início' || lowerText === 'opcoes' || lowerText === 'opções' ||
                           lowerText === 'start' || lowerText === 'comecar' || lowerText === 'começar';

  if (isGreetingIntent) {
    if (hasActiveOrder) {
      const customBaseUrl = profile.whatsappLinkUrl || 'https://tecinfo-app.github.io/PopFood';
      const normalizedBaseUrl = customBaseUrl.endsWith('/') ? customBaseUrl.slice(0, -1) : customBaseUrl;
      const trackUrl = `${normalizedBaseUrl}/acompanhamento.html?store=${storeId}&order=${activeOrder.id}`;
      const totalVal = Number(activeOrder.total || 0).toFixed(2).replace('.', ',');
      const orderStatusFormatted = getStatusLabel(activeOrder.status);

      const activeGreeting = `👋 Olá! Bem-vindo(a) ao *${profile.name || 'Nosso Restaurante'}*!\n\n` +
                             `📦 *Identificamos seu pedido em andamento (#${activeOrder.id}):*\n` +
                             `🚦 *Status:* ${orderStatusFormatted}\n` +
                             `💰 *Total:* R$ ${totalVal}\n` +
                             `👉 *Acompanhe ao vivo:* \n${trackUrl}\n\n` +
                             `💡 _Digite *4* para ver todos os detalhes do seu pedido (itens, endereço e PIN)._\n\n` +
                             `─────────────────────\n` +
                             `Escolha uma opção:\n` +
                             `1️⃣ *Cardápio*\n` +
                             `2️⃣ *Horário de Funcionamento*\n` +
                             `3️⃣ *Fazer Novo Pedido*\n` +
                             `4️⃣ *Ver Detalhes do Pedido (#${activeOrder.id})*\n` +
                             `5️⃣ *Cupons*\n` +
                             `6️⃣ *Programa Fidelidade*`;
      await sock.sendMessage(senderId, { text: activeGreeting });
      return;
    }

    const welcomeTemplate = profile.whatsappWelcome || `Olá! Bem-vindo(a) ao *{name}*! 🍔🍕\n_{description}_\n\nDigite o número da opção desejada:\n1️⃣ *Cardápio*\n2️⃣ *Horário de Funcionamento*\n3️⃣ *Fazer Pedido*\n4️⃣ *Status do Pedido*\n5️⃣ *Cupons*\n6️⃣ *Programa Fidelidade*`;
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

  // 3. Cardápio atualizado (Envia o link do cardápio online com fotos ao invés da lista de texto, reduzindo drasticamente as leituras do Firestore)
  if (lowerText === '1' || lowerText.includes('cardapio') || lowerText.includes('cardápio') || lowerText.includes('produtos') || lowerText.includes('catalogo') || lowerText.includes('catálogo')) {
    const customBaseUrl = profile.whatsappLinkUrl || 'https://tecinfo-app.github.io/PopFood';
    const normalizedBaseUrl = customBaseUrl.endsWith('/') ? customBaseUrl.slice(0, -1) : customBaseUrl;
    const link = `${normalizedBaseUrl}/cliente.html?store=${storeId}`;
    
    const menuText = `📋 *Nosso Cardápio Online* 🍔🍕\n\n` +
                     `Para visualizar nosso cardápio completo com fotos, adicionais, escolher as opções do seu jeito e fazer seu pedido com facilidade, acesse nosso link:\n\n` +
                     `👉 *${link}*\n\n` +
                     `💡 _É rápido, seguro e prático!_`;

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

  // 5. Cupons (com uso de cache para evitar leituras excessivas do banco)
  if (lowerText === '5' || lowerText.includes('cupons') || lowerText.includes('cupom') || lowerText.includes('promocao') || lowerText.includes('promoção')) {
    const activeCoupons = await getStoreCouponsWithCache(storeId);

    if (activeCoupons.length === 0) {
      await sock.sendMessage(senderId, { text: "🎫 *Cupons de Desconto*\n\nNo momento não temos cupons promocionais ativos. Fique de olho em nossas redes sociais para novidades!" });
      return;
    }

    let reply = "🎫 *Cupons de Desconto Ativos:*\n\n";
    activeCoupons.forEach(c => {
      reply += `🏷️ *CÓDIGO: ${c.code}*\n`;
      const desc = c.type === 'percentual' ? `${c.value}% de desconto` : `R$ ${Number(c.value).toFixed(2).replace('.', ',')} de desconto`;
      reply += `🎁 ${desc}\n`;
      if (c.minValue) reply += `⚠️ Pedido mínimo: R$ ${Number(c.minValue).toFixed(2).replace('.', ',')}\n`;
      if (c.firstOrderOnly) reply += `✨ Válido apenas para o primeiro pedido\n`;
      reply += `\n`;
    });
    reply += `👉 Acesse nosso cardápio e use seu cupom no final do pedido!`;
    
    await sock.sendMessage(senderId, { text: reply });
    return;
  }

  // 6. Programa Fidelidade
  if (lowerText === '6' || lowerText.includes('fidelidade') || lowerText.includes('programa fidelidade') || lowerText.includes('pontos')) {
    if (!profile.loyaltyActive) {
      await sock.sendMessage(senderId, { text: "🏆 *Programa Fidelidade*\n\nNosso programa de fidelidade não está ativo no momento. Continue acompanhando nossas novidades!" });
      return;
    }

    const minOrders = profile.loyaltyMinOrders || 3;
    
    const validOrders = customerOrders.filter(d => d.status === "Entregue" && !(d.descontoFidelidade > 0 || d.fidelidadeAtivo === true)).length;
    const usedRewards = customerOrders.filter(d => d.status !== "Cancelado" && (d.descontoFidelidade > 0 || d.fidelidadeAtivo === true)).length;
    
    const earnedRewards = Math.floor(validOrders / minOrders);
    const availableRewards = Math.max(0, earnedRewards - usedRewards);
    const progress = validOrders % minOrders;

    let reply = "🏆 *Seu Programa de Fidelidade*\n\n";
    
    if (availableRewards > 0) {
      reply += `🎉 *PARABÉNS! Você tem ${availableRewards} prêmio(s) pronto(s) para resgatar!*\n`;
      reply += `O desconto será aplicado automaticamente no seu próximo pedido.\n\n`;
    }
    
    reply += `📊 *Seu progresso atual:* \n`;
    reply += `Você tem *${progress}* de *${minOrders}* pedidos necessários para o próximo prêmio.\n\n`;
    
    const typeDesc = profile.loyaltyType === 'percentual' ? `${profile.loyaltyValue}% de desconto` : `R$ ${Number(profile.loyaltyValue || 0).toFixed(2).replace('.', ',')} de desconto`;
    reply += `🎁 *O prêmio:* ${typeDesc} após completar ${minOrders} pedidos!\n\n`;
    reply += `👉 Faça um novo pedido e continue acumulando!`;

    await sock.sendMessage(senderId, { text: reply });
    return;
  }

  // Fallback: If customer has an active order and sent an unrecognized message, automatically provide active order status!
  if (hasActiveOrder) {
    let reply = `📦 *Localizamos o seu pedido #${activeOrder.id}:*\n\n` +
                formatOrderStatusMessage(activeOrder, storeId, profile) +
                `\n\n💡 _Digite *Menu* para ver as opções da loja ou digite sua dúvida._`;
    await sock.sendMessage(senderId, { text: reply });
    return;
  }

  // Default fallback reply
  const defaultReply = `Desculpe, não entendi. Digite *Oi* ou *Menu* para ver as opções disponíveis ou *4* para consultar seu pedido.`;
  await sock.sendMessage(senderId, { text: defaultReply });
}
