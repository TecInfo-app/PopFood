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

  // Standard robust CORS configuration that handles all preflight requests gracefully
  app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
    optionsSuccessStatus: 200
  }));

  app.use(express.json());

  // --- SYSTEM BILLING ROUTES (FOR PLATFORM OWNER) ---
  app.post("/api/billing/create-charge", async (req, res) => {
    const { storeId } = req.body;
    if (!storeId) return res.status(400).json({ error: "storeId is required" });

    try {
      const projectId = firebaseConfig.projectId;
      const apiKey = firebaseConfig.apiKey;

      // 1. Get Global System Billing Settings (for the Master Abacate Key)
      const settingsUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/appSettings/billing?key=${apiKey}`;
      const settingsRes = await fetch(settingsUrl);
      if (!settingsRes.ok) throw new Error("Favor configurar a chave AbacatePay do Sistema no SuperAdmin.");
      
      const settingsData = await settingsRes.json();
      const masterAbacateKey = settingsData.fields?.abacatePayKey?.stringValue;
      if (!masterAbacateKey) throw new Error("Chave AbacatePay do Sistema não encontrada.");

      // 2. Get Store Profile (to get monthlyFee and pixKey)
      const profileUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/restaurantProfile/${storeId}?key=${apiKey}`;
      const profileRes = await fetch(profileUrl);
      if (!profileRes.ok) throw new Error("Perfil da loja não encontrado.");
      
      const profileDoc = await profileRes.json();
      const pFields = profileDoc.fields || {};
      const monthlyFee = parseFloat(pFields.monthlyFee?.doubleValue || pFields.monthlyFee?.integerValue || 0);
      const storeName = pFields.name?.stringValue || storeId;
      const adminEmail = pFields.adminEmail?.stringValue || '';

      if (monthlyFee <= 0) throw new Error("Valor da mensalidade não configurado para esta loja.");

      // 3. Check if we already have a generated charge for this store's current billing cycle
      // (For simplicity, we'll try to reuse it if it matches the current month, but for now we just create a new one as requested)
      
      const amountCents = Math.round(monthlyFee * 100);
      
      // Create a Product on Abacate Pay for this specific invoice
      const prodPayload = {
        externalId: `mensalidade-${storeId}-${new Date().getMonth()+1}-${new Date().getFullYear()}`,
        name: `Mensalidade PopFood - ${storeName}`,
        price: amountCents,
        currency: 'BRL'
      };

      const prodRes = await fetch('https://api.abacatepay.com/v2/products/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAbacateKey}` },
        body: JSON.stringify(prodPayload)
      });
      const prodData = await prodRes.json();
      
      // Product creation might fail if externalId already exists (meaning already generated today/this month)
      // If it exists, we search for it. But Abacate API "create checkout" can also take existing product IDs.
      
      let productId = prodData.data?.id;
      if (!prodRes.ok && prodData.error?.includes('externalId')) {
         // Fallback: list products or just assume we need to handle this error
         // Simplest way: if error, try to fetch products list and find by externalId
         const listRes = await fetch('https://api.abacatepay.com/v2/products/list', {
            headers: { 'Authorization': `Bearer ${masterAbacateKey}` }
         });
         const listData = await listRes.json();
         const existingProd = listData.data?.find((p: any) => p.externalId === prodPayload.externalId);
         if (existingProd) productId = existingProd.id;
      }

      if (!productId) {
         throw new Error(`Erro ao preparar produto de faturamento: ${JSON.stringify(prodData)}`);
      }

      // Create Checkout
      const origin = req.headers.origin || 'http://localhost:3000';
      const checkoutPayload = {
        items: [{ id: productId, quantity: 1 }],
        customer: adminEmail ? { email: adminEmail } : undefined,
        returnUrl: `${origin}/perfil.html?billingReturn=1`,
        methods: ['pix'] // Forces PIX for platform fees
      };

      const checkoutRes = await fetch('https://api.abacatepay.com/v2/checkouts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${masterAbacateKey}` },
        body: JSON.stringify(checkoutPayload)
      });
      const checkoutData = await checkoutRes.json();

      if (!checkoutRes.ok) {
        throw new Error(`Erro ao gerar checkout: ${JSON.stringify(checkoutData)}`);
      }

      return res.json({
        url: checkoutData.data.url,
        id: checkoutData.data.id
      });

    } catch (error: any) {
      console.error("Billing logic error:", error);
      res.status(500).json({ error: error.message || "Erro ao processar faturamento do sistema" });
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
