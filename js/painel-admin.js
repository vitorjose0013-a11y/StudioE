import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getFirestore, collection, query, where, getDocs, doc, getDoc, deleteDoc, runTransaction 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const horariosPorPeriodo = {
    "Manhã": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"],
    "Tarde": ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"],
    "Noite": ["18:30", "19:00", "19:30", "20:00"]
};

const diasSemanaExtenso = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 
    'Quinta-feira', 'Sexta-feira', 'Sábado'
];

function mostrarAviso(mensagem, tipo = 'erro') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = mensagem;
    if (tipo === 'sucesso') {
        toast.classList.add('success');
    } else {
        toast.classList.remove('success');
    }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3200);
}

// 1. Renderiza a grade de horários se houver container na tela do admin
function renderHorariosAdmin() {
    const container = document.getElementById("time-grid-container");
    if (!container) return;

    container.innerHTML = "";

    for (const periodo in horariosPorPeriodo) {
        container.innerHTML += `
            <div class="period-header">
                <i class="fa-regular fa-clock"></i> ${periodo}
            </div>
            <div class="time-grid">
                ${horariosPorPeriodo[periodo].map((hora, index) => `
                    <div class="time-item" data-hora="${hora}" id="grid-item-${periodo}-${index}">
                        <label>
                            ${hora}
                        </label>
                    </div>
                `).join("")}
            </div>
        `;
    }
}

// 2. Atualiza o estado da tela ao alterar a data
async function atualizarEstadoHorarios(dataSelecionada) {
    if (!dataSelecionada) return;

    const partesData = dataSelecionada.split('-');
    const dataObj = new Date(Number(partesData[0]), Number(partesData[1]) - 1, Number(partesData[2]));
    const diaDaSemana = dataObj.getDay(); 

    // Reseta todos os blocos na tela
    document.querySelectorAll('.time-item').forEach(item => {
        item.classList.remove('ocupado', 'bloqueado-admin');
        item.onclick = null;
        item.removeAttribute('data-agendamento-id');
        const label = item.querySelector('label');
        if (label) {
            label.innerHTML = item.dataset.hora;
        }
    });

    // Domingo ou Segunda-feira (Barbearia Fechada)
    if (diaDaSemana === 0 || diaDaSemana === 1) {
        document.querySelectorAll('.time-item').forEach(item => {
            item.classList.add('ocupado');
            const label = item.querySelector('label');
            if (label) {
                label.innerHTML = `${item.dataset.hora}<br><small>Indisponível</small>`;
            }
        });

        const container = document.getElementById('admin-agendamentos-list');
        if (container) {
            container.innerHTML = `<div class="service-card" style="justify-content: center; color: #6b7280;">A barbearia não abre aos domingos e segundas-feiras.</div>`;
        }
        return;
    }

    try {
        await carregarAgendamentosDoDia(dataSelecionada);
    } catch (erro) {
        console.error("Erro ao carregar dados do dia:", erro);
        mostrarAviso("Erro ao buscar dados do dia.");
    }
}

// 3. Busca agendamentos e vincula os eventos de Bloquear/Desbloquear
// 3. Busca agendamentos e vincula os eventos de Bloquear/Desbloquear
async function carregarAgendamentosDoDia(dataSelecionada) {
    const container = document.getElementById('admin-agendamentos-list');
    if (container) {
        container.innerHTML = `<div class="service-card" style="justify-content: center; color: #6b7280;">Carregando agendamentos...</div>`;
    }

    try {
        const q = query(collection(db, "agendamentos"), where("data", "==", dataSelecionada));
        const querySnapshot = await getDocs(q);

        const agendamentosPorHora = {};
        const agendamentosLista = [];

        querySnapshot.forEach((docSnap) => {
            const dados = docSnap.data();
            agendamentosPorHora[dados.horario] = { id: docSnap.id, ...dados };
            agendamentosLista.push({ id: docSnap.id, ...dados });
        });

        // 1. Configura os cliques em cada quadrado da GRADE de horários (Ainda mostra o bloqueado aqui)
        document.querySelectorAll('.time-item').forEach(item => {
            const hora = item.dataset.hora;
            const agendamento = agendamentosPorHora[hora];

            if (agendamento) {
                item.setAttribute('data-agendamento-id', agendamento.id);
                const label = item.querySelector('label');

                if (agendamento.uidCliente === "admin_block" || agendamento.nomeCliente === "Bloqueado") {
                    // É um bloqueio manual do barbeiro
                    item.classList.add('bloqueado-admin');
                    if (label) label.innerHTML = `${hora}<br><small style="font-weight:bold;">BLOQUEADO</small>`;
                } else {
                    // É um agendamento real de cliente
                    item.classList.add('ocupado');
                    const primeiroNome = (agendamento.nomeCliente || "Cliente").trim().split(' ')[0];
                    if (label) label.innerHTML = `${hora}<br><small style="font-weight:bold;">${primeiroNome}</small>`;
                }

                // Clique para DESBLOQUEAR / REMOVER
                item.onclick = () => removerBloqueioOuAgendamento(agendamento.id, hora, agendamento.nomeCliente);

            } else {
                // Clique para BLOQUEAR horário livre
                item.onclick = () => bloquearHorario(hora, dataSelecionada);
            }
        });

        // 2. Preenche a LISTA TEXTUAL abaixo (FILTRA e remove os bloqueios)
        if (container) {
            // Filtra apenas os agendamentos reais de clientes
            const cortesReais = agendamentosLista.filter(item => 
                item.uidCliente !== "admin_block" && item.nomeCliente !== "Bloqueado"
            );

            if (cortesReais.length === 0) {
                container.innerHTML = `<div class="service-card" style="justify-content: center; color: #6b7280;">Nenhum corte agendado por clientes para este dia.</div>`;
            } else {
                cortesReais.sort((a, b) => a.horario.localeCompare(b.horario));
                let html = '';
                cortesReais.forEach(item => {
                    html += `
                        <div class="service-card">
                            <div class="service-info">
                                <h3><i class="fa-regular fa-clock"></i> ${item.horario} - ${item.servico}</h3>
                                <p><i class="fa-solid fa-user"></i> <strong>Cliente:</strong> ${item.nomeCliente || 'Não informado'}</p>
                                <p><i class="fa-solid fa-phone"></i> <strong>WhatsApp:</strong> ${item.telefoneCliente || 'Não informado'}</p>
                            </div>
                            <button onclick="window.confirmarRemocaoDirecta('${item.id}', '${item.horario}', '${item.nomeCliente}')" 
                                    style="background: #ef4444; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer;">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    `;
                });
                container.innerHTML = html;
            }
        }

    } catch (erro) {
        console.error("Erro ao carregar agendamentos:", erro);
        if (container) {
            container.innerHTML = `<div class="service-card" style="justify-content: center; color: #EF4444;">Erro ao buscar agendamentos.</div>`;
        }
    }
}

