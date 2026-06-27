import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  arrayUnion 
} from 'firebase/firestore';
import { 
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyCtz-4cniRtbA_rdxAE26-uOA_ji3Xz4RU",
  authDomain: "topfood-9ff42.firebaseapp.com",
  projectId: "topfood-9ff42",
  storageBucket: "topfood-9ff42.firebasestorage.app",
  messagingSenderId: "49269002867",
  appId: "1:49269002867:web:1ea3437d3e74e0671c1006"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let messaging = null;
if (typeof window !== 'undefined') {
  try {
    messaging = getMessaging(app);
  } catch (e) {
    console.error("Failed to initialize Firebase Messaging", e);
  }
}

const COLLECTIONS = {
  products: "products",
  categories: "categories",
  complements: "complements",
  orders: "orders",
  clients: "clients",
  restaurantProfile: "restaurantProfile",
  coupons: "coupons"
};

// --- UTIL FUNCTIONS (UI) ---
if (typeof window !== 'undefined') {
  window.customAlert = function(message, title = "Aviso") {
    return new Promise((resolve) => {
      let modal = document.getElementById('custom-alert-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-alert-modal';
        modal.className = "fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-xs font-sans transition-all duration-300";
        modal.innerHTML = `
          <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col space-y-4 text-center transform scale-95 transition-all duration-300">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-slate-50 border border-slate-100">
              <span class="text-xl select-none">🔔</span>
            </div>
            <h3 id="custom-alert-title" class="font-display font-semibold text-base text-gray-800">Aviso</h3>
            <p id="custom-alert-msg" class="text-sm text-gray-600 break-words leading-relaxed select-text whitespace-pre-wrap"></p>
            <div class="pt-2">
              <button id="custom-alert-ok" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer">OK</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }
      
      const titleEl = document.getElementById('custom-alert-title');
      const msgEl = document.getElementById('custom-alert-msg');
      
      titleEl.textContent = title;
      msgEl.textContent = message;
      
      modal.classList.remove('hidden');
      
      const okBtn = document.getElementById('custom-alert-ok');
      okBtn.focus();
      okBtn.onclick = () => {
        modal.classList.add('hidden');
        resolve();
      };
    });
  };

  // Global override for alert()
  window.alert = function(message) {
    if (message === undefined) message = "undefined";
    if (message === null) message = "null";
    if (typeof message === 'object') {
      try {
        message = JSON.stringify(message, null, 2);
      } catch (e) {
        message = String(message);
      }
    }
    window.customAlert(String(message));
  };

  window.customConfirm = function(message) {
    return new Promise((resolve) => {
      let modal = document.getElementById('custom-confirm-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-confirm-modal';
        modal.className = "fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-xs font-sans";
        modal.innerHTML = `
          <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col space-y-4 text-center transform duration-200">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-50 border border-red-100">
              <span class="text-xl select-none">💬</span>
            </div>
            <h3 class="font-display font-semibold text-base text-gray-800">Confirmação</h3>
            <p id="custom-confirm-msg" class="text-sm text-gray-600 leading-relaxed select-text whitespace-pre-wrap"></p>
            <div class="flex gap-3 pt-2">
              <button id="custom-confirm-cancel" class="flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer">Cancelar</button>
              <button id="custom-confirm-ok" class="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer">Confirmar</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }
      
      document.getElementById('custom-confirm-msg').textContent = message;
      modal.classList.remove('hidden');
      
      document.getElementById('custom-confirm-cancel').onclick = () => {
        modal.classList.add('hidden');
        resolve(false);
      };
      
      document.getElementById('custom-confirm-ok').onclick = () => {
        modal.classList.add('hidden');
        resolve(true);
      };
    });
  };

  window.customPrompt = function(message) {
    return new Promise((resolve) => {
      let modal = document.getElementById('custom-prompt-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'custom-prompt-modal';
        modal.className = "fixed inset-0 bg-black/60 z-[1000] flex items-center justify-center p-4 backdrop-blur-xs font-sans";
        modal.innerHTML = `
          <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl flex flex-col space-y-4 text-center transform duration-200">
            <h3 class="font-display font-semibold text-base text-gray-800">Atenção</h3>
            <p id="custom-prompt-msg" class="text-sm text-gray-600 leading-relaxed select-text whitespace-pre-wrap text-left"></p>
            <input type="text" id="custom-prompt-input" class="w-full mt-3 px-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-center" autocomplete="off">
            <div class="flex gap-3 pt-2">
              <button id="custom-prompt-cancel" class="flex-1 border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer">Cancelar</button>
              <button id="custom-prompt-ok" class="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-all cursor-pointer">Confirmar</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
      }
      
      document.getElementById('custom-prompt-msg').textContent = message;
      const input = document.getElementById('custom-prompt-input');
      input.value = '';
      modal.classList.remove('hidden');
      setTimeout(() => input.focus(), 50);
      
      document.getElementById('custom-prompt-cancel').onclick = () => {
        modal.classList.add('hidden');
        resolve(null);
      };
      
      document.getElementById('custom-prompt-ok').onclick = () => {
        modal.classList.add('hidden');
        resolve(input.value);
      };
    });
  };
}

// --- EXPORTS ---
export {
  app,
  db,
  auth,
  messaging,
  COLLECTIONS,
  Timestamp,
  
  // Firestore APIs
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,

  // Auth APIs
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,

  // Messaging APIs
  getMessaging,
  getToken,
  onMessage
};
