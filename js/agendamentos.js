import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, getDoc, deleteDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

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
const analytics = getAnalytics(app);
const db = getFirestore(app);
const auth = getAuth(app);

const horariosPorPeriodo = {
    "Manhã": ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30"],
    "Tarde": ["13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00"],
    "Noite": ["18:30", "19:00", "19:30", "20:00"]
};

let precoServico = 45;
let agendamentoParaCancelarID = null;
let meusAgendamentosDoDia = 0;
let isUserAdmin = false;

const diasSemanaExtenso = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 
    'Quinta-feira', 'Sexta-feira', 'Sábado'
];

function renderHorarios() {
    const container = document.getElementById("time-grid-container");
    if (!container) return;

    container.innerHTML = "";
    let id = 0;

    for (const periodo in horariosPorPeriodo) {
        container.innerHTML += `
            <div class="period-header">
                <i class="fa-regular fa-clock"></i> ${periodo}
            </div>
            <div class="time-grid">
                ${horariosPorPeriodo[periodo].map((hora, index) => {
                    const idAtual = id + index;
                    return `
                    <div class="time-item" data-hora="${hora}">
                        <input type="checkbox"
                            id="time-${idAtual}"
                            value="${hora}"
                            autocomplete="off"
                            class="time-checkbox">

                        <label for="time-${idAtual}">
                            ${hora}
                        </label>
                    </div>
                `;
                }).join("")}
            </div>
        `;
        id += horariosPorPeriodo[periodo].length;
    }

    document.querySelectorAll(".time-checkbox").forEach(cb => {
        cb.checked = false; 
        cb.addEventListener("change", escutarSelecaoHorario);
    });
}

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

function escutarSelecaoHorario(e) {
    const cb = e.target;
    
    // Se for para cancelar ou desbloquear um horário já gravado
    if (cb.dataset.agendamentoId) {
        e.preventDefault();
        cb.checked = false;
        
        agendamentoParaCancelarID = cb.dataset.agendamentoId;
        const horarioTexto = cb.value;

        const modalText = document.getElementById('cancel-modal-text');
        if (modalText) {
            modalText.textContent = isUserAdmin 
                ? `Deseja remover o agendamento/bloqueio das ${horarioTexto}?` 
                : `Deseja cancelar o agendamento da ${horarioTexto}?`;
        }
        
        const cancelModal = document.getElementById('cancel-modal');
        if (cancelModal) cancelModal.classList.add('active');
        return;
    }

    const selecionados = document.querySelectorAll('.time-checkbox:not([data-agendamento-id]):checked');
    
    // Clientes normais têm limite de 3 horários por dia (Admin não tem limite)
    if (!isUserAdmin && (selecionados.length + meusAgendamentosDoDia > 3)) {
        cb.checked = false;
        mostrarAviso("Você só pode marcar no máximo 3 horários por dia!");
    }
    atualizarTotal();
}