// 4. Ação de Bloquear um Horário Livre usando Transação
async function bloquearHorario(hora, data) {
    if (!data) {
        mostrarAviso("Selecione uma data válida primeiro!");
        return;
    }

    if (!confirm(`Deseja BLOQUEAR o horário das ${hora} para novos agendamentos?`)) return;

    // Garante um ID limpo para a transação (ex: 2026-08-10_19-30)
    const horaFormatada = hora.replace(":", "-");
    const customDocId = `${data}_${horaFormatada}`;
    const agendamentoRef = doc(db, "agendamentos", customDocId);

    try {
        await runTransaction(db, async (transaction) => {
            const agendamentoDoc = await transaction.get(agendamentoRef);

            if (agendamentoDoc.exists()) {
                const dados = agendamentoDoc.data();
                if (dados.nomeCliente === "Bloqueado") {
                    throw new Error("Este horário já está bloqueado!");
                } else {
                    throw new Error(`O cliente ${dados.nomeCliente} agendou este horário primeiro!`);
                }
            }

            // Grava o bloqueio
            transaction.set(agendamentoRef, {
                uidCliente: "admin_block",
                nomeCliente: "Bloqueado",
                telefoneCliente: "N/A",
                emailCliente: "admin@studioe.com",
                data: data,
                horario: hora,
                servico: "Bloqueio de Horário",
                criadoEm: new Date()
            });
        });

        mostrarAviso(`Horário das ${hora} bloqueado com sucesso!`, 'sucesso');
        await atualizarEstadoHorarios(data);

    } catch (erro) {
        console.error("Erro detalhado ao bloquear:", erro);
        mostrarAviso(erro.message || "Erro ao bloquear horário.");
        await atualizarEstadoHorarios(data);
    }
}

// 5. Ação de Remover Agendamento ou Desbloquear Horário
async function removerBloqueioOuAgendamento(docId, hora, nome) {
    const mensagem = nome === "Bloqueado" 
        ? `Deseja DESBLOQUEAR o horário das ${hora}?` 
        : `Deseja CANCELAR o agendamento de ${nome} às ${hora}?`;

    if (!confirm(mensagem)) return;

    try {
        await deleteDoc(doc(db, "agendamentos", docId));
        mostrarAviso("Registro removido com sucesso!", 'sucesso');
        
        const datePicker = document.getElementById('admin-date-picker');
        if (datePicker) {
            await atualizarEstadoHorarios(datePicker.value);
        }
    } catch (erro) {
        console.error("Erro detalhado ao remover:", erro);
        mostrarAviso("Erro ao remover o registro.");
    }
}

// Expõe a função global para remoção via botão da lista
window.confirmarRemocaoDirecta = (docId, hora, nome) => {
    removerBloqueioOuAgendamento(docId, hora, nome);
};

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
    renderHorariosAdmin();

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        try {
            const docRef = doc(db, "contas", user.uid);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists() || docSnap.data().tipo !== "admin") {
                alert("Acesso negado! Área restrita para barbeiros.");
                window.location.href = "agendamentos.html";
            }
        } catch (erro) {
            console.error("Erro ao verificar conta admin:", erro);
        }
    });

    const datePicker = document.getElementById('admin-date-picker');
    if (datePicker) {
        const hojeObj = new Date();
        const ano = hojeObj.getFullYear();
        const mes = String(hojeObj.getMonth() + 1).padStart(2, '0');
        const dia = String(hojeObj.getDate()).padStart(2, '0');
        const hoje = `${ano}-${mes}-${dia}`;

        datePicker.value = hoje;
        atualizarEstadoHorarios(hoje);

        datePicker.addEventListener('change', (e) => {
            atualizarEstadoHorarios(e.target.value);
        });
    }

    const btnSair = document.getElementById('btn-sair');
    if (btnSair) {
        btnSair.addEventListener('click', async () => {
            await signOut(auth);
            window.location.href = "login.html";
        });
    }
});