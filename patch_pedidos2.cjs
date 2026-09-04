const fs = require('fs');
let content = fs.readFileSync('pedidos.html', 'utf8');

const oldInterval = `      setInterval(() => {
        const timers = document.querySelectorAll('.order-live-timer');
        const now = Date.now();
        timers.forEach(el => {
          const createdAt = parseInt(el.getAttribute('data-created'));
          const sla = parseInt(el.getAttribute('data-sla'));
          const status = el.getAttribute('data-status');
          
          if (!createdAt || isNaN(createdAt)) return;
          
          const elapsedMins = Math.floor((now - createdAt) / 60000);
          
          if (elapsedMins >= sla) {
             el.textContent = \\\`⏳ Atrasado (\${elapsedMins} min)\\\`;
             el.className = 'order-live-timer px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm bg-red-100 text-red-650 animate-pulse';
          } else {
             el.textContent = \\\`Há \${elapsedMins} min\\\`;
             el.className = 'order-live-timer px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm bg-slate-100 text-slate-600';
          }
        });
      }, 15000); // Check every 15s`;

const newInterval = `
      function updateTimers() {
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
      }
      setInterval(updateTimers, 15000);
`;

content = content.replace(oldInterval, newInterval.trim());

// We should also call updateTimers() at the end of renderVisualOrdersGrid
content = content.replace(
  'archivedParent.appendChild(createOrderVisualCard(order, false));\n          });\n        }',
  'archivedParent.appendChild(createOrderVisualCard(order, false));\n          });\n        }\n        updateTimers();'
);

fs.writeFileSync('pedidos.html', content);
