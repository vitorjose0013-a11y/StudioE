import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyC_Fp2MBYDzCh-p3ZwvBGP4AmH3T41KEBs",
    authDomain: "studioe-horarios.firebaseapp.com",
    projectId: "studioe-horarios",
    storageBucket: "studioe-horarios.firebasestorage.app",
    messagingSenderId: "702929209365",
    appId: "1:702929209365:web:ada424a967de4b394b661c",
    measurementId: "G-ZGE0DDWBYP"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };