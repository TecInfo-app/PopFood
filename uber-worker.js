export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);

      if (request.method === "POST" && url.pathname === "/criar-entrega") {
        const body = await request.json();
        const { clientId, clientSecret, customerId, orderDetails } = body;

        if (!clientId || !clientSecret || !customerId) {
          return new Response(JSON.stringify({ error: "Credenciais ausentes." }), { status: 400, headers: corsHeaders });
        }

        // 1. Autenticar
        const authReq = await fetch('https://auth.uber.com/oauth/v2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
            scope: 'eats.deliveries'
          })
        });
        const authData = await authReq.json();
        if (!authReq.ok) throw new Error("Erro auth Uber: " + JSON.stringify(authData));

        // 2. Criar entrega
        const deliveryReq = await fetch(`https://api.uber.com/v1/customers/${customerId}/deliveries`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authData.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(orderDetails)
        });
        const deliveryData = await deliveryReq.json();
        if (!deliveryReq.ok) throw new Error("Erro criar entrega: " + JSON.stringify(deliveryData));

        return new Response(JSON.stringify({ success: true, delivery: deliveryData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (request.method === "POST" && url.pathname === "/cancelar-entrega") {
        const body = await request.json();
        const { clientId, clientSecret, customerId, deliveryId } = body;

        const authReq = await fetch('https://auth.uber.com/oauth/v2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials',
            scope: 'eats.deliveries'
          })
        });
        const authData = await authReq.json();

        const cancelReq = await fetch(`https://api.uber.com/v1/customers/${customerId}/deliveries/${deliveryId}/cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authData.access_token}`,
            'Content-Type': 'application/json'
          }
        });
        const cancelData = await cancelReq.json();

        return new Response(JSON.stringify({ success: true, delivery: cancelData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
