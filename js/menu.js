/**
 * menu.js
 * ---------------------------------------------------------------
 * Menu "hambúrguer" (3 barrinhas) no canto superior esquerdo.
 * Ao clicar, abre um painel lateral com 3 opções:
 *
 * 1. Conta            -> visualizar perfil (nome/email/telefone) e sair (logout)
 * 2. Personalização    -> trocar telefone ou nome
 * 3. Configurações      -> alternar modo claro/escuro
 *
 * Requisitos:
 * - Firebase v9+ (modular SDK) já inicializado em outro arquivo,
 * exportando `auth` (Firebase Auth) e `db` (Firestore).
 * Ex: import { auth, db } from "./firebase-config.js";
 *
 * - Estrutura esperada no Firestore:
 * coleção "contas", documento com id = uid do usuário, campos:
 * { nome: "...", telefone: "...", email: "...", tipo: "...", criadoEm: ... }
 * ---------------------------------------------------------------
 */

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";

// Função principal: monta e inicializa todo o menu.
export function criarMenuSuperior() {
  // Evita criar o menu duas vezes na mesma página
  if (document.getElementById("side-menu")) {
    return;
  }

  // =================================================================
  // 1. ESTILOS
  // =================================================================
  const style = document.createElement("style");
  style.textContent = `
    :root {
      --menu-bg: #ffffff;
      --menu-text: #1a1a1a;
      --menu-border: #e0e0e0;
      --menu-accent: #4f46e5;
      --menu-hover: #f3f3f5;
    }

    body.dark-mode {
      --menu-bg: #1e1e1e;
      --menu-text: #f1f1f1;
      --menu-border: #3a3a3a;
      --menu-accent: #818cf8;
      --menu-hover: #2b2b2b;
      background-color: #121212;
      color: #f1f1f1;
    }

    #hamburger-btn {
      position: fixed;
      top: calc(env(safe-area-inset-top, 0px) + 12px);
      left: calc(env(safe-area-inset-left, 0px) + 12px);
      width: 44px;
      height: 44px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 5px;
      background: var(--menu-bg);
      border: 1px solid var(--menu-border);
      border-radius: 10px;
      cursor: pointer;
      z-index: 1001;
      transition: background 0.2s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
    }
    #hamburger-btn:hover { background: var(--menu-hover); }
    #hamburger-btn img {
      width: 24px;
      height: 24px;
      object-fit: contain;
      transition: transform 0.25s ease;
    }
    #hamburger-btn.open img { transform: rotate(90deg); }

    #side-menu-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.35);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease;
      z-index: 999;
    }
    #side-menu-overlay.visible {
      opacity: 1;
      pointer-events: auto;
    }

    #side-menu {
      position: fixed;
      top: 0;
      left: 0;
      height: 100%;
      width: 300px;
      max-width: 85vw;
      background: var(--menu-bg);
      color: var(--menu-text);
      border-right: 1px solid var(--menu-border);
      box-shadow: 2px 0 12px rgba(0,0,0,0.15);
      transform: translateX(-100%);
      transition: transform 0.3s ease;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      font-family: system-ui, sans-serif;
      overflow-y: auto;
      padding-top: env(safe-area-inset-top, 0px);
      padding-left: env(safe-area-inset-left, 0px);
    }
    #side-menu.open { transform: translateX(0); }

    @media (max-width: 480px) {
      #side-menu {
        width: 88vw;
        max-width: 88vw;
      }
    }

    #side-menu .menu-header {
      padding: 24px 20px 12px;
      font-size: 18px;
      font-weight: 700;
      border-bottom: 1px solid var(--menu-border);
    }

    .menu-item {
      padding: 14px 20px;
      cursor: pointer;
      font-size: 15px;
      border-bottom: 1px solid var(--menu-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
    }
    .menu-item:hover { background: var(--menu-hover); }
    .menu-item .arrow { opacity: 0.5; font-size: 13px; }
    .menu-item span:first-child {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .menu-item-icon {
      width: 18px;
      height: 18px;
      object-fit: contain;
    }

    .menu-panel {
      display: none;
      padding: 16px 20px 24px;
      flex-direction: column;
      gap: 12px;
      animation: fadeIn 0.2s ease;
    }
    .menu-panel.active { display: flex; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .menu-panel label {
      font-size: 12px;
      font-weight: 600;
      opacity: 0.7;
      margin-bottom: 2px;
    }
    .menu-panel input {
      padding: 9px 10px;
      border-radius: 6px;
      border: 1px solid var(--menu-border);
      background: transparent;
      color: var(--menu-text);
      font-size: 14px;
    }
    .menu-panel button {
      margin-top: 6px;
      padding: 10px;
      border: none;
      border-radius: 6px;
      background: var(--menu-accent);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
    }
    .menu-panel button.secondary {
      background: transparent;
      color: var(--menu-text);
      border: 1px solid var(--menu-border);
    }
    .menu-panel button:hover { opacity: 0.9; }

    .back-btn {
      padding: 14px 20px;
      font-size: 13px;
      cursor: pointer;
      opacity: 0.7;
      border-bottom: 1px solid var(--menu-border);
    }
    .back-btn:hover { opacity: 1; }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .switch {
      position: relative;
      width: 44px;
      height: 24px;
    }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute;
      cursor: pointer;
      inset: 0;
      background: var(--menu-border);
      border-radius: 24px;
      transition: 0.2s;
    }
    .slider::before {
      content: "";
      position: absolute;
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.2s;
    }
    .switch input:checked + .slider { background: var(--menu-accent); }
    .switch input:checked + .slider::before { transform: translateX(20px); }

    .feedback-msg {
      font-size: 12px;
      margin-top: 2px;
    }
    .feedback-msg.error { color: #ef4444; }
    .feedback-msg.success { color: #22c55e; }

    .profile-info p { margin: 4px 0; font-size: 14px; }
    .profile-info strong { opacity: 0.8; }
  `;
  document.head.appendChild(style);

  // =================================================================
  // 2. ESTRUTURA HTML DO MENU
  // =================================================================
  const hamburgerBtn = document.createElement("button");
  hamburgerBtn.id = "hamburger-btn";
  hamburgerBtn.setAttribute("aria-label", "Abrir menu");
  hamburgerBtn.innerHTML = '<img src="img/menu.png" alt="Menu" />';

  const overlay = document.createElement("div");
  overlay.id = "side-menu-overlay";

  const sideMenu = document.createElement("div");
  sideMenu.id = "side-menu";
  sideMenu.innerHTML = `
    <div class="menu-header">Menu</div>

    <div id="menu-root">
      <div class="menu-item" data-panel="conta">
        <span><img class="menu-item-icon" src="img/conta.png" alt="" /> Conta</span><span class="arrow">›</span>
      </div>
      <div class="menu-item" data-panel="personalizacao">
        <span><img class="menu-item-icon" src="img/perfil.png" alt="" /> Personalização de perfil</span><span class="arrow">›</span>
      </div>
      <div class="menu-item" data-panel="config">
        <span><img class="menu-item-icon" src="img/config.png" alt="" /> Configurações</span><span class="arrow">›</span>
      </div>
    </div>

    <div class="menu-panel" data-panel-content="conta">
      <div class="back-btn" data-back>‹ Voltar</div>
      <div class="profile-info" style="padding: 0 20px;">
        <p><strong>Nome:</strong> <span id="conta-nome">-</span></p>
        <p><strong>Email:</strong> <span id="conta-email">-</span></p>
        <p><strong>Telefone:</strong> <span id="conta-telefone">-</span></p>
      </div>
      <div style="padding: 0 20px;">
        <button id="logout-btn">Sair da conta</button>
      </div>
    </div>

    <div class="menu-panel" data-panel-content="personalizacao">
      <div class="back-btn" data-back>‹ Voltar</div>
      <div style="padding: 0 20px; display:flex; flex-direction:column; gap:12px;">
        <div>
          <label>Nome</label>
          <input id="input-nome" type="text" placeholder="Seu nome" />
        </div>
        <div>
          <label>Telefone</label>
          <input id="input-telefone" type="tel" placeholder="(00) 00000-0000" />
        </div>
        <button id="salvar-perfil-btn">Salvar alterações</button>
        <div id="perfil-feedback" class="feedback-msg"></div>
      </div>
    </div>

    <div class="menu-panel" data-panel-content="config">
      <div class="back-btn" data-back>‹ Voltar</div>
      <div style="padding: 0 20px;">
        <div class="toggle-row">
          <span>🌙 Modo escuro</span>
          <label class="switch">
            <input type="checkbox" id="dark-mode-toggle" />
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(hamburgerBtn);
  document.body.appendChild(overlay);
  document.body.appendChild(sideMenu);

  // =================================================================
  // 3. ABRIR / FECHAR MENU
  // =================================================================
  function openMenu() {
    sideMenu.classList.add("open");
    overlay.classList.add("visible");
    hamburgerBtn.classList.add("open");
  }
  function closeMenu() {
    sideMenu.classList.remove("open");
    overlay.classList.remove("visible");
    hamburgerBtn.classList.remove("open");
    showPanel(null);
  }
  hamburgerBtn.addEventListener("click", () => {
    sideMenu.classList.contains("open") ? closeMenu() : openMenu();
  });
  overlay.addEventListener("click", closeMenu);

  // =================================================================
  // 4. NAVEGAÇÃO ENTRE PAINÉIS
  // =================================================================
  const menuRoot = sideMenu.querySelector("#menu-root");
  const panels = sideMenu.querySelectorAll(".menu-panel");

  function showPanel(name) {
    if (!name) {
      menuRoot.style.display = "block";
      panels.forEach((p) => p.classList.remove("active"));
      return;
    }
    menuRoot.style.display = "none";
    panels.forEach((p) => {
      p.classList.toggle("active", p.dataset.panelContent === name);
    });
  }

  sideMenu.querySelectorAll("[data-panel]").forEach((item) => {
    item.addEventListener("click", () => {
      const panelName = item.dataset.panel;
      showPanel(panelName);
      if (panelName === "conta") preencherDadosConta();
      if (panelName === "personalizacao") preencherFormPersonalizacao();
    });
  });

  sideMenu.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => showPanel(null));
  });

  // =================================================================
  // 5. FIREBASE - DADOS DO USUÁRIO
  // =================================================================
  let usuarioAtual = null;
  let dadosFirestore = { nome: "", telefone: "", email: "", tipo: "" };

  onAuthStateChanged(auth, async (user) => {
    usuarioAtual = user;
    if (user) {
      const ref = doc(db, "contas", user.uid);
      const snap = await getDoc(ref);
      dadosFirestore = snap.exists()
        ? snap.data()
        : { nome: "", telefone: "", email: "", tipo: "" };
    }
  });

  function preencherDadosConta() {
    if (!usuarioAtual) return;
    document.getElementById("conta-nome").textContent =
      dadosFirestore.nome || usuarioAtual.displayName || "Não informado";
    document.getElementById("conta-email").textContent =
      dadosFirestore.email || usuarioAtual.email || "Não informado";
    document.getElementById("conta-telefone").textContent =
      dadosFirestore.telefone || "Não informado";
  }

  function preencherFormPersonalizacao() {
    if (!usuarioAtual) return;
    document.getElementById("input-nome").value =
      dadosFirestore.nome || usuarioAtual.displayName || "";
    document.getElementById("input-telefone").value = dadosFirestore.telefone || "";
    document.getElementById("perfil-feedback").textContent = "";
  }

  // ------------------ Logout ------------------
  document.getElementById("logout-btn").addEventListener("click", async () => {
    try {
      await signOut(auth);
      closeMenu();
    } catch (err) {
      console.error("Erro ao sair:", err);
      alert("Não foi possível sair da conta. Tente novamente.");
    }
  });

  // ------------------ Salvar personalização ------------------
  document.getElementById("salvar-perfil-btn").addEventListener("click", async () => {
    const feedback = document.getElementById("perfil-feedback");
    feedback.textContent = "";
    feedback.className = "feedback-msg";

    if (!usuarioAtual) {
      feedback.textContent = "Usuário não autenticado.";
      feedback.classList.add("error");
      return;
    }

    const novoNome = document.getElementById("input-nome").value.trim();
    const novoTelefone = document.getElementById("input-telefone").value.trim();

    try {
      // 1) Atualiza Nome no Auth (displayName)
      if (novoNome && novoNome !== usuarioAtual.displayName) {
        console.log("[menu.js] Atualizando displayName no Auth:", novoNome);
        await updateProfile(usuarioAtual, { displayName: novoNome });
      }

      // 2) Grava Nome e Telefone no Firestore (mantendo o e-mail intacto)
      const dadosParaSalvar = {
        nome: novoNome,
        telefone: novoTelefone,
      };

      console.log(
        "[menu.js] Gravando no Firestore -> contas/" + usuarioAtual.uid,
        dadosParaSalvar
      );
      await setDoc(doc(db, "contas", usuarioAtual.uid), dadosParaSalvar, {
        merge: true,
      });

      dadosFirestore = { ...dadosFirestore, ...dadosParaSalvar };

      feedback.textContent = "Alterações salvas com sucesso!";
      feedback.classList.add("success");

    } catch (err) {
      console.error("[menu.js] Erro ao salvar perfil:", err.code, err.message, err);
      let msg = err.message || "Erro ao salvar. Tente novamente.";
      if (err.code === "permission-denied") {
        msg = "Sem permissão para gravar no banco (verifique as regras do Firestore).";
      }
      feedback.textContent = msg;
      feedback.classList.add("error");
    }
  });

  // =================================================================
  // 6. CONFIGURAÇÕES - MODO CLARO / ESCURO
  // =================================================================
  const darkToggle = document.getElementById("dark-mode-toggle");

  function aplicarTema(tema) {
    document.body.classList.toggle("dark-mode", tema === "dark");
    darkToggle.checked = tema === "dark";
    localStorage.setItem("tema-preferido", tema);
  }

  const temaSalvo = localStorage.getItem("tema-preferido");
  if (temaSalvo) {
    aplicarTema(temaSalvo);
  } else {
    const prefereEscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
    aplicarTema(prefereEscuro ? "dark" : "light");
  }

  darkToggle.addEventListener("change", () => {
    aplicarTema(darkToggle.checked ? "dark" : "light");
  });

}

// Auto-inicialização
criarMenuSuperior();