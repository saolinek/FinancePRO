// Firebase configuration
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

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

// Initialize Firestore with persistent cache for faster loads
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;

