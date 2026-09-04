const fs = require('fs');
let content = fs.readFileSync('pedidos.html', 'utf8');

const getSLAFunc = `
      function getOrderSLA(order) {
        const customerObj = order.customer || order.client || {};
        const isMesa =
          customerObj.type === "Mesa" ||
          (customerObj.address && customerObj.address.toLowerCase().includes("mesa")) ||
          (order.origin && order.origin.includes("Mesa"));
        const isPickup =
          customerObj.type === "pickup" ||
          customerObj.type === "Retirada" ||
          isMesa ||
          order.isPickup;

        if (isPickup) return 30; // 30 minutes for pickup / mesa

        let slaMins = 50; // default
        if (typeof loadedRestaurantProfile !== 'undefined' && loadedRestaurantProfile) {
            let matchedKM = null;
            const ceilings = Object.keys(loadedRestaurantProfile.deliveryRates || {}).map(Number).sort((a,b) => a-b);
            const dist = order.distance || 2.0;
            if (ceilings.length > 0) {
              for (let c of ceilings) {
                if (dist <= c) {
                  matchedKM = c;
                  break;
                }
              }
              if (matchedKM === null) {
                matchedKM = ceilings[ceilings.length - 1];
              }
            }
            if (matchedKM !== null && loadedRestaurantProfile.deliveryTimes && loadedRestaurantProfile.deliveryTimes[matchedKM] !== undefined) {
              slaMins = Number(loadedRestaurantProfile.deliveryTimes[matchedKM]);
            } else if (loadedRestaurantProfile.deliveryDuration) {
              slaMins = parseInt(loadedRestaurantProfile.deliveryDuration) || 50;
            }
        }
        return slaMins;
      }
`;

content = content.replace('      // Separate arrays', getSLAFunc + '\n      // Separate arrays');

const dateLine = `<p class="text-[11px] text-gray-400 font-medium">🕒 \${order.date || ''} | 👤 \${(order.customer || order.client || {}).name || 'Cliente'}</p>`;

const newDateLine = `
          <div class="flex items-center justify-between">
            <p class="text-[11px] text-gray-400 font-medium">🕒 \${order.date || ''} | 👤 \${(order.customer || order.client || {}).name || 'Cliente'}</p>
            \${(() => {
              if (order.status !== 'Entregue' && order.status !== 'Cancelado') {
                let orderTime = 0;
                if (order.createdAt) {
                  if (typeof order.createdAt === "object" && typeof order.createdAt.seconds === "number") {
                    orderTime = order.createdAt.seconds * 1000;
                  } else if (typeof order.createdAt === "object" && typeof order.createdAt.toDate === "function") {
                    orderTime = order.createdAt.toDate().getTime();
                  } else {
                    orderTime = new Date(order.createdAt).getTime();
                  }
                }
                const sla = getOrderSLA(order);
                return \`<span class="order-live-timer px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm" data-created="\${orderTime}" data-sla="\${sla}" data-status="\${order.status}">--</span>\`;
              }
              return '';
            })()}
          </div>
`;

content = content.replace(dateLine, newDateLine.trim());

// Add the setInterval to update timers
const timerIntervalScript = `
      setInterval(() => {
        const timers = document.querySelectorAll('.order-live-timer');
        const now = Date.now();
        timers.forEach(el => {
          const createdAt = parseInt(el.getAttribute('data-created'));
          const sla = parseInt(el.getAttribute('data-sla'));
          const status = el.getAttribute('data-status');
          
          if (!createdAt || isNaN(createdAt)) return;
          
          const elapsedMins = Math.floor((now - createdAt) / 60000);
          
          if (elapsedMins >= sla) {
             el.textContent = \`⏳ Atrasado (\${elapsedMins} min)\`;
             el.className = 'order-live-timer px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm bg-red-100 text-red-650 animate-pulse';
          } else {
             el.textContent = \`Há \${elapsedMins} min\`;
             el.className = 'order-live-timer px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm bg-slate-100 text-slate-600';
          }
        });
      }, 15000); // Check every 15s
`;

content = content.replace('      // Build responsive order element structure', timerIntervalScript + '\n      // Build responsive order element structure');

fs.writeFileSync('pedidos.html', content);
