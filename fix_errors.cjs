const fs = require('fs');
let content = fs.readFileSync('pedidos.html', 'utf8');

// 1. Move getOrderSLA out of renderVisualOrdersGrid
const getSLAStr = `      function getOrderSLA(order) {
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
      }`;

// Remove it from its current place
content = content.replace(getSLAStr, '');

// And put it before renderVisualOrdersGrid
content = content.replace('      // Sort, aggregate and render orders separation', getSLAStr + '\n\n      // Sort, aggregate and render orders separation');

// 2. Fix updateTimers

// We need to find the setInterval and replace it
const setIntervalRegex = /setInterval\(\(\) => \{\s+const timers = document\.querySelectorAll\('\.order-live-timer'\);[\s\S]+?\}, 15000\); \/\/ Check every 15s/;

const newTimersCode = `      window.updateTimers = function() {
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
      };
      setInterval(window.updateTimers, 15000); // Check every 15s`;

content = content.replace(setIntervalRegex, newTimersCode);
content = content.replace('updateTimers();', 'window.updateTimers();');

fs.writeFileSync('pedidos.html', content);
