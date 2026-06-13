import express from "express";
import cors from "cors";
import path from "path";
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

  // API route for payments
  app.post("/api/create-payment", async (req, res) => {
    const { amount, paymentMethodType, cardToken, email, description, storeId } = req.body;
    
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
        
        // 1. Create a dynamic product for the order with orderId as externalId
        const safeOrderId = req.body.orderId || `pedido-${Date.now()}`;
        const prodPayload = {
            externalId: safeOrderId,
            name: description || `Pedido ${safeOrderId} na PopFood`,
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
        
        // 2. Create the checkout with customizable returnUrl
        const returnUrl = req.body.returnUrl || req.headers.origin || 'http://localhost:3000';
        const checkoutPayload = {
            items: [{ id: prodData.data.id, quantity: 1 }],
            returnUrl: returnUrl
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
        let actualStatus = "PENDING";

        // Try direct status check first matching the transparents check format
        try {
          const checkRes = await fetch(`https://api.abacatepay.com/v2/transparents/check?id=${paymentId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${abacatePayToken}`,
              'Accept': 'application/json'
            }
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            actualStatus = checkData.data?.status || checkData.status || "PENDING";
          }
        } catch (e) {
          console.warn(`[AbacatePay Check] direct transparents/check failed, falling back to billing list. Error:`, e);
        }

        // Fallback to query list of bills if not paid yet
        if (actualStatus !== "PAID") {
          try {
            const billingRes = await fetch(`https://api.abacatepay.com/v2/billing/list`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${abacatePayToken}`,
                'Accept': 'application/json'
              }
            });
            if (billingRes.ok) {
              const billingData = await billingRes.json();
              const bills = billingData.data || [];
              const matchedBill = bills.find((b: any) => 
                b.id === paymentId || 
                (b.metadata && b.metadata.checkoutId === paymentId) ||
                (b.description && orderId && b.description.toUpperCase().includes((orderId as string).toUpperCase())) ||
                (b.externalId && orderId && String(b.externalId).toUpperCase() === String(orderId).toUpperCase())
              );
              if (matchedBill) {
                console.log(`[AbacatePay Check] Matched bill found: ${matchedBill.id} with status: ${matchedBill.status}`);
                actualStatus = matchedBill.status;
              }
            }
          } catch (listErr) {
            console.error(`[AbacatePay Check] Fallback billing/list query failed:`, listErr);
          }
        }

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
