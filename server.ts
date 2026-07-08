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
          image: 'favicon.png'
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

  // API route for Uber Direct Delivery
  app.post("/api/uber-direct/criar-entrega", async (req, res) => {
    const { orderDetails, storeId } = req.body;
    
    try {
      if (!storeId) {
        return res.status(400).json({ error: "Store ID é necessário." });
      }

      // Fetch Uber Direct config from Firestore
      const dbAdmin = admin.firestore();
      const storeDoc = await dbAdmin.collection('restaurantProfile').doc(storeId).get();
      
      if (!storeDoc.exists) {
        return res.status(404).json({ error: "Perfil da loja não encontrado." });
      }

      const storeData = storeDoc.data();
      const uberDirectConfig = storeData?.uberDirect;

      const clientId = uberDirectConfig?.clientId;
      const clientSecret = uberDirectConfig?.clientSecret;
      const customerId = uberDirectConfig?.customerId;

      if (!clientId || !clientSecret || !customerId) {
        return res.status(400).json({ error: "As credenciais da Uber Direct não foram configuradas no Painel." });
      }

      // 1. Obter Access Token da Uber
      const authResponse = await fetch('https://auth.uber.com/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
          scope: 'eats.deliveries'
        })
      });
      const authData = await authResponse.json();
      if (!authResponse.ok) throw new Error(`Erro autenticação Uber: ${authData.error_description || JSON.stringify(authData)}`);
      const accessToken = authData.access_token;

      // 2. Criar entrega na Uber
      const uberDeliveryRes = await fetch(`https://api.uber.com/v1/customers/${customerId}/deliveries`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderDetails)
      });
      const uberDeliveryData = await uberDeliveryRes.json();
      
      if (!uberDeliveryRes.ok) throw new Error(`Erro na API Uber: ${JSON.stringify(uberDeliveryData)}`);

      res.json({ success: true, delivery: uberDeliveryData });

    } catch (error: any) {
      console.error("Erro na integração Uber Direct:", error);
      res.status(500).json({ error: error.message || "Falha ao solicitar entrega na Uber." });
    }
  });

  // API route for Canceling Uber Direct Delivery
  app.post("/api/uber-direct/cancelar-entrega", async (req, res) => {
    const { deliveryId, storeId } = req.body;
    
    try {
      if (!storeId || !deliveryId) {
        return res.status(400).json({ error: "Store ID e Delivery ID são necessários." });
      }

      // Fetch Uber Direct config from Firestore
      const dbAdmin = admin.firestore();
      const storeDoc = await dbAdmin.collection('restaurantProfile').doc(storeId).get();
      
      if (!storeDoc.exists) {
        return res.status(404).json({ error: "Perfil da loja não encontrado." });
      }

      const storeData = storeDoc.data();
      const uberDirectConfig = storeData?.uberDirect;

      const clientId = uberDirectConfig?.clientId;
      const clientSecret = uberDirectConfig?.clientSecret;
      const customerId = uberDirectConfig?.customerId;

      if (!clientId || !clientSecret || !customerId) {
        return res.status(400).json({ error: "As credenciais da Uber Direct não foram configuradas." });
      }

      // 1. Obter Access Token da Uber
      const authResponse = await fetch('https://auth.uber.com/oauth/v2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'client_credentials',
          scope: 'eats.deliveries'
        })
      });
      const authData = await authResponse.json();
      if (!authResponse.ok) throw new Error(`Erro autenticação Uber: ${authData.error_description || JSON.stringify(authData)}`);
      const accessToken = authData.access_token;

      // 2. Cancelar entrega na Uber
      const uberDeliveryRes = await fetch(`https://api.uber.com/v1/customers/${customerId}/deliveries/${deliveryId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const uberDeliveryData = await uberDeliveryRes.json();
      
      if (!uberDeliveryRes.ok) throw new Error(`Erro na API Uber ao cancelar: ${JSON.stringify(uberDeliveryData)}`);

      res.json({ success: true, delivery: uberDeliveryData });

    } catch (error: any) {
      console.error("Erro na integração Uber Direct (Cancelamento):", error);
      res.status(500).json({ error: error.message || "Falha ao cancelar entrega na Uber." });
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
              returnUrl: `${origin}/cliente.html?store=${safeStoreId}&orderId=${orderId || ''}&abacateReturn=1`,
              completionUrl: `${origin}/cliente.html?store=${safeStoreId}&orderId=${orderId || ''}&abacateReturn=1`
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
          const orderSnap = await getDoc(orderDocRef);
          if (orderSnap.exists()) {
            const orderData = orderSnap.data();
            // Somente altera status para Pendente e envia push se estiver em AguardandoPagamento
            if (orderData.status === "AguardandoPagamento") {
              await updateDoc(orderDocRef, {
                status: "Pendente",
                paymentApproved: true,
                isPaid: true,
                paymentStatus: "Aprovado"
              });
              console.log(`Pedido ${orderId} atualizado de AguardandoPagamento para Pendente.`);

              // Enviar Push Notification de Novo Pedido para os tokens do lojista
              try {
                const dbAdmin = admin.firestore();
                const profileDoc = await dbAdmin.collection("restaurantProfile").doc(safeStoreId).get();
                if (profileDoc.exists) {
                  const profileData = profileDoc.data();
                  const merchantTokens = profileData?.merchantTokens || [];
                  if (merchantTokens.length > 0) {
                    const title = "🚨 Novo Pedido Recebido (Pago)!";
                    const formattedTotal = Number(orderData.total || amount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const body = `Pedido #${(orderId as string).substring(0, 5).toUpperCase()} no valor de ${formattedTotal} foi pago e recebido!`;
                    
                    for (const mToken of merchantTokens) {
                      try {
                        const message = {
                          notification: {
                            title,
                            body,
                            image: 'favicon.png'
                          },
                          data: {
                            orderId: orderId as string,
                            type: "new_order"
                          },
                          token: mToken,
                        };
                        await admin.messaging().send(message);
                        console.log(`Push enviado com sucesso para token ${mToken.substring(0, 8)}...`);
                      } catch (pushErr) {
                        console.error("Erro ao enviar push para token do lojista:", pushErr);
                      }
                    }
                  }
                }
              } catch (pushErr) {
                console.error("Erro ao obter tokens para envio de notificação push:", pushErr);
              }
            } else {
              // Se já estiver em outro status (ex: Pendente, Preparando), apenas atualiza os flags de pagamento
              await updateDoc(orderDocRef, {
                paymentApproved: true,
                isPaid: true,
                paymentStatus: "Aprovado"
              });
              console.log(`Pedido ${orderId} já estava com status ${orderData.status}. Flags de pagamento atualizados.`);
            }
          }
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
      
      // Query all restaurant profiles to check for scheduled notifications
      const profilesSnap = await dbAdmin.collection("restaurantProfile").get();
      if (profilesSnap.empty) return;

      for (const profileDoc of profilesSnap.docs) {
        const storeId = profileDoc.id;
        const pData = profileDoc.data();
        if (!pData || !Array.isArray(pData.scheduledNotifications) || pData.scheduledNotifications.length === 0) {
          continue;
        }

        let scheduledNotifications = [...pData.scheduledNotifications];
        let campaignsList = Array.isArray(pData.campaigns) ? [...pData.campaigns] : [];
        let updated = false;

        for (let i = 0; i < scheduledNotifications.length; i++) {
          const sched = scheduledNotifications[i];
          
          // Check if it is pending and due
          if (sched.status === "pending" && new Date(sched.scheduledFor) <= now) {
            console.log(`[Scheduler] Processando disparo agendado ${sched.id}: "${sched.title}" da loja ${storeId}`);
            
            // Mark as sending to avoid race conditions
            sched.status = "sending";
            sched.processedAt = new Date().toISOString();
            updated = true;
            
            // Update immediately on DB
            await dbAdmin.collection("restaurantProfile").doc(storeId).update({
              scheduledNotifications: scheduledNotifications
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

            // 3. Fetch from profile tokens
            if (Array.isArray(pData.clientTokens)) {
              pData.clientTokens.forEach((tok: any) => {
                if (tok && typeof tok === 'string' && tok.trim() !== "") {
                  uniqueTokens.add(tok.trim());
                }
              });
            }
            if (Array.isArray(pData.merchantTokens)) {
              pData.merchantTokens.forEach((tok: any) => {
                if (tok && typeof tok === 'string' && tok.trim() !== "") {
                  uniqueTokens.add(tok.trim());
                }
              });
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
                      title: sched.title,
                      body: sched.body,
                      image: 'favicon.png'
                    },
                    data: {
                      type: "campaign",
                      link: sched.link || ""
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

            // Remove from scheduled array and push to campaigns list
            scheduledNotifications = scheduledNotifications.filter(item => item.id !== sched.id);
            campaignsList.push({
              title: sched.title,
              body: sched.body,
              link: sched.link || "",
              sentAt: new Date().toISOString(),
              targetCount: tokens.length
            });

            // Update profile
            await dbAdmin.collection("restaurantProfile").doc(storeId).update({
              scheduledNotifications: scheduledNotifications,
              campaigns: campaignsList
            });

            console.log(`[Scheduler] Campanha agendada ${sched.id} enviada e movida para histórico da loja ${storeId}.`);
            i--; // adjust index
          }
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
