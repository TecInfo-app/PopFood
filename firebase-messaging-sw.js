importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCtz-4cniRtbA_rdxAE26-uOA_ji3Xz4RU",
  authDomain: "topfood-9ff42.firebaseapp.com",
  projectId: "topfood-9ff42",
  storageBucket: "topfood-9ff42.firebasestorage.app",
  messagingSenderId: "49269002867",
  appId: "1:49269002867:web:1ea3437d3e74e0671c1006"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'Novo Pedido! 🔔';
  const notificationOptions = {
    body: payload.notification?.body || 'Você tem uma nova atualização no PopFood.',
    icon: payload.notification?.image || 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/3119/3119338.png',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('fetch', (event) => {
  // Dummy fetch handler to satisfy PWA installability requirements
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Tenta focar em alguma janela que já esteja aberta
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      // Se não, abre a tela de pedidos ou home
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});
