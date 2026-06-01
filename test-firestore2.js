import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
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
async function run() {
  try {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    console.log("Documents found: ", snap.size);
    snap.forEach(doc => {
       console.log(doc.id, doc.data());
    });
  } catch(err) {
    console.error("Order error:", err);
  }
  process.exit();
}
run();
