import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    signInWithEmailAndPassword 
} from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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

function mostrarAviso(mensagem, tipo = 'erro') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = mensagem;
    if(tipo === 'sucesso') {
        toast.classList.add('success');
    } else {
        toast.classList.remove('success');
    }
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById('login-form');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value;

        try {
            // 1. Faz o login no Firebase Authentication com qualquer e-mail e senha cadastrados
            const userCredential = await signInWithEmailAndPassword(auth, email, senha);
            const user = userCredential.user;

            // 2. Consulta a coleção "contas" para verificar se é admin ou cliente
            const docRef = doc(db, "contas", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const dados = docSnap.data();
                mostrarAviso("Login efetuado com sucesso!", "sucesso");

                // 3. Redireciona conforme o tipo de conta cadastrado
                setTimeout(() => {
                    if (dados.tipo === "admin") {
                        window.location.href = "painel-admin.html";
                    } else {
                        window.location.href = "agendamentos.html";
                    }
                }, 1000);
            } else {
                mostrarAviso("Dados da conta não encontrados no sistema.");
            }

        } catch (error) {
            console.error("Erro no login:", error.code);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                mostrarAviso("E-mail ou senha incorretos.");
            } else {
                mostrarAviso("Erro ao entrar. Tente novamente.");
            }
        }
    });
});