// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, 
    deleteDoc, query, where, orderBy, addDoc, onSnapshot, Timestamp,
    arrayUnion, arrayRemove, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const COLLECTIONS = {
    PRODUCTS: 'products',
    CATEGORIES: 'categories',
    COMPLEMENTS: 'complements',
    ORDERS: 'orders',
    CLIENTS: 'clients',
    RESTAURANT_PROFILE: 'restaurantProfile'
};

export { 
    db, auth, 
    collection, doc, getDocs, getDoc, setDoc, updateDoc, 
    deleteDoc, query, where, orderBy, addDoc, onSnapshot, 
    Timestamp, COLLECTIONS, arrayUnion, arrayRemove, writeBatch
};
