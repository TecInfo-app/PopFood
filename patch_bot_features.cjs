const fs = require('fs');
let code = fs.readFileSync('whatsapp-bot.ts', 'utf8');

const regexOptions = /3️⃣ \*Fazer Novo Pedido\*\n` \+\n                             `4️⃣ \*Ver Detalhes do Pedido \(\#\$\{activeOrder.id\}\)\*`;/g;
code = code.replace(regexOptions, `3️⃣ *Fazer Novo Pedido*\\n\` +\n                             \`4️⃣ *Ver Detalhes do Pedido (#\${activeOrder.id})*\\n\` +\n                             \`5️⃣ *Cupons*\\n\` +\n                             \`6️⃣ *Programa Fidelidade*\`;`);

const regexWelcome = /4️⃣ \*Status do Pedido\*/g;
code = code.replace(regexWelcome, `4️⃣ *Status do Pedido*\\n5️⃣ *Cupons*\\n6️⃣ *Programa Fidelidade*`);

const handlersInsertion = `
  // 5. Cupons
  if (lowerText === '5' || lowerText.includes('cupons') || lowerText.includes('cupom') || lowerText.includes('promocao') || lowerText.includes('promoção')) {
    const couponsRef = collection(db, "coupons");
    const q = query(couponsRef, where("storeId", "==", storeId));
    const qSnap = await getDocs(q);
    
    let activeCoupons = [];
    qSnap.forEach(docSnap => {
      const c = docSnap.data();
      if (c.active) activeCoupons.push(c);
    });

    if (activeCoupons.length === 0) {
      await sock.sendMessage(senderId, { text: "🎫 *Cupons de Desconto*\\n\\nNo momento não temos cupons promocionais ativos. Fique de olho em nossas redes sociais para novidades!" });
      return;
    }

    let reply = "🎫 *Cupons de Desconto Ativos:*\\n\\n";
    activeCoupons.forEach(c => {
      reply += \`🏷️ *CÓDIGO: \${c.code}*\\n\`;
      const desc = c.type === 'percentual' ? \`\${c.value}% de desconto\` : \`R$ \${Number(c.value).toFixed(2).replace('.', ',')} de desconto\`;
      reply += \`🎁 \${desc}\\n\`;
      if (c.minValue) reply += \`⚠️ Pedido mínimo: R$ \${Number(c.minValue).toFixed(2).replace('.', ',')}\\n\`;
      if (c.firstOrderOnly) reply += \`✨ Válido apenas para o primeiro pedido\\n\`;
      reply += \`\\n\`;
    });
    reply += \`👉 Acesse nosso cardápio e use seu cupom no final do pedido!\`;
    
    await sock.sendMessage(senderId, { text: reply });
    return;
  }

  // 6. Programa Fidelidade
  if (lowerText === '6' || lowerText.includes('fidelidade') || lowerText.includes('programa fidelidade') || lowerText.includes('pontos')) {
    if (!profile.loyaltyActive) {
      await sock.sendMessage(senderId, { text: "🏆 *Programa Fidelidade*\\n\\nNosso programa de fidelidade não está ativo no momento. Continue acompanhando nossas novidades!" });
      return;
    }

    const minOrders = profile.loyaltyMinOrders || 3;
    
    const validOrders = customerOrders.filter(d => d.status === "Entregue" && !(d.descontoFidelidade > 0 || d.fidelidadeAtivo === true)).length;
    const usedRewards = customerOrders.filter(d => d.status !== "Cancelado" && (d.descontoFidelidade > 0 || d.fidelidadeAtivo === true)).length;
    
    const earnedRewards = Math.floor(validOrders / minOrders);
    const availableRewards = Math.max(0, earnedRewards - usedRewards);
    const progress = validOrders % minOrders;

    let reply = "🏆 *Seu Programa de Fidelidade*\\n\\n";
    
    if (availableRewards > 0) {
      reply += \`🎉 *PARABÉNS! Você tem \${availableRewards} prêmio(s) pronto(s) para resgatar!*\\n\`;
      reply += \`O desconto será aplicado automaticamente no seu próximo pedido.\\n\\n\`;
    }
    
    reply += \`📊 *Seu progresso atual:* \\n\`;
    reply += \`Você tem *\${progress}* de *\${minOrders}* pedidos necessários para o próximo prêmio.\\n\\n\`;
    
    const typeDesc = profile.loyaltyType === 'percentual' ? \`\${profile.loyaltyValue}% de desconto\` : \`R$ \${Number(profile.loyaltyValue || 0).toFixed(2).replace('.', ',')} de desconto\`;
    reply += \`🎁 *O prêmio:* \${typeDesc} após completar \${minOrders} pedidos!\\n\\n\`;
    reply += \`👉 Faça um novo pedido e continue acumulando!\`;

    await sock.sendMessage(senderId, { text: reply });
    return;
  }
`;

const fallbackRegex = /\/\/ Default fallback reply/g;
code = code.replace(fallbackRegex, handlersInsertion + "\n  // Default fallback reply");

fs.writeFileSync('whatsapp-bot.ts', code);
console.log('done');
