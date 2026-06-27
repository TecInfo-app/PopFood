importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

// Configuração do Firebase no Service Worker
const firebaseConfig = {
  apiKey: "API_KEY", // O token não é crítico aqui, pois apenas escuta, mas deveria vir do config.
  // Você precisará preencher essas infos ou passá-las via query param.
  // Por enquanto, o Firebase Messaging no SW geralmente exige que chamemos firebase.initializeApp(config).
  // Para simplificar e evitar vazar dados, podemos deixar um placeholder, ou pegar do Firebase Hosting se estiver hospedado lá.
};

// Como não temos a configuração injetada automaticamente, deixamos um listener de push genérico.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Dummy fetch handler to satisfy PWA installability requirements
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.notification?.title || 'Novo Pedido! 🔔';
  const options = {
    body: data.notification?.body || 'Você tem uma nova atualização no PopFood.',
    icon: data.notification?.image || 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png',
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Focar na janela existente ou abrir nova
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('/pedidos.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/pedidos.html');
      }
    })
  );
});
