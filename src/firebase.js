// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDtuK1I8px2mlXFZz3EMAQkexUf0Lq2xpw",
    authDomain: "finance-pro-app.firebaseapp.com",
    projectId: "finance-pro-app",
    storageBucket: "finance-pro-app.firebasestorage.app",
    messagingSenderId: "426414905310",
    appId: "1:426414905310:web:53db22755f7b276a54af4f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;
