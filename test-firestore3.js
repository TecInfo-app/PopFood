import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
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
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  console.log("Setting up snapshot");
  onSnapshot(q, (snapshot) => {
    console.log("Snapshot fired! Docs:", snapshot.size);
    snapshot.forEach(d => console.log(d.id));
    process.exit();
  }, (err) => {
    console.error("Snapshot error:", err);
    process.exit();
  });
}
run();
