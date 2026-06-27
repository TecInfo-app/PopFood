import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import Stripe from 'stripe';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import admin from 'firebase-admin';

// Initialize Firebase Admin for Push Notifications
try {
  let adminConfig = {};
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    adminConfig = {
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
    };
  } else {
    // Fallback to the known service account credentials
    const SERVICE_ACCOUNT = {
      projectId: "topfood-9ff42",
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC9rotbOIBSEFeO\nTNL1wOnHxuvm5CmJYlHz5bw+sZJH3OHgZLfbPcQ5QjiUVyeM8uJVOI6ZEHbGKtGL\nFhnwfw9CSI5utSk120QkOJO0RqR59U9l6RimJbRLT8VYOEnzV5JdkmcGC7LAOjeG\nz8go3oUfJkx51zCk9H8TlJ+XNOxdqBnTwHuz/D/UiQtkjseDvqQQrRL3yTO9HmmQ\nZxvYiujSj65NRXRKltWaUqJUfq+Fm6GzaxSbSsx/2PkVcCfgJYdZ0CJ6UE5cuDQd\nCvVvXvNEwW6t92A8FZH27iW4IBWsOTv7zB59pj+E/USBEF903NFLAPVtbNsfmLGo\n2m5CTxUnAgMBAAECggEACjp1TU/4q3QyJHxEC/iBIsK5SdQX4U6p+Kr0wbS1nKZu\nj7keqPXltOi7QFSKz3Dxf4LzPZHDtd/tOMDSWUOgwQREmfeu5zaRsBpU7K26hNET\nnP061QrHdCAzFhTC+BpKzDzuzUaoNvFsuRpPQtTs/McF7LQL7Xk5uQaUrISwEkS8\nZbV6ErYjoYAUGSewA/Okfju2go2tejXcfjBabB0Hl0HcirN0HjF3+cSfI/JmxpEi\np3qXpT8erVGOjJ6+wc7j6E5o0YUit8fu2xpFDW9xs/xVEZTB4ZHXxeO3mmGij0CZ\nIwtupeFIJdnwUuMOvFQUjb7eqhDZTuyHbBWBL6tTMQKBgQD2b4L0Sxe5hbX+T3+M\no+IrEDY4MAPOMvFjzU2AyF2G0wGJQUuPQcd//SQY6nXurruPs5eCDOGuns+Vw+n2\nRzrglzsEav2u/k9mCs99aA71g3eBHNfIsbH9lQf4hwMbRroq8ecKV1awd+xsy8Lp\nvI1b/GZb/nTJmZugNw1ENKsPJQKBgQDFCyY4JcxzNcgRxh3HJI7uN6Xi386qp6JS\nsFlz6YjSjEWTQik15vA1prNTCywNHr3KYosNR6eQl0bTcQOPAPb8lhT2qHZj5vuF\nRGxtLx43KwwiKfuOY7n5huFJlLMmFd/RLFWr4xeiPN6OoTWVDuN1wRl7qmeGdOeZ\n4CGuYxT3WwKBgQDRkfFGuRl67wffNlIdEz2CK65ASCzkTRRVMEGptDs9LfJPfBS6\nxlDXOjpZagJSsYvV3/+HXFcMPggAr/QmOVsLpfBNiIMmLyTsfWMIndai2WNmjFXB\nWcQpB3UY2BA/QP2PCdrWQ4H4XnPT7dBbH7sDL/kIYLOGwjfDny2MBFI4dQKBgBk0\nTuQ5uYg3JetYGzEA9SN1jMuTcz0TCklnc1nHUpAUD0ZB3UGe07UZKLEDqdPXzdEY\nf87oDoAJSa78MsdVCULP88iFTfeDcULfuLrSnxvRbtDj6+CP0xce8KxXz/6cJ6/6\n6s580uYWwSUfa9owOFo0pAzUhD+HrqRZLhW/aMwnAoGAdIThRy3Qz+1kf7NFE5J6\nFntmHkC/dO/I+hTemAZCfZ+ayrfS2L1pvEeWeOna8GNBBMkKCWlsxBIVLOuJWRZj\nPWlViqgUflTwQN42RtSZ82lScGcaQenH/DCvF9e0FVfUO/IqzJKi8ZIU1OKMUpdJ\nhavTsJSAHClE6VVDhABnMjM=\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
      clientEmail: "firebase-adminsdk-fbsvc@topfood-9ff42.iam.gserviceaccount.com"
    };
    adminConfig = {
      credential: admin.credential.cert(SERVICE_ACCOUNT)
    };
  }
  admin.initializeApp(adminConfig);
  console.log("Firebase Admin initialized with credential fallback for Push Notifications.");
} catch (error) {
  console.warn("Could not initialize Firebase Admin. Push notifications via server won't work until FIREBASE_SERVICE_ACCOUNT_JSON is set.", error);
}

