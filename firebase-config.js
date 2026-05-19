import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
// 1. ADICIONE ESTA IMPORTAÇÃO DO AUTH:
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Cole aqui os dados gerados pelo seu painel do Firebase:
const firebaseConfig = {
    apiKey: "Sua_ApiKey_Aqui",
    authDomain: "tutubebidasapp-28b77.firebaseapp.com",
    // 🔴 ADICIONE OU CORRIJA ESTA LINHA EXATA ABAIXO:
    databaseURL: "https://tutubebidasapp-28b77-default-rtdb.firebaseio.com", 
    projectId: "tutubebidasapp-28b77",
    storageBucket: "tutubebidasapp-28b77.appspot.com",
    messagingSenderId: "Seu_Sender_Id",
    appId: "Seu_App_Id"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
// 2. CRIE A INSTÂNCIA DO AUTH:
const auth = getAuth(app);

// 3. EXPORTE O AUTH JUNTO COM O DB:
export { db, auth };
