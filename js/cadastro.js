import { initializeApp } from "firebase/app";
import { 
    getAuth, 
    createUserWithEmailAndPassword 
} from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

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
    if(tipo === 'sucesso') toast.classList.add('success');
    else toast.classList.remove('success');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
}

document.addEventListener("DOMContentLoaded", () => {
    const cadastroForm = document.getElementById('cadastro-form');

    cadastroForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nome = document.getElementById('cad-nome').value.trim();
        const telefone = document.getElementById('cad-telefone').value.trim();
        const email = document.getElementById('cad-email').value.trim();
        const senha = document.getElementById('cad-senha').value;

        // VALIDAÇÃO DO TELEFONE
        const numerosTelefone = telefone.replace(/\D/g, ''); // Remove tudo que não é número
        
        // Verifica se a pessoa colocou o 55 do Brasil
        if (telefone.includes("+55") || (numerosTelefone.length >= 12 && numerosTelefone.startsWith("55"))) {
            mostrarAviso("Digite o telefone sem o código do país (55). Use apenas o DDD e o número.");
            return; // Impede o cadastro de continuar
        }

        // Verifica se tem 10 (telefone fixo/antigo) ou 11 (celular com 9) dígitos
        if (numerosTelefone.length < 10 || numerosTelefone.length > 11) {
            mostrarAviso("O telefone deve ter o DDD do estado e o número correto (10 ou 11 dígitos).");
            return; // Impede o cadastro de continuar
        }

        try {
            // 1. Cria o usuário no Firebase Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
            const user = userCredential.user;

            // 2. Salva os dados na coleção "contas" usando o UID do usuário
            await setDoc(doc(db, "contas", user.uid), {
                nome: nome,
                telefone: telefone,
                email: email,
                tipo: "cliente",
                criadoEm: new Date()
            });

            mostrarAviso("Conta criada com sucesso! Redirecionando...", "sucesso");

            // 3. Redireciona direto para o sistema, já que não exige mais verificar e-mail
            setTimeout(() => {
                window.location.href = "agendamentos.html";
            }, 1500);

        } catch (error) {
            console.error("Erro no cadastro:", error.code);
            if (error.code === 'auth/email-already-in-use') {
                mostrarAviso("Este e-mail já está em uso.");
            } else if (error.code === 'auth/weak-password') {
                mostrarAviso("A senha deve ter pelo menos 6 caracteres.");
            } else {
                mostrarAviso("Erro ao criar conta. Tente novamente.");
            }
        }
    });
});