const firebaseConfig = {
  apiKey: "AIzaSyCtz-4cniRtbA_rdxAE26-uOA_ji3Xz4RU",
  authDomain: "topfood-9ff42.firebaseapp.com",
  projectId: "topfood-9ff42",
  storageBucket: "topfood-9ff42.firebasestorage.app",
  messagingSenderId: "49269002867",
  appId: "1:49269002867:web:1ea3437d3e74e0671c1006"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Standard robust CORS configuration that handles all preflight requests gracefully
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
    optionsSuccessStatus: 200
  }));

  app.use(express.json());

  // API route for pushing notifications
  app.post("/api/send-notification", async (req, res) => {
    const { token, title, body, data } = req.body;
    
    if (!token || !title || !body) {
      return res.status(400).json({ error: "Faltam parâmetros obrigatórios (token, title, body)." });
    }

    try {
      const message = {
        notification: {
          title: title,
          body: body,
          image: 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png'
        },
        data: data || {},
        token: token,
      };

      const response = await admin.messaging().send(message);
      res.json({ success: true, messageId: response });
    } catch (error: any) {
      console.error("Erro ao enviar notificação push:", error);
      res.status(500).json({ error: error.message || "Falha ao enviar notificação." });
    }
  });

  // API route for payments
  app.post("/api/create-payment", async (req, res) => {
    const { amount, paymentMethodType, cardToken, email, description, storeId, orderId } = req.body;
    
    try {
      const projectId = firebaseConfig.projectId;
      const apiKey = firebaseConfig.apiKey;
      const safeStoreId = storeId || "main";
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/restaurantProfile/${safeStoreId}?key=${apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Falha ao buscar perfil do restaurante (Status: ${response.status})`);
      }
      
      const docData = await response.json();
      const fields = docData.fields || {};
      
      const mpAccessToken = fields.mpAccessToken?.stringValue;
      const stripeSecretKey = fields.stripeSecretKey?.stringValue;
      const abacatePayToken = fields.abacatePayToken?.stringValue;

      // ABACATEPAY FLOW
      if (abacatePayToken) {
        let amountCents = Math.round(Number(amount) * 100);
        
        if (paymentMethodType === 'pix') {
          // TRANSPARENT PIX CHECKOUT (Direct QR Code generation)
          const pixPayload = {
              amount: amountCents,
              description: description || 'Pedido PopFood'
          };
          const pixRes = await fetch('https://api.abacatepay.com/v2/transparents/create', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${abacatePayToken}`,
                'Accept': 'application/json'
              },
              body: JSON.stringify(pixPayload)
          });
          const pixData = await pixRes.json();
          if (!pixRes.ok || pixData.error) {
              throw new Error(`Erro AbacatePay (Pix Transparente): ${pixData.error || JSON.stringify(pixData)}`);
          }
          
          const actualPix = pixData.data || pixData;
          return res.json({
              provider: 'abacatepay',
              method: 'pix',
              qrCode: actualPix.brCode,
              qrCodeBase64: actualPix.brCodeBase64,
              paymentId: actualPix.id,
              status: actualPix.status || 'PENDING'
          });
        } else {
          // CREDIT CARD FLOW (FALLBACK - REDIRECT TO CHECKOUT URL)
          // 1. Create a dynamic product for the order
          const prodPayload = {
              externalId: `pedido-${Date.now()}-${Math.floor(Math.random()*1000)}`,
              name: description || 'Pedido PopFood',
              price: amountCents,
              currency: 'BRL'
          };
          const prodRes = await fetch('https://api.abacatepay.com/v2/products/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${abacatePayToken}` },
              body: JSON.stringify(prodPayload)
          });
          const prodData = await prodRes.json();
          if (!prodRes.ok || prodData.error) {
              throw new Error(`Erro AbacatePay (Produto): ${prodData.error || JSON.stringify(prodData)}`);
          }
          
          // 2. Create the checkout
          const origin = req.headers.origin || 'http://localhost:3000';
          const checkoutPayload = {
              items: [{ id: prodData.data.id, quantity: 1 }],
              returnUrl: `${origin}/cliente.html?store=${safeStoreId}&orderId=${orderId || ''}&abacateReturn=1`
          };
          const checkoutRes = await fetch('https://api.abacatepay.com/v2/checkouts/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${abacatePayToken}` },
              body: JSON.stringify(checkoutPayload)
          });
          const checkoutData = await checkoutRes.json();
          if (!checkoutRes.ok || checkoutData.error) {
              throw new Error(`Erro AbacatePay (Checkout): ${checkoutData.error || JSON.stringify(checkoutData)}`);
          }
          
          return res.json({
              provider: 'abacatepay',
              method: 'checkout',
              url: checkoutData.data.url,
              paymentId: checkoutData.data.id
          });
        }
      }

      // MERCADO PAGO FLOW (Preferred)
      if (mpAccessToken) {
        const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
        const payment = new Payment(client);

        if (paymentMethodType === 'pix') {
          const result = await payment.create({
            body: {
              transaction_amount: Number(amount),
              description: description || 'Pedido PopFood',
              payment_method_id: 'pix',
              payer: {
                email: email || 'cliente@exemplo.com'
              },
            }
          });
          return res.json({ 
            provider: 'mercadopago',
            method: 'pix',
            qrCode: result.point_of_interaction?.transaction_data?.qr_code,
            qrCodeBase64: result.point_of_interaction?.transaction_data?.qr_code_base64,
            paymentId: result.id
          });
        } else if (cardToken) {
          // Card flow
          const result = await payment.create({
            body: {
              transaction_amount: Number(amount),
              token: cardToken,
              description: description || 'Pedido PopFood',
              installments: 1,
              payment_method_id: req.body.paymentMethodId,
              payer: {
                email: email || 'cliente@exemplo.com'
              },
            }
          });
          return res.json({ 
            provider: 'mercadopago',
            method: 'card',
            status: result.status,
            paymentId: result.id
          });
        }
      }

      // STRIPE FLOW (Fallback)
      if (stripeSecretKey) {
        const stripe = new Stripe(stripeSecretKey);
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: 'brl',
          payment_method_types: [paymentMethodType === 'pix' ? 'pix' : 'card'],
        });
        return res.json({ 
          provider: 'stripe',
          clientSecret: paymentIntent.client_secret 
        });
      }

      return res.status(400).json({ error: "Nenhum método de pagamento online configurado no perfil do restaurante." });
      
    } catch (error: any) {
      console.error("Erro no processamento do pagamento:", error);
      res.status(500).json({ error: error.message || "Erro interno ao processar pagamento" });
    }
  });

  // Check payment status dynamically (polls both AbacatePay and Mercado Pago)
  app.get("/api/check-payment", async (req, res) => {
    let { paymentId, storeId, orderId } = req.query;
    const safeStoreId = (storeId as string) || "main";
    
    try {
      const projectId = firebaseConfig.projectId;
      const apiKey = firebaseConfig.apiKey;

      // If paymentId is missing but orderId is present, try to find the paymentId in Firestore
      if (!paymentId && orderId) {
        try {
          const orderUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orders/${orderId}?key=${apiKey}`;
          const orderRes = await fetch(orderUrl);
          if (orderRes.ok) {
            const orderDoc = await orderRes.json();
            paymentId = orderDoc.fields?.paymentId?.stringValue;
          }
        } catch (err) {
          console.error("Erro ao buscar paymentId no Firestore:", err);
        }
      }

      if (!paymentId) {
        return res.status(400).json({ error: "Parâmetro paymentId é obrigatório ou não pôde ser encontrado." });
      }

      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/restaurantProfile/${safeStoreId}?key=${apiKey}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Falha ao buscar perfil do restaurante (Status: ${response.status})`);
      }
      
      const docData = await response.json();
      const fields = docData.fields || {};
      const abacatePayToken = fields.abacatePayToken?.stringValue;
      const mpAccessToken = fields.mpAccessToken?.stringValue;

      let isPaid = false;
      let statusStr = "PENDING";
      let providerStr = "";

      // 1. ABACATEPAY CHECK
      if (abacatePayToken) {
        providerStr = "abacatepay";
        const checkRes = await fetch(`https://api.abacatepay.com/v2/transparents/check?id=${paymentId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${abacatePayToken}`,
            'Accept': 'application/json'
          }
        });
        if (!checkRes.ok) {
          throw new Error(`Erro ao consultar status no AbacatePay (Status: ${checkRes.status})`);
        }
        const checkData = await checkRes.json();
        const actualStatus = checkData.data?.status || checkData.status || "PENDING";
        
        statusStr = actualStatus;
        if (actualStatus === "PAID") {
          isPaid = true;
        }
      }
      // 2. MERCADO PAGO CHECK
      else if (mpAccessToken) {
        providerStr = "mercadopago";
        const client = new MercadoPagoConfig({ accessToken: mpAccessToken });
        const payment = new Payment(client);
        const result = await payment.get({ id: Number(paymentId) });
        
        statusStr = result.status || "pending";
        if (result.status === 'approved') {
          isPaid = true;
          statusStr = "PAID";
        } else if (result.status === 'pending' || result.status === 'in_process') {
          statusStr = "PENDING";
        } else {
          statusStr = "CANCELLED";
        }
      } else {
        return res.status(400).json({ error: "Nenhum provedor de pagamento configurado para esta loja." });
      }

      // If paid, update the order in Firestore directly
      if (isPaid && orderId) {
        try {
          const orderDocRef = doc(db, "orders", orderId as string);
          await updateDoc(orderDocRef, {
            paymentApproved: true,
            isPaid: true,
            paymentStatus: "Aprovado"
          });
          console.log(`Pedido ${orderId} atualizado com pagamento aprovado.`);
        } catch (dbErr: any) {
          console.error(`Falha ao atualizar documento do pedido no Firestore:`, dbErr);
        }
      }

      return res.json({
        status: statusStr,
        provider: providerStr,
        isPaid
      });
      
    } catch (error: any) {
      console.error("Erro ao verificar pagamento:", error);
      res.status(500).json({ error: error.message || "Erro interno ao verificar pagamento" });
    }
  });

  // Keep compatibility for older client versions
  app.post("/api/create-payment-intent", async (req, res) => {
    // Redirect to the new unified endpoint
    req.url = "/api/create-payment";
    return app._router.handle(req, res, () => {});
  });

  // Background processor for Scheduled Notifications
  setInterval(async () => {
    try {
      const now = new Date();
      const dbAdmin = admin.firestore();
      
      // Query pending scheduled notifications
      const snapshot = await dbAdmin.collection("scheduled_notifications")
        .where("status", "==", "pending")
        .where("scheduledFor", "<=", now)
        .get();

      if (snapshot.empty) return;

      console.log(`[Scheduler] Encontradas ${snapshot.size} notificações agendadas para disparo.`);

      for (const docSnap of snapshot.docs) {
        const schedId = docSnap.id;
        const schedData = docSnap.data();
        const { storeId, title, body, link } = schedData;

        console.log(`[Scheduler] Processando disparo agendado ${schedId}: "${title}" da loja ${storeId}`);

        // Mark as sending to avoid race conditions
        await dbAdmin.collection("scheduled_notifications").doc(schedId).update({
          status: "sending",
          processedAt: admin.firestore.Timestamp.now()
        });

        // Collect all target FCM tokens for this store
        const uniqueTokens = new Set<string>();

        // 1. Fetch from clients collection where storeId == storeId
        try {
          const clientsSnap = await dbAdmin.collection("clients")
            .where("storeId", "==", storeId)
            .get();
          clientsSnap.forEach(clientDoc => {
            const data = clientDoc.data();
            if (data.fcmToken && typeof data.fcmToken === 'string' && data.fcmToken.trim() !== "") {
              uniqueTokens.add(data.fcmToken.trim());
            }
          });
        } catch (err) {
          console.error(`[Scheduler] Erro ao carregar clients da loja ${storeId}:`, err);
        }

        // 2. Fetch from orders collection where storeId == storeId
        try {
          const ordersSnap = await dbAdmin.collection("orders")
            .where("storeId", "==", storeId)
            .get();
          ordersSnap.forEach(orderDoc => {
            const data = orderDoc.data();
            if (data.fcmToken && typeof data.fcmToken === 'string' && data.fcmToken.trim() !== "") {
              uniqueTokens.add(data.fcmToken.trim());
            }
          });
        } catch (err) {
          console.error(`[Scheduler] Erro ao carregar orders da loja ${storeId}:`, err);
        }

        // 3. Fetch from restaurantProfile
        try {
          const profileDoc = await dbAdmin.collection("restaurantProfile").doc(storeId).get();
          if (profileDoc.exists) {
            const pData = profileDoc.data();
            if (pData && Array.isArray(pData.clientTokens)) {
              pData.clientTokens.forEach((tok: any) => {
                if (tok && typeof tok === 'string' && tok.trim() !== "") {
                  uniqueTokens.add(tok.trim());
                }
              });
            }
            if (pData && Array.isArray(pData.merchantTokens)) {
              pData.merchantTokens.forEach((tok: any) => {
                if (tok && typeof tok === 'string' && tok.trim() !== "") {
                  uniqueTokens.add(tok.trim());
                }
              });
            }
          }
        } catch (err) {
          console.error(`[Scheduler] Erro ao carregar profile da loja ${storeId}:`, err);
        }

        const tokens = Array.from(uniqueTokens);
        console.log(`[Scheduler] Encontrados ${tokens.length} tokens únicos de destino para a campanha.`);

        let successCount = 0;
        let failCount = 0;

        if (tokens.length > 0) {
          for (const token of tokens) {
            try {
              const message = {
                notification: {
                  title: title,
                  body: body,
                  image: 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png'
                },
                data: {
                  type: "campaign",
                  link: link || ""
                },
                token: token,
              };
              await admin.messaging().send(message);
              successCount++;
            } catch (err) {
              console.error(`[Scheduler] Erro ao enviar para token:`, err);
              failCount++;
            }
          }
        }

        // Update status to sent
        await dbAdmin.collection("scheduled_notifications").doc(schedId).update({
          status: "sent",
          sentAt: admin.firestore.Timestamp.now(),
          targetCount: tokens.length,
          successCount,
          failCount
        });

        // Save into restaurantProfile campaigns history
        try {
          const profileRef = dbAdmin.collection("restaurantProfile").doc(storeId);
          const profileSnap = await profileRef.get();
          let campaignsList = [];
          if (profileSnap.exists) {
            const pData = profileSnap.data();
            if (pData && Array.isArray(pData.campaigns)) {
              campaignsList = [...pData.campaigns];
            }
          }
          campaignsList.push({
            title,
            body,
            link: link || "",
            sentAt: new Date().toISOString(),
            targetCount: tokens.length
          });
          await profileRef.update({
            campaigns: campaignsList
          });
          console.log(`[Scheduler] Registro de campanha agendada adicionada ao histórico da loja ${storeId}`);
        } catch (err) {
          console.error(`[Scheduler] Erro ao gravar histórico no perfil do restaurante:`, err);
        }
      }
    } catch (err) {
      console.error("[Scheduler] Erro no processador de agendamentos:", err);
    }
  }, 15000); // Executa a cada 15 segundos para máxima precisão

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
