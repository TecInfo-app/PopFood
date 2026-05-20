// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, push, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuração oficial do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDBHaHN0WWnesZtH8Z76n5RmTsy3Sn8EBI",
    authDomain: "tutubebidasapp-28b77.firebaseapp.com",
    databaseURL: "https://tutubebidasapp-28b77-default-rtdb.firebaseio.com",
    projectId: "tutubebidasapp-28b77",
    storageBucket: "tutubebidasapp-28b77.firebasestorage.app",
    messagingSenderId: "92833412828",
    appId: "1:92833412828:web:cbeb1ba840bfcbbd686619"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// Exportar tudo que será usado nos outros arquivos
export { 
    db, 
    auth, 
    ref, 
    onValue, 
    set, 
    update, 
    remove, 
    push, 
    get,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut
};
