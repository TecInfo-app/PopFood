import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import Stripe from 'stripe';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

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

  // Extremely permissive CORS for cross-origin requests from github.io
  app.use(cors({
    origin: true, 
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
    optionsSuccessStatus: 200
  }));
  
  app.options('*', cors()); // Explicitly handle preflight for all routes

  app.use(express.json());
  
  // Request logger for debugging
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Simple health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API route for payments
  app.post("/api/create-payment", async (req, res) => {
    const { amount, paymentMethodType, cardToken, email, customerName, name, description, storeId, origin, orderId } = req.body;
    
    try {
      const projectId = firebaseConfig.projectId;
      const apiKey = firebaseConfig.apiKey;
      const safeStoreId = storeId || "main";
      const actualName = customerName || name || "Cliente PopFood";
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
        
        // 1. Derive origins and return URLs
        let cleanOrigin = origin || req.headers.origin || "";
        if (cleanOrigin.includes('.run.app') || cleanOrigin.includes('ais-')) {
            cleanOrigin = cleanOrigin.replace('http://', 'https://');
        }
        cleanOrigin = cleanOrigin.replace(/\/$/, "");
        
        const returnUrl = `${cleanOrigin}/cliente.html?store=${safeStoreId}&abacatePayCheck=1&pendingOrderId=${orderId || ''}`;

        // 2. Create the checkout with INLINE products (AbacatePay v1 style)
        const checkoutPayload = {
            frequency: "ONE_TIME",
            methods: ["PIX", "CARD"],
            products: [
                {
                    externalId: orderId || `pedido-${Date.now()}`,
                    name: description || 'Pedido PopFood',
                    price: amountCents,
                    quantity: 1
                }
            ],
            returnUrl: returnUrl,
            completionUrl: returnUrl,
            redirectUrl: returnUrl,
            successUrl: returnUrl,
            return_url: returnUrl,
            completion_url: returnUrl,
            customer: {
                name: actualName,
                email: email || 'cliente@email.com'
            }
        };

        const checkoutRes = await fetch('https://api.abacatepay.com/v1/checkouts/create', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${abacatePayToken}`,
              'Accept': 'application/json'
            },
            body: JSON.stringify(checkoutPayload)
        });
        
        const checkoutData = await checkoutRes.json();
        
        // Handle standard successful responses and common variations
        if (!checkoutRes.ok || checkoutData.error || (checkoutData.status && checkoutData.status !== 'success' && !checkoutData.data)) {
            // Try fallback to singular if plural failed with 404
            if (checkoutRes.status === 404) {
               const fallbackRes = await fetch('https://api.abacatepay.com/v1/checkout/create', {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json', 
                    'Authorization': `Bearer ${abacatePayToken}`,
                    'Accept': 'application/json'
                  },
                  body: JSON.stringify(checkoutPayload)
               });
               if (fallbackRes.ok) {
                 const fallbackData = await fallbackRes.json();
                 const checkoutId = fallbackData.data?.id || fallbackData.id;
                 const checkoutUrl = fallbackData.data?.url || fallbackData.url;
                 return res.json({ provider: 'abacatepay', method: 'checkout', url: checkoutUrl, paymentId: checkoutId });
               }
            }
            const errorMsg = checkoutData.error?.message || checkoutData.error || checkoutData.message || JSON.stringify(checkoutData);
            throw new Error(`Erro AbacatePay (v1 Checkout): ${errorMsg}`);
        }
        
        const checkoutId = checkoutData.data?.id || checkoutData.id;
        const checkoutUrl = checkoutData.data?.url || checkoutData.url;

        return res.json({
            provider: 'abacatepay',
            method: 'checkout',
            url: checkoutUrl,
            paymentId: checkoutId
        });
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
    const { paymentId, storeId, orderId } = req.query;
    if (!paymentId) {
      return res.status(400).json({ error: "Parâmetro paymentId é obrigatório." });
    }
    const safeStoreId = (storeId as string) || "main";
    
    try {
      const projectId = firebaseConfig.projectId;
      const apiKey = firebaseConfig.apiKey;
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
        try {
          // Check specific checkout status using v1 list (most reliable way to find by ID)
          let checkRes = await fetch(`https://api.abacatepay.com/v1/checkouts/list`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${abacatePayToken}`,
              'Accept': 'application/json'
            }
          });
          
          if (!checkRes.ok && checkRes.status === 404) {
             checkRes = await fetch(`https://api.abacatepay.com/v1/checkout/list`, {
               method: 'GET',
               headers: {
                 'Authorization': `Bearer ${abacatePayToken}`,
                 'Accept': 'application/json'
               }
             });
          }
          if (checkRes.ok) {
            const listData = await checkRes.json();
            const checkouts = listData.data || listData || [];
            if (Array.isArray(checkouts)) {
              // Find by matching ID or externalId (orderId)
              const found = checkouts.find((c: any) => 
                String(c.id) === String(paymentId) || 
                String(c.externalId) === String(orderId) || 
                (c.metadata && String(c.metadata.orderId) === String(orderId))
              );
              
              if (found) {
                const actualStatus = String(found.status).toUpperCase();
                statusStr = actualStatus;
                // v1 usually uses 'PAID', 'CONFIRMED', or 'APPROVED'
                if (actualStatus === "PAID" || actualStatus === "CONFIRMED" || actualStatus === "APPROVED") {
                  isPaid = true;
                }
              }
            }
          }
        } catch (err) {
          console.error("Failed to verify abacatepay status:", err);
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