function atualizarTotal() {
    const totalDisplay = document.getElementById('total-display');
    if (!totalDisplay) return;
    const qtdHorarios = document.querySelectorAll('.time-checkbox:not([data-agendamento-id]):checked').length;
    const multiplicador = qtdHorarios > 0 ? qtdHorarios : 1;
    const total = precoServico * multiplicador;
    totalDisplay.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

async function atualizarHorariosOcupados(dataSelecionada) {
    const user = auth.currentUser;
    meusAgendamentosDoDia = 0;

    let isHoje = false;
    let horaMinimaMinutos = -1;

    if (dataSelecionada) {
        const partesData = dataSelecionada.split('-');
        const dataObj = new Date(Number(partesData[0]), Number(partesData[1]) - 1, Number(partesData[2]));
        const hoje = new Date();
        
        isHoje = (
            dataObj.getDate() === hoje.getDate() &&
            dataObj.getMonth() === hoje.getMonth() &&
            dataObj.getFullYear() === hoje.getFullYear()
        );

        if (isHoje) {
            // Regra dos 30 minutos de antecedência
            horaMinimaMinutos = (hoje.getHours() * 60) + hoje.getMinutes() + 30;
        }
    }

    document.querySelectorAll('.time-checkbox').forEach(cb => {
        cb.disabled = false;
        cb.checked = false;
        cb.removeAttribute('data-agendamento-id');
        
        const parent = cb.closest('.time-item');
        if (parent) {
            parent.classList.remove('ocupado', 'meu-horario');
            const label = parent.querySelector('label');
            if (label) {
                if (label.dataset.horaOriginal) {
                    label.textContent = label.dataset.horaOriginal;
                } else {
                    label.dataset.horaOriginal = label.textContent;
                }
            }
        }

        // Se for hoje, bloqueia horários antes de [Agora + 30 min] para clientes normais
        if (isHoje && !isUserAdmin) {
            const [h, m] = cb.value.split(':').map(Number);
            const minutosGrid = (h * 60) + m;
            
            if (minutosGrid < horaMinimaMinutos) {
                cb.disabled = true;
                if (parent) {
                    parent.classList.add('ocupado');
                    const label = parent.querySelector('label');
                    if (label) {
                        label.innerHTML = `${label.dataset.horaOriginal}<br><small>Indisponível</small>`;
                    }
                }
            }
        }
    });
    
    atualizarTotal();

    if (!dataSelecionada) return;

    const partesData = dataSelecionada.split('-');
    const dataObj = new Date(Number(partesData[0]), Number(partesData[1]) - 1, Number(partesData[2]));
    const dia = dataObj.getDay();
    const nomeDia = diasSemanaExtenso[dia];
    const badge = document.getElementById('weekday-info');
    const texto = document.getElementById('weekday-text');

    // Domingo (0) ou Segunda (1) - Barbearia Fechada
    if (dia === 0 || dia === 1) {
        document.querySelectorAll(".time-checkbox").forEach(cb => {
            cb.disabled = true;
            cb.checked = false;
            cb.removeAttribute("data-agendamento-id");

            const item = cb.closest(".time-item");
            const label = item?.querySelector("label");

            if (item) {
                item.classList.add("ocupado");
                item.classList.remove("meu-horario");
            }

            if (label) {
                if (!label.dataset.horaOriginal) {
                    label.dataset.horaOriginal = label.textContent;
                }
                label.innerHTML = `${label.dataset.horaOriginal}<br><small>Indisponível</small>`;
            }
        });

        badge?.classList.add("closed");
        if (texto) texto.textContent = `${nomeDia} - Barbearia Fechada`;

        atualizarTotal();
        return;
    } else {
        if (badge && texto) {
            badge.classList.remove('closed');
            texto.textContent = `${nomeDia} (Aberto)`;
        }
    }

    try {
        const qAgendamentos = query(collection(db, "agendamentos"), where("data", "==", dataSelecionada));
        const snapshotAgendamentos = await getDocs(qAgendamentos);

        snapshotAgendamentos.forEach((docSnap) => {
            const dados = docSnap.data();
            const horaDoc = dados.horario;
            const uidDono = dados.uidCliente;
            const nomeCompleto = dados.nomeCliente || "Cliente";

            let nomeFormatado = "Bloqueado";

            if (uidDono !== "admin_block" && nomeCompleto !== "Bloqueado") {
                const partesNome = nomeCompleto.trim().split(" ");
                nomeFormatado = partesNome[0];
                if (partesNome.length > 1) {
                    nomeFormatado += ` ${partesNome[1][0]}.`;
                }
            }

            const cb = Array.from(document.querySelectorAll('.time-checkbox')).find(item => item.value === horaDoc);
            
            if (cb) {
                const parent = cb.closest('.time-item');
                const label = parent ? parent.querySelector('label') : null;
                
                if (label && !label.dataset.horaOriginal) {
                    label.dataset.horaOriginal = label.textContent;
                }

                const ehMeu = (user && uidDono === user.uid) || isUserAdmin;

                if (ehMeu) {
                    if (!isUserAdmin || uidDono === user.uid) meusAgendamentosDoDia++;
                    
                    cb.disabled = false;
                    cb.dataset.agendamentoId = docSnap.id;
                    if (parent) {
                        parent.classList.remove('ocupado');
                        parent.classList.add('meu-horario');
                    }
                    
                    if (label) {
                        if (isUserAdmin && uidDono !== "admin_block") {
                            label.innerHTML = `${label.dataset.horaOriginal}<br><small>${nomeFormatado} (X)</small>`;
                        } else if (isUserAdmin && uidDono === "admin_block") {
                            label.innerHTML = `${label.dataset.horaOriginal}<br><small>Desbloquear</small>`;
                        } else {
                            label.innerHTML = `${label.dataset.horaOriginal}<br><small>Meu (${nomeFormatado})</small>`;
                        }
                    }
                } else {
                    cb.disabled = true;
                    cb.checked = false;
                    cb.removeAttribute('data-agendamento-id');
                    if (parent) parent.classList.add('ocupado');
                    if (label) label.innerHTML = `${label.dataset.horaOriginal}<br><small>${nomeFormatado}</small>`;
                }
            }
        });

    } catch (erro) {
        console.error("Erro ao buscar horários ocupados:", erro);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    renderHorarios();

    const servicoInicial = document.querySelector('input[name="service"]:checked');
    if (servicoInicial) {
        precoServico = parseFloat(servicoInicial.value);
        atualizarTotal();
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        // VERIFICA SE A CONTA É ADMIN (procurando o campo 'tipo' igual a 'admin')
        try {
            const contaRef = doc(db, "contas", user.uid);
            const contaSnap = await getDoc(contaRef);
            if (contaSnap.exists()) {
                const dadosConta = contaSnap.data();
                isUserAdmin = (dadosConta.tipo === "admin");
            }
        } catch(e) {
            console.error("Erro ao verificar conta admin:", e);
        }

        const datePicker = document.getElementById('date-picker');
        if (datePicker && !datePicker.value) {
            const hojeObj = new Date();
            const minDate = hojeObj.toISOString().split('T')[0];

            const maxDateObj = new Date();
            maxDateObj.setMonth(maxDateObj.getMonth() + 1);
            let maxDate = maxDateObj.toISOString().split('T')[0];

            datePicker.setAttribute('min', minDate);
            datePicker.setAttribute('max', maxDate);
            datePicker.value = minDate;

            atualizarHorariosOcupados(datePicker.value);
        }
    });

    const serviceRadios = document.querySelectorAll('input[name="service"]');
    serviceRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            precoServico = parseFloat(e.target.value);
            atualizarTotal();
        });
    });

    const datePicker = document.getElementById('date-picker');
    if (datePicker) {
        datePicker.addEventListener('change', () => {
            atualizarHorariosOcupados(datePicker.value);
        });
    }

    const btnConcluir = document.getElementById('btn-concluir');
    if (btnConcluir) {
        btnConcluir.addEventListener('click', async () => {
            const datePicker = document.getElementById('date-picker');
            const dataSelecionada = datePicker ? datePicker.value : "";
            const horariosSelecionados = Array.from(
                document.querySelectorAll('.time-checkbox:checked')
            ).filter(cb => !cb.dataset.agendamentoId).map(cb => cb.value);

            const servicoObj = document.querySelector('input[name="service"]:checked');

            if (!servicoObj || horariosSelecionados.length === 0) {
                mostrarAviso("Selecione um serviço e pelo menos um horário.");
                return;
            }
            
            // Valida regra de 30 minutos no envio (somente clientes)
            if (dataSelecionada && !isUserAdmin) {
                const partesData = dataSelecionada.split('-');
                const dataObj = new Date(Number(partesData[0]), Number(partesData[1]) - 1, Number(partesData[2]));
                const hoje = new Date();
                
                const isHoje = (
                    dataObj.getDate() === hoje.getDate() &&
                    dataObj.getMonth() === hoje.getMonth() &&
                    dataObj.getFullYear() === hoje.getFullYear()
                );

                if (isHoje) {
                    const minTimeSubmit = (hoje.getHours() * 60) + hoje.getMinutes() + 30;
                    const tempoPassado = horariosSelecionados.some(hora => {
                        const [h, m] = hora.split(':').map(Number);
                        return (h * 60 + m) < minTimeSubmit;
                    });
                    if (tempoPassado) {
                        mostrarAviso("Um dos horários selecionados expirou. Tente novamente.");
                        fecharModal();
                        atualizarHorariosOcupados(dataSelecionada);
                        return;
                    }
                }
            }

            const nomeServico = servicoObj.dataset.name;
            const user = auth.currentUser;

            if (!user) {
                mostrarAviso("Você precisa estar logado!");
                window.location.href = "login.html";
                return;
            }

            try {
                const qVerificacao = query(collection(db, "agendamentos"), where("data", "==", dataSelecionada));
                const snapshotVerificacao = await getDocs(qVerificacao);
                const horariosOcupadosAgora = snapshotVerificacao.docs.map(doc => doc.data().horario);

                const conflito = horariosSelecionados.some(h => horariosOcupadosAgora.includes(h));
                if (conflito) {
                    fecharModal();
                    mostrarAviso("Alguém acabou de ocupar um desses horários. Tente novamente.");
                    atualizarHorariosOcupados(dataSelecionada);
                    return;
                }

                const contaRef = doc(db, "contas", user.uid);
                const contaSnap = await getDoc(contaRef);

                let nomeCliente = "Cliente";
                let telefoneCliente = "Não informado";
                let emailCliente = user.email || "Não informado";

                if (contaSnap.exists()) {
                    const dados = contaSnap.data();
                    nomeCliente = dados.nome || "Cliente";
                    telefoneCliente = dados.telefone || "Não informado";
                    emailCliente = dados.email || user.email || "Não informado";
                }

                // DADOS PARA GRAVAÇÃO (BLOQUEIO SE FOR ADMIN / AGENDAMENTO SE FOR CLIENTE)
                const finalUidCliente = isUserAdmin ? "admin_block" : user.uid;
                const finalNomeCliente = isUserAdmin ? "Bloqueado" : nomeCliente;
                const finalTelefone = isUserAdmin ? "" : telefoneCliente;
                const finalEmail = isUserAdmin ? "" : emailCliente;
                const finalServico = isUserAdmin ? "Bloqueio de Horário" : nomeServico;

                for (const horario of horariosSelecionados) {
                    await addDoc(collection(db, "agendamentos"), {
                        uidCliente: finalUidCliente,
                        nomeCliente: finalNomeCliente,
                        telefoneCliente: finalTelefone,
                        emailCliente: finalEmail,
                        data: dataSelecionada,
                        horario: horario,
                        servico: finalServico,
                        criadoEm: new Date()
                    });
                }

                fecharModal();
                mostrarAviso(isUserAdmin ? "Horários bloqueados com sucesso!" : "Agendamento realizado com sucesso!", "sucesso");
                atualizarHorariosOcupados(dataSelecionada);

            } catch (erro) {
                console.error("Erro ao salvar no Firebase:", erro);
                mostrarAviso("Erro ao salvar o agendamento.");
            }
        });
    }

    const btnSimCancelar = document.getElementById('btn-sim-cancelar');
    const btnNaoCancelar = document.getElementById('btn-nao-cancelar');
    const cancelModal = document.getElementById('cancel-modal');

    if (btnNaoCancelar) {
        btnNaoCancelar.addEventListener('click', () => {
            if (cancelModal) cancelModal.classList.remove('active');
            agendamentoParaCancelarID = null;
        });
    }

    if (btnSimCancelar) {
        btnSimCancelar.addEventListener('click', async () => {
            if (!agendamentoParaCancelarID) return;

            try {
                await deleteDoc(doc(db, "agendamentos", agendamentoParaCancelarID));
                
                if (cancelModal) cancelModal.classList.remove('active');
                mostrarAviso("Agendamento/Bloqueio removido!", "sucesso");
                
                const datePicker = document.getElementById('date-picker');
                if (datePicker) {
                    atualizarHorariosOcupados(datePicker.value);
                }
            } catch (erro) {
                console.error("Erro ao cancelar agendamento:", erro);
                mostrarAviso("Erro ao tentar cancelar o agendamento.");
            } finally {
                agendamentoParaCancelarID = null;
            }
        });
    }
});

