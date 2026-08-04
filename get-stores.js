import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyCtz-4cniRtbA_rdxAE26-uOA_ji3Xz4RU",
  authDomain: "topfood-9ff42.firebaseapp.com",
  projectId: "topfood-9ff42"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
async function run() {
  const snap = await getDocs(collection(db, "restaurantProfile"));
  snap.forEach(doc => console.log(doc.id, doc.data().name));
  process.exit(0);
}
run();
