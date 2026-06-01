import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs } from 'firebase/firestore';
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
    const orderDocument = {
          id: "TEST-ORDER-123",
          date: new Date().toLocaleString('pt-BR'),
          createdAt: new Date().toISOString(),
          customer: {
            name: "Test",
            phone: "123",
            email: "",
            address: "Street, Nº 1",
            complement: "",
            reference: "",
            cep: "123"
          },
          paymentMethod: "Pix",
          items: [],
          subtotal: 0,
          deliveryFee: 0,
          desconto: 0,
          cupomId: null,
          cupomCode: null,
          distance: 0,
          total: 0,
          status: "Pendente"
        };
    await setDoc(doc(db, "orders", "TEST-ORDER-123"), orderDocument);
    console.log("Order saved!");
  } catch(err) {
    console.error("Order error:", err);
  }
  process.exit();
}
run();