window.confirmarAgendamento = function() {
    const datePicker = document.getElementById('date-picker');
    if (!datePicker) return;
    
    const dataSelecionada = datePicker.value;
    const partesData = dataSelecionada.split('-');
    const dataObj = new Date(Number(partesData[0]), Number(partesData[1]) - 1, Number(partesData[2]));
    const diaSemana = dataObj.getDay();

    if (diaSemana === 0 || diaSemana === 1) {
        mostrarAviso("A barbearia está fechada neste dia.");
        return;
    }

    const horariosSelecionados = Array.from(
        document.querySelectorAll('.time-checkbox:checked')
    ).filter(cb => !cb.dataset.agendamentoId).map(cb => cb.value);

    // Ignora a limitação de 3 horários se for admin
    if (!isUserAdmin && (horariosSelecionados.length + meusAgendamentosDoDia > 3)) {
        mostrarAviso("Você só pode marcar no máximo 3 horários por dia!");
        return;
    }

    const servicoObj = document.querySelector('input[name="service"]:checked');

    if (!servicoObj) {
        mostrarAviso("Selecione um serviço.");
        return;
    }

    const nomeServico = servicoObj.dataset.name;

    if (horariosSelecionados.length === 0) {
        mostrarAviso("Selecione pelo menos um horário.");
        return;
    }

    const dataFormatadaBR = `${partesData[2]}/${partesData[1]}/${partesData[0]}`;
    const totalDisplay = document.getElementById('total-display');

    document.getElementById('modal-service').textContent = isUserAdmin ? "Bloqueio de Horários" : nomeServico;
    document.getElementById('modal-date').textContent = `${dataFormatadaBR} (${diasSemanaExtenso[diaSemana]})`;
    document.getElementById('modal-times').textContent = horariosSelecionados.join(', ');
    document.getElementById('modal-total').textContent = isUserAdmin ? "R$ 0,00" : (totalDisplay ? totalDisplay.textContent : 'R$ 0,00');

    const confirmationModal = document.getElementById('confirmation-modal');
    if (confirmationModal) {
        confirmationModal.classList.add('active');
    }
};

window.fecharModal = function() {
    const confirmationModal = document.getElementById('confirmation-modal');
    if (confirmationModal) {
        confirmationModal.classList.remove('active');
    }
};