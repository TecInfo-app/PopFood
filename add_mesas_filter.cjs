const fs = require('fs');

let content = fs.readFileSync('pedidos.html', 'utf8');

// Button
content = content.replace(
`              <button
                onclick="selectStateFilter('Cancelado')"
                class="filter-btn text-xs font-bold py-2 px-4 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                data-status="Cancelado"
              >
                Cancelados
              </button>`,
`              <button
                onclick="selectStateFilter('Cancelado')"
                class="filter-btn text-xs font-bold py-2 px-4 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                data-status="Cancelado"
              >
                Cancelados
              </button>
              <button
                onclick="selectStateFilter('Mesas')"
                class="filter-btn text-xs font-bold py-2 px-4 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-all cursor-pointer"
                data-status="Mesas"
              >
                Mesas
              </button>`
);

// JS Filter Logic
content = content.replace(
`        let drawingList = globalOrdersList;
        if (activeFilter !== "Todos") {
          drawingList = globalOrdersList.filter(
            (o) => o.status === activeFilter,
          );
        }`,
`        let drawingList = globalOrdersList;
        if (activeFilter === "Mesas") {
          drawingList = globalOrdersList.filter(
            (o) => {
              const cust = o.customer || o.client || {};
              return cust.type === "Mesa" || (cust.address && cust.address.toLowerCase().includes("mesa")) || (o.origin && o.origin.includes("Mesa"));
            }
          );
        } else if (activeFilter !== "Todos") {
          drawingList = globalOrdersList.filter(
            (o) => o.status === activeFilter,
          );
        }`
);

fs.writeFileSync('pedidos.html', content);
console.log('Done!');
