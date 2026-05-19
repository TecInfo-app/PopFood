import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
// 1. ADICIONE ESTA IMPORTAÇÃO DO AUTH:
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Cole aqui os dados gerados pelo seu painel do Firebase:
const firebaseConfig = {
  apiKey: "AIzaSyDBHaHN0WWnesZtH8Z76n5RmTsy3Sn8EBI",
  authDomain: "tutubebidasapp-28b77.firebaseapp.com",
  // 🔴 LINHA ADICIONADA: Agora o Firebase sabe exatamente onde salvar os pedidos!
  databaseURL: "https://tutubebidasapp-28b77-default-rtdb.firebaseio.com",
  projectId: "tutubebidasapp-28b77",
  storageBucket: "tutubebidasapp-28b77.firebasestorage.app",
  messagingSenderId: "92833412828",
  appId: "1:92833412828:web:cbeb1ba840bfcbbd686619"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
// 2. CRIE A INSTÂNCIA DO AUTH:
const auth = getAuth(app);

// 3. EXPORTE O AUTH JUNTO COM O DB:
export { db, auth };
