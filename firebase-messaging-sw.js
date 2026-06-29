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

  // If the payload already contains a notification object, the browser/FCM SDK
  // will automatically show it when in the background. Showing it again here
  // results in double/duplicate notifications on the device.
  if (payload.notification) {
    console.log('[firebase-messaging-sw.js] Notification object present, letting browser handle it to avoid duplicates.');
    return;
  }

  // Otherwise, if it is a data-only payload, we construct and show the notification ourselves.
  const title = payload.data?.title || 'PopFood 🔔';
  const body = payload.data?.body || 'Você tem uma nova atualização no PopFood.';
  const icon = payload.data?.icon || '/novo-icone.png';

  const notificationOptions = {
    body: body,
    icon: icon,
    badge: '/novo-icone.png',
    data: payload.data
  };

  self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Dummy fetch handler to satisfy PWA installability requirements
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  let linkToOpen = './';
  if (event.notification.data && event.notification.data.link) {
    linkToOpen = event.notification.data.link;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(linkToOpen);
      }
    })
  );
});
