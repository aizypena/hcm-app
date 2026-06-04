import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCIF5k6DirIFlgdXuoTZN00M5SaXCM-zew",
  authDomain: "hcm-time-tracking-897ad.firebaseapp.com",
  projectId: "hcm-time-tracking-897ad",
  storageBucket: "hcm-time-tracking-897ad.firebasestorage.app",
  messagingSenderId: "489041759201",
  appId: "1:489041759201:web:0b2106694082a9589360a0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
