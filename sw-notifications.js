// PopFood - Service Worker para Notificações
// Arquivo: sw-notifications.js
// Deve estar na raiz do repositório: /PopFood/sw-notifications.js

self.addEventListener('install', (event) => {
  console.log('[SW] Instalado com sucesso.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Ativado.');
  event.waitUntil(clients.claim());
});

// Receber mensagens da página para disparar notificações
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        body: body,
        tag: tag || 'popfood-notif',
        renotify: true,
        requireInteraction: true,
        icon: 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png',
        badge: 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png',
        vibrate: [200, 100, 200]
      })
    );
  }
});

// Ao clicar na notificação, abre o painel de pedidos
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('pedidos.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/PopFood/pedidos.html');
      }
    })
  );
});
