import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
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
    const profileObj = {
        id: "main",
        name: "My Store",
        description: "",
        phone: "123",
        cep: "123",
        address: "Av",
        openTime: "",
        closeTime: "",
        latitude: -23,
        longitude: -23,
        banners: [],
        show: true
    };
    await setDoc(doc(db, "restaurantProfile", "main"), profileObj, { merge: true });
    console.log("Success");
  } catch(err) {
    console.error("SetDoc error:", err.message, err.code);
  }
  process.exit();
}
run();
