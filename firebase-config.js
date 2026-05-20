// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, 
    deleteDoc, query, where, orderBy, addDoc, onSnapshot, arrayUnion, 
    arrayRemove, writeBatch, Timestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getStorage, ref, uploadBytes, getDownloadURL, deleteObject 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCaS5J1mbJtxfZsA6O6WGpCBKKJimG27sw",
    authDomain: "popfood-ea5ff.firebaseapp.com",
    projectId: "popfood-ea5ff",
    storageBucket: "popfood-ea5ff.firebasestorage.app",
    messagingSenderId: "677810682230",
    appId: "1:677810682230:web:96bbf1b452edf9fcfb6257"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Nomes das coleções
const COLLECTIONS = {
    PRODUCTS: 'products',
    CATEGORIES: 'categories',
    COMPLEMENTS: 'complements',
    ORDERS: 'orders',
    CLIENTS: 'clients',
    RESTAURANT_PROFILE: 'restaurantProfile',
    CURRENT_SESSION: 'currentSession'
};

export { 
    db, storage, auth, 
    collection, doc, getDocs, getDoc, setDoc, updateDoc, 
    deleteDoc, query, where, orderBy, addDoc, onSnapshot, 
    arrayUnion, arrayRemove, writeBatch, Timestamp,
    COLLECTIONS
};
