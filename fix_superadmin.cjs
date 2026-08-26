const fs = require('fs');
let content = fs.readFileSync('superadmin.html', 'utf8');

const oldOrdersCountStr = `        // 2. Fetch overall metrics from orders (Global collection)
        const ordersSnap = await getDocs(collection(db, COLLECTIONS.orders));
        let totalOrdersCount = ordersSnap.size;

        // 3. Fetch overall clients`;

const newOrdersCountStr = `        // 2. Fetch overall metrics from orders (Global collection)
        const ordersSnap = await getDocs(collection(db, COLLECTIONS.orders));
        let totalOrdersCount = ordersSnap.size;

        const storeOrderCounts = {};
        ordersSnap.forEach(doc => {
           const data = doc.data();
           const sid = data.storeId;
           if(sid) {
              storeOrderCounts[sid] = (storeOrderCounts[sid] || 0) + 1;
           }
        });

        loadedStores = loadedStores.map(store => ({
           ...store,
           totalOrdersCount: storeOrderCounts[store.id] || 0
        }));

        // 3. Fetch overall clients`;

content = content.replace(oldOrdersCountStr, newOrdersCountStr);

const oldStoreHtml = `            ${store.adminEmail ? \`<p class="text-[10px] text-gray-600 mt-1.5"><span class="font-extrabold text-orange-500 text-[9px] uppercase tracking-wider">🔐 Acesso:</span> <span class="font-mono font-bold text-slate-800">\${store.adminEmail}</span> / <span class="font-mono text-slate-700">\${store.adminPassword}</span></p>\` : ''}
            <p class="text-[10px] text-gray-400 mt-1 line-clamp-1">📍 \${store.address || 'Sem endereço'}</p>
            
            <div class="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10px]">`;

const newStoreHtml = `            ${store.adminEmail ? \`<p class="text-[10px] text-gray-600 mt-1.5"><span class="font-extrabold text-orange-500 text-[9px] uppercase tracking-wider">🔐 Acesso:</span> <span class="font-mono font-bold text-slate-800">\${store.adminEmail}</span> / <span class="font-mono text-slate-700">\${store.adminPassword}</span></p>\` : ''}
            <p class="text-[10px] text-gray-400 mt-1 line-clamp-1">📍 \${store.address || 'Sem endereço'}</p>
            <p class="text-[10px] text-gray-400 mt-1 line-clamp-1">📦 Pedidos da Loja: <strong class="text-gray-600">\${store.totalOrdersCount || 0}</strong></p>
            
            <div class="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10px]">`;

content = content.replace(oldStoreHtml, newStoreHtml);

fs.writeFileSync('superadmin.html', content);
