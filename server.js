<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Угадай код</title>
<script src="/socket.io/socket.io.js"></script>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&display=swap');

  :root {
    --bg: #0f1115; --panel: rgba(26, 30, 43, 0.85); --line: #2a3042;
    --text: #ffffff; --muted: #8b93a5;
    --green: #10b981; --green-inactive: #064e3b; --green-glow: rgba(16, 185, 129, 0.4);
    --yellow: #f59e0b; --yellow-glow: rgba(245, 158, 11, 0.4);
    --red: #ef4444; --gray: #2a3042;
    --accent: #3b82f6;
  }
  
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
  
  body {
    margin: 0; height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 8px; padding: 10px;
    background: var(--bg); color: var(--text); font-family: 'Nunito', sans-serif;
    overflow: hidden; user-select: none; transition: filter 0.5s ease;
  }

  body.blur-active > *:not(.modal):not(.settings-modal):not(.chat-modal) {
    filter: blur(8px); pointer-events: none;
  }

  .hidden { display: none !important; }

  /* Главное меню */
  .main-menu {
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    background: var(--panel); padding: 30px; border-radius: 24px; border: 1px solid var(--line);
    width: 90%; max-width: 340px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  }
  .main-menu h1 { margin: 0; font-size: 28px; font-weight: 900; color: var(--accent); }
  .profile-row { display: flex; gap: 8px; width: 100%; align-items: center; }
  .profile-row input {
    flex: 1; background: rgba(0,0,0,0.3); border: 2px solid var(--line); border-radius: 10px;
    padding: 10px; color: var(--text); font-family: inherit; font-weight: 700; font-size: 16px; outline: none;
  }
  .profile-row button {
    background: var(--line); border: none; border-radius: 10px; padding: 0 16px; color: var(--text); cursor: pointer;
  }
  .menu-btn {
    width: 100%; padding: 16px; border-radius: 12px; font-weight: 900; font-family: inherit; font-size: 16px;
    border: none; cursor: pointer; transition: all 0.2s; display: flex; justify-content: center; align-items: center; gap: 10px;
  }
  .menu-btn.primary { background: var(--green); color: #000; box-shadow: 0 4px 15px var(--green-glow); }
  .menu-btn.secondary { background: var(--line); color: var(--text); }
  .menu-btn.settings { background: transparent; color: var(--muted); font-size: 14px; }

  /* Общие панели */
  .top-bar {
    width: 100%; max-width: 380px; display: flex; justify-content: space-between; align-items: center;
    background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 8px 12px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3); margin-bottom: 4px;
  }
  .icon-btn { background: none; border: none; color: var(--muted); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; }
  .icon-btn svg { width: 20px; height: 20px; fill: currentColor; }
  .status-text { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: var(--accent); text-align: center; flex: 1; }
  
  .chat-btn {
    background: rgba(255,255,255,0.05); border: 1px solid var(--line); color: var(--text);
    border-radius: 10px; padding: 6px 10px; font-family: inherit; font-weight: 900; font-size: 12px;
    display: flex; align-items: center; gap: 6px; cursor: pointer; position: relative;
  }
  .chat-btn svg { width: 16px; height: 16px; fill: currentColor; }

  .my-code-panel {
    width: 100%; max-width: 380px; display: flex; align-items: center; gap: 12px;
    background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 10px 14px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
  }
  .my-code-header span { font-size: 12px; color: var(--muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
  .my-code-digits { display: flex; gap: 6px; margin-left: auto; }
  .my-code-digits.hidden-code { filter: blur(6px); opacity: 0.5; }
  .my-code-digit {
    width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 900; background: var(--line); border-radius: 6px; transition: all 0.3s;
  }
  .my-code-digit.green { background: var(--green); color: #000; box-shadow: 0 0 10px var(--green-glow); }
  .my-code-digit.yellow { background: var(--yellow); color: #fff; box-shadow: 0 0 10px var(--yellow-glow); }
  .my-code-digit.gray { color: var(--muted); }

  .eye-btn { background: none; border: none; color: var(--muted); cursor: pointer; padding: 0; width: 24px; height: 24px; }
  .eye-btn svg { width: 20px; height: 20px; fill: currentColor; }

  .board { display: flex; gap: 8px; width: 100%; max-width: 380px; margin-top: 4px; }
  .cell {
    flex: 1; aspect-ratio: 1 / 1; display: flex; align-items: center; justify-content: center;
    font-size: 32px; font-weight: 900; border-radius: 16px;
    background: var(--panel); border: 2px solid var(--line); cursor: pointer; transition: all 0.2s;
  }
  .cell.filled { border-color: var(--muted); transform: scale(1.05); }
  .cell.locked { background: var(--green); border-color: var(--green); color: #000; box-shadow: 0 0 15px var(--green-glow); cursor: default; }
  .cell.cursor { border-color: var(--accent); box-shadow: 0 0 15px var(--accent); opacity: 0.8; }
  .cell.fade-yellow { background: rgba(245, 158, 11, 0.15); border-color: rgba(245, 158, 11, 0.3); color: var(--yellow); }
  .cell.fade-gray { background: var(--gray); border-color: var(--line); color: transparent; opacity: 0.5; }

  .pad-container { width: 100%; max-width: 380px; margin-top: 8px; height: 186px; position: relative; }
  .pad { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; width: 100%; position: absolute; top: 0; left: 0; }
  
  .pad button {
    position: relative; padding: 16px 0; font-size: 24px; font-family: inherit; font-weight: 900;
    background: var(--panel); color: var(--text); border: 1px solid var(--line);
    border-radius: 12px; cursor: pointer; transition: transform 0.1s, background 0.1s;
  }
  .pad button:active:not(:disabled) { transform: scale(0.9); background: var(--line); }
  .pad.waiting button { pointer-events: none; opacity: 0.5; }
  .pad button:disabled { opacity: .2; cursor: not-allowed; background: var(--bg); border-color: transparent; color: var(--muted); box-shadow: none; }
  .pad button.hint-yellow { border-color: var(--yellow); color: var(--yellow); box-shadow: inset 0 0 10px rgba(245, 158, 11, 0.2); }
  .pad button.hint-yellow::after { content: attr(data-hint); position: absolute; top: 2px; right: 6px; font-size: 11px; color: var(--yellow); opacity: 0.9; }

  .btn-submit { background: rgba(16, 185, 129, 0.15) !important; border-color: var(--green) !important; color: var(--green) !important; font-size: 26px !important; }
  .btn-submit:active:not(:disabled) { background: rgba(16, 185, 129, 0.3) !important; }
  .btn-submit:disabled { background: rgba(6, 78, 59, 0.3) !important; border-color: var(--green-inactive) !important; color: rgba(16, 185, 129, 0.4) !important; }
  .btn-reset { background: rgba(239, 68, 68, 0.15) !important; border-color: var(--red) !important; color: var(--red) !important; font-size: 26px !important; }
  .btn-reset:active:not(:disabled) { background: rgba(239, 68, 68, 0.3) !important; }

  /* Модалки */
  .modal, .settings-modal, .chat-modal {
    position: fixed; inset: 0; background: rgba(9, 10, 15, 0.85); display: flex; align-items: center; justify-content: center; z-index: 400; backdrop-filter: blur(8px);
  }
  .modal.hidden, .settings-modal.hidden, .chat-modal.hidden { display: none !important; }
  .modal-content { background: var(--panel); padding: 24px; border-radius: 20px; width: 90%; max-width: 340px; display: flex; flex-direction: column; gap: 16px; border: 1px solid var(--line); }
  .modal-content h2 { margin: 0; font-size: 20px; text-align: center; font-weight: 900; }
  
  .modal-inputs { display: flex; gap: 8px; justify-content: center; }
  .modal-inputs input { width: 100%; aspect-ratio: 1/1; background: rgba(0,0,0,0.3); border: 2px solid var(--line); border-radius: 10px; color: var(--text); font-size: 24px; font-weight: 900; text-align: center; font-family: inherit; outline: none; }
  .modal-inputs input:focus { border-color: var(--accent); }

  .modal-btns { display: flex; gap: 8px; margin-top: 8px; }
  .modal-btns button { flex: 1; padding: 14px 0; border-radius: 10px; font-weight: 900; cursor: pointer; border: none; font-family: inherit; font-size: 15px; transition: all 0.1s; }
  .btn-start { background: var(--green); color: #000; }
  .btn-random { background: var(--line); color: var(--text); }
  .btn-cancel { background: transparent; border: 1px solid var(--line) !important; color: var(--muted); }

  .setting-row { display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 15px; margin-bottom: 12px; }
  .setting-row select { background: var(--bg); border: 1px solid var(--line); color: var(--text); padding: 8px 12px; border-radius: 8px; font-family: inherit; font-weight: 700; outline: none; }

  /* Уведомление о ходе */
  .sms-notification {
    position: fixed; top: 20px; left: 50%; transform: translate(-50%, -150%);
    width: 90%; max-width: 360px; background: rgba(30, 35, 48, 0.98); border: 1px solid var(--line); border-radius: 16px; padding: 16px;
    display: flex; flex-direction: column; gap: 10px; align-items: center; box-shadow: 0 10px 30px rgba(0,0,0,0.8);
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 500; pointer-events: none;
  }
  .sms-notification.show { transform: translate(-50%, 0); pointer-events: auto; }
  .sms-header { display: flex; justify-content: space-between; width: 100%; align-items: center; }
  .sms-title { font-size: 13px; color: var(--muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
  .sms-digits { display: flex; gap: 8px; margin: 4px 0; }
  .sms-digit { width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; border-radius: 10px; background: var(--line); color: var(--text); }
  .sms-digit.green { background: var(--green); color: #000; box-shadow: 0 0 10px var(--green-glow); }
  .sms-digit.yellow { background: var(--yellow); color: #fff; box-shadow: 0 0 10px var(--yellow-glow); }
  .sms-digit.gray { background: var(--bg); color: var(--muted); border: 1px solid var(--line); }

  /* Чат */
  .chat-window { height: 70vh; }
  .chat-history { flex: 1; padding: 10px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
  .chat-msg { padding: 8px 12px; border-radius: 12px; font-size: 14px; font-weight: 700; max-width: 80%; }
  .chat-msg.bot { background: var(--line); align-self: flex-start; }
  .chat-msg.me { background: var(--accent); align-self: flex-end; }
  .chat-input-area { display: flex; gap: 8px; margin-top: auto; padding-top: 10px;}
  .chat-input-area input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid var(--line); border-radius: 10px; padding: 10px; color: var(--text); font-family: inherit; outline: none; }
  .chat-input-area button { background: var(--green); border: none; border-radius: 10px; padding: 0 16px; font-weight: 900; cursor: pointer; }

  .loading-spinner { border: 4px solid var(--line); border-top: 4px solid var(--accent); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>
</head>
<body>

<!-- МЕНЮ -->
<div class="main-menu" id="main-menu">
  <h1>Угадай код</h1>
  <div class="profile-row">
    <input type="text" id="username-input" placeholder="Твой ник" maxlength="15">
    <button onclick="saveNick()">OK</button>
  </div>
  <button class="menu-btn primary" onclick="startBotGame()">🤖 Играть с Ботом</button>
  <button class="menu-btn secondary" onclick="openOnlineMenu()">🌐 Играть по сети</button>
  <button class="menu-btn settings" onclick="openSettings()">⚙️ Настройки</button>
</div>

<!-- ЭКРАН ВВОДА КОДА (ДЛЯ СЕТИ) -->
<div class="modal hidden" id="code-screen">
  <div class="modal-content">
    <h2>Загадайте код</h2>
    <p style="text-align:center; color:var(--muted); margin:0; font-size:14px;">Введите 6 цифр</p>
    <div class="modal-inputs" id="modal-inputs"></div>
    <div class="modal-btns">
      <button class="btn-random" onclick="randomizeModal()">Рандом</button>
      <button class="btn-start" onclick="findGame()">Искать</button>
      <button class="btn-cancel" onclick="closeModal('code-screen')">Отмена</button>
    </div>
  </div>
</div>

<!-- ЭКРАН ОЖИДАНИЯ -->
<div class="modal hidden" id="waiting-screen">
  <div class="modal-content" style="align-items: center;">
    <h2>Поиск соперника...</h2>
    <div class="loading-spinner"></div>
    <button class="btn-cancel" style="margin-top:20px;" onclick="location.reload()">Отмена</button>
  </div>
</div>

<!-- ИГРОВОЙ ЭКРАН -->
<div id="game-screen" class="hidden" style="display: flex; flex-direction: column; align-items: center; width: 100%;">
  
  <div class="top-bar">
    <button class="icon-btn" onclick="openSettings()">
      <svg viewBox="0 0 24 24"><path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/></svg>
    </button>
    <div class="status-text" id="status-text">ОЖИДАНИЕ...</div>
    <button class="chat-btn" onclick="openChat()">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg> Чат
    </button>
  </div>

  <div class="my-code-panel">
    <div class="my-code-header"><span>Ваш код</span></div>
    <div class="my-code-digits" id="my-code-digits"></div>
    <button class="eye-btn" id="toggle-code" onclick="toggleCode()">
      <svg id="eye-icon" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
    </button>
  </div>

  <div class="board" id="board"></div>
  <div class="pad-container" id="pad-container"><div class="pad" id="pad"></div></div>
</div>

<!-- НАСТРОЙКИ -->
<div class="settings-modal hidden" id="settings-modal">
  <div class="modal-content">
    <h2>Настройки</h2>
    <div class="setting-row">
      <span>Сложность бота</span>
      <select id="setting-difficulty" onchange="saveSettings()">
        <option value="easy">Новичок (Рандом)</option>
        <option value="hard" selected>Профи (ИИ)</option>
      </select>
    </div>
    <div class="setting-row">
      <span>Цвет интерфейса</span>
      <select id="setting-color" onchange="saveSettings()">
        <option value="#3b82f6">Синий</option>
        <option value="#10b981">Зеленый</option>
        <option value="#ec4899">Розовый</option>
        <option value="#eab308">Желтый</option>
        <option value="#8b5cf6">Фиолетовый</option>
        <option value="#f97316">Оранжевый</option>
      </select>
    </div>
    <button class="menu-btn primary" onclick="closeModal('settings-modal')">Сохранить</button>
  </div>
</div>

<!-- ЧАТ -->
<div class="chat-modal hidden" id="chat-modal">
  <div class="modal-content chat-window">
    <h2>Чат</h2>
    <div class="chat-history" id="chat-history">
      <div class="chat-msg bot">Привет! Готов сразиться?</div>
    </div>
    <div class="chat-input-area">
      <input type="text" id="chat-input" placeholder="Сообщение...">
      <button onclick="sendChat()">></button>
    </div>
    <button class="menu-btn secondary" style="margin-top:10px;" onclick="closeModal('chat-modal')">Закрыть</button>
  </div>
</div>

<!-- Всплывашка с кодом -->
<div class="sms-notification" id="sms-notification">
  <div class="sms-header">
    <div class="sms-title" id="sms-title">Ход соперника</div>
  </div>
  <div class="sms-digits" id="sms-digits"></div>
</div>

<script>
"use strict";

const socket = io();
const CODE_LEN = 6;

// Глобальное состояние
let isOnline = false;
let myUsername = localStorage.getItem("gc_username") || "";
let mySecretCode = null;
let roomId = null;
let currentTurn = null;
let opponentName = "Бот";

let locked = Array(CODE_LEN).fill(false);
let lockedDigits = Array(CODE_LEN).fill(null);
let input = Array(CODE_LEN).fill("");
let attempts = [];
let cursor = 0;
let lastMarks = Array(CODE_LEN).fill("");
let lastGuess = null;
let isCodeHidden = false;

// Бот
let botLockedDigits = Array(CODE_LEN).fill(null);
let botKnownWrong = new Set();
let botCandidates = [];
let secretBot = "";

const el = {
  mainMenu: document.getElementById("main-menu"),
  codeScreen: document.getElementById("code-screen"),
  waitingScreen: document.getElementById("waiting-screen"),
  gameScreen: document.getElementById("game-screen"),
  statusText: document.getElementById("status-text"),
  board: document.getElementById("board"),
  pad: document.getElementById("pad"),
  myCodeDigits: document.getElementById("my-code-digits"),
  smsNotif: document.getElementById("sms-notification"),
  smsDigits: document.getElementById("sms-digits"),
  smsTitle: document.getElementById("sms-title"),
  modalInputs: document.getElementById("modal-inputs"),
  usernameInput: document.getElementById("username-input")
};

const randDigit = () => Math.floor(Math.random() * 10).toString();

/* ============ МЕНЮ И НАСТРОЙКИ ============ */
function initMenu() {
  if (myUsername) el.usernameInput.value = myUsername;
  loadSettings();
}

function saveNick() {
  const val = el.usernameInput.value.trim();
  if (!/^[a-zA-Z0-9_-]{3,15}$/.test(val)) {
    alert("Ник: от 3 до 15 символов (латиница, цифры, _ -)");
    return;
  }
  myUsername = val;
  localStorage.setItem("gc_username", val);
  alert("Ник сохранен!");
}

function openSettings() {
  document.body.classList.add("blur-active");
  document.getElementById("settings-modal").classList.remove("hidden");
}

function closeModal(id) {
  document.body.classList.remove("blur-active");
  document.getElementById(id).classList.add("hidden");
}

function saveSettings() {
  const diff = document.getElementById("setting-difficulty").value;
  const color = document.getElementById("setting-color").value;
  localStorage.setItem("gc_diff", diff);
  localStorage.setItem("gc_color", color);
  document.documentElement.style.setProperty('--accent', color);
}

function loadSettings() {
  const diff = localStorage.getItem("gc_diff") || "hard";
  const color = localStorage.getItem("gc_color") || "#3b82f6";
  document.getElementById("setting-difficulty").value = diff;
  document.getElementById("setting-color").value = color;
  document.documentElement.style.setProperty('--accent', color);
}

/* ============ ЛОКАЛЬНАЯ ИГРА (С БОТОМ) ============ */
function startBotGame() {
  if (!myUsername) { alert("Сначала сохрани ник!"); return; }
  isOnline = false;
  opponentName = "Бот";
  
  secretBot = Array.from({ length: CODE_LEN }, randDigit).join("");
  mySecretCode = Array.from({ length: CODE_LEN }, randDigit).join(""); // Для бота
  
  el.mainMenu.classList.add("hidden");
  el.gameScreen.classList.remove("hidden");
  
  resetBoard();
  currentTurn = "human";
  updateTurnUI();
  renderBoard(); renderPad();
  renderMyCodeStatus(Array(CODE_LEN).fill("gray"));
}

function botTurn() {
  if (isOnline || currentTurn !== "bot") return;
  let guess = "";
  const diff = localStorage.getItem("gc_diff") || "hard";

  if (diff === "hard") {
    if (botCandidates.length === 0) {
      for (let n = 0; n < 1000000; n++) botCandidates.push(String(n).padStart(6, "0"));
    }
    guess = botCandidates[Math.floor(Math.random() * botCandidates.length)];
  } else {
    let arr = Array(CODE_LEN).fill(null);
    for (let i = 0; i < CODE_LEN; i++) if (botLockedDigits[i]) arr[i] = botLockedDigits[i];
    for (let i = 0; i < CODE_LEN; i++) {
      if (arr[i]) continue;
      let avail = "0123456789".split("").filter(d => !botKnownWrong.has(d) && !arr.includes(d));
      if (!avail.length) avail = "0123456789".split("");
      arr[i] = avail[Math.floor(Math.random() * avail.length)];
    }
    guess = arr.join("");
  }

  const marks = scoreGuess(guess, mySecretCode);
  for (let i = 0; i < CODE_LEN; i++) {
    if (marks[i] === "green") { botLockedDigits[i] = guess[i]; myCodeStatus[i] = "green"; }
    if (marks[i] === "gray") botKnownWrong.add(guess[i]);
  }

  if (diff === "hard") {
    botCandidates = botCandidates.filter(c => {
      const m = scoreGuess(guess, c);
      return m.every((v, i) => v === marks[i]);
    });
  }

  renderMyCodeStatus(myCodeStatus);
  showOpponentMove(guess, marks);

  if (marks.every(m => m === "green")) {
    setTimeout(() => { alert(`Бот угадал твой код: ${mySecretCode}`); location.reload(); }, 3000);
    return;
  }

  setTimeout(() => {
    currentTurn = "human";
    updateTurnUI();
  }, 3000);
}

/* ============ ОНЛАЙН ИГРА ============ */
function openOnlineMenu() {
  if (!myUsername) { alert("Сначала сохрани ник!"); return; }
  el.codeScreen.classList.remove("hidden");
  buildModalInputs();
}

function buildModalInputs() {
  el.modalInputs.innerHTML = "";
  for (let i = 0; i < CODE_LEN; i++) {
    const inp = document.createElement("input");
    inp.type = "text"; inp.maxLength = 1; inp.inputMode = "numeric";
    inp.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, "");
      if (e.target.value && i < CODE_LEN - 1) el.modalInputs.children[i + 1].focus();
    });
    el.modalInputs.appendChild(inp);
  }
}

function randomizeModal() {
  Array.from(el.modalInputs.children).forEach(inp => inp.value = randDigit());
}

function findGame() {
  const code = Array.from(el.modalInputs.children).map(inp => inp.value.trim()).join("");
  if (code.length !== CODE_LEN) { alert("Введи все 6 цифр!"); return; }
  
  isOnline = true;
  mySecretCode = code;
  el.codeScreen.classList.add("hidden");
  el.waitingScreen.classList.remove("hidden");
  
  socket.emit('find_game', { username: myUsername, code: mySecretCode });
}

socket.on('waiting', () => {});
socket.on('game_start', (data) => {
  roomId = data.roomId;
  currentTurn = data.turn;
  opponentName = (data.p1_name === myUsername) ? data.p2_name : data.p1_name;

  el.waitingScreen.classList.add("hidden");
  el.mainMenu.classList.add("hidden");
  el.gameScreen.classList.remove("hidden");
  
  resetBoard();
  updateTurnUI();
  renderBoard(); renderPad();
  renderMyCodeStatus(Array(CODE_LEN).fill("gray"));
});

socket.on('guess_result', (data) => {
  if (data.player === socket.id) {
    lastGuess = data.guess; lastMarks = data.marks;
    for (let i = 0; i < CODE_LEN; i++) {
      if (data.marks[i] === "green") { locked[i] = true; lockedDigits[i] = data.guess[i]; }
      else if (!locked[i]) attempts.push({ slot: i, digit: data.guess[i] });
    }
    input = Array(CODE_LEN).fill("");
    cursor = 0; moveCursorNext();
    renderBoard(); renderPad();
  } else {
    showOpponentMove(data.guess, data.marks);
  }
  currentTurn = data.nextTurn;
  updateTurnUI();
});

socket.on('game_over', (data) => {
  if (data.winner === socket.id) alert("Ты победил!");
  else alert(`Ты проиграл. ${opponentName} угадал твой код: ${data.code}`);
  setTimeout(() => location.reload(), 3000);
});

/* ============ ЯДРО ИГРЫ (ОБЩЕЕ) ============ */
function scoreGuess(guess, secret) {
  const marks = Array(CODE_LEN).fill("gray");
  const sLeft = Array(CODE_LEN).fill(true);
  const gLeft = Array(CODE_LEN).fill(true);
  for (let i = 0; i < CODE_LEN; i++) {
    if (guess[i] === secret[i]) { marks[i] = "green"; sLeft[i] = false; gLeft[i] = false; }
  }
  for (let i = 0; i < CODE_LEN; i++) {
    if (!gLeft[i]) continue;
    for (let j = 0; j < CODE_LEN; j++) {
      if (sLeft[j] && secret[j] === guess[i]) { marks[i] = "yellow"; sLeft[j] = false; break; }
    }
  }
  return marks;
}

function resetBoard() {
  locked = Array(CODE_LEN).fill(false);
  lockedDigits = Array(CODE_LEN).fill(null);
  input = Array(CODE_LEN).fill("");
  attempts = [];
  cursor = 0;
  lastMarks = Array(CODE_LEN).fill("");
  lastGuess = null;
  botLockedDigits = Array(CODE_LEN).fill(null);
  botKnownWrong.clear();
  botCandidates = [];
  myCodeStatus = Array(CODE_LEN).fill("gray");
}

function updateTurnUI() {
  if (currentTurn === "human" || currentTurn === socket.id) {
    el.statusText.textContent = "ВАШ ХОД";
    el.statusText.style.color = "var(--green)";
    el.pad.classList.remove("waiting");
  } else {
    el.statusText.textContent = `${opponentName.toUpperCase()} ДУМАЕТ...`;
    el.statusText.style.color = "var(--yellow)";
    el.pad.classList.add("waiting");
  }
}

let myCodeStatus = [];

function submitGuess() {
  if (!isOnline && currentTurn !== "human") return;
  if (isOnline && currentTurn !== socket.id) return;

  const guess = input.map((d, i) => locked[i] ? lockedDigits[i] : d).join("");
  if (guess.length !== CODE_LEN || guess.includes("")) return;

  if (isOnline) {
    socket.emit('make_guess', { roomId, guess });
  } else {
    const marks = scoreGuess(guess, secretBot);
    lastGuess = guess; lastMarks = marks;
    for (let i = 0; i < CODE_LEN; i++) {
      if (marks[i] === "green") { locked[i] = true; lockedDigits[i] = guess[i]; }
      else if (!locked[i]) attempts.push({ slot: i, digit: guess[i] });
    }
    input = Array(CODE_LEN).fill("");
    cursor = 0; moveCursorNext();
    renderBoard(); renderPad();

    if (marks.every(m => m === "green")) {
      alert("Вы угадали код!"); location.reload(); return;
    }

    currentTurn = "bot";
    updateTurnUI();
    setTimeout(botTurn, 1000);
  }
}

function putDigit(d) {
  if (!isOnline && currentTurn !== "human") return;
  if (isOnline && currentTurn !== socket.id) return;
  
  let slot = cursor;
  for (let k = 0; k < CODE_LEN; k++) {
    const s = (slot + k) % CODE_LEN;
    if (!locked[s] && !input[s]) { slot = s; break; }
  }
  if (locked[slot] || input[slot]) return;
  if (attempts.some(a => a.slot === slot && a.digit === d)) return;
  
  cursor = slot;
  input[slot] = d;
  moveCursorNext();
  renderBoard(); renderPad();
}

function clearInput() {
  if (!isOnline && currentTurn !== "human") return;
  if (isOnline && currentTurn !== socket.id) return;
  for (let i = 0; i < CODE_LEN; i++) if (!locked[i]) input[i] = "";
  cursor = 0; moveCursorNext();
  renderBoard(); renderPad();
}

function moveCursorNext() {
  for (let k = 0; k < CODE_LEN; k++) {
    const s = (cursor + k) % CODE_LEN;
    if (!locked[s] && !input[s]) { cursor = s; return; }
  }
}

function renderBoard() {
  el.board.innerHTML = "";
  for (let i = 0; i < CODE_LEN; i++) {
    const c = document.createElement("div");
    c.className = "cell";
    if (locked[i]) { c.classList.add("locked"); c.textContent = lockedDigits[i] ?? ""; }
    else if (input[i]) { c.classList.add("filled"); c.textContent = input[i]; }
    else if (lastMarks[i] === "yellow" && lastGuess) { c.classList.add("fade-yellow"); c.textContent = lastGuess[i]; }
    else if (lastMarks[i] === "gray") { c.classList.add("fade-gray"); c.textContent = "•"; }
    if (i === cursor && !locked[i]) c.classList.add("cursor");
    el.board.appendChild(c);
  }
}

function renderPad() {
  el.pad.innerHTML = "";
  const hints = {};
  if (lastMarks && lastGuess) {
    lastMarks.forEach((m, i) => { if (m === "yellow") hints[lastGuess[i]] = (hints[lastGuess[i]] || 0) + 1; });
  }

  const addBtn = (text, cls, fn, isDigit = false) => {
    const b = document.createElement("button");
    b.textContent = text;
    if (cls) b.className = cls;
    if (isDigit) {
      const isCursorEmpty = !locked[cursor] && !input[cursor];
      if (isCursorEmpty && attempts.some(a => a.slot === cursor && a.digit === text)) b.disabled = true;
      if (!b.disabled && hints[text]) { b.classList.add("hint-yellow"); b.setAttribute("data-hint", hints[text]); }
    }
    b.addEventListener("click", (e) => { e.preventDefault(); if(!b.disabled) fn(); });
    el.pad.appendChild(b);
    return b;
  };

  addBtn("1", "", () => putDigit("1"), true);
  addBtn("2", "", () => putDigit("2"), true);
  addBtn("3", "", () => putDigit("3"), true);
  const subBtn = addBtn("✓", "btn-submit", submitGuess);
  addBtn("4", "", () => putDigit("4"), true);
  addBtn("5", "", () => putDigit("5"), true);
  addBtn("6", "", () => putDigit("6"), true);
  addBtn("×", "btn-reset", clearInput);
  addBtn("7", "", () => putDigit("7"), true);
  addBtn("8", "", () => putDigit("8"), true);
  addBtn("9", "", () => putDigit("9"), true);
  addBtn("0", "", () => putDigit("0"), true);

  subBtn.disabled = !input.every((d, i) => locked[i] || d !== "");
}

function renderMyCodeStatus(marks) {
  el.myCodeDigits.innerHTML = "";
  for (let i = 0; i < CODE_LEN; i++) {
    const d = document.createElement("div");
    d.className = "my-code-digit " + (marks ? marks[i] : "gray");
    d.textContent = mySecretCode ? mySecretCode[i] : "-";
    el.myCodeDigits.appendChild(d);
  }
}

function toggleCode() {
  isCodeHidden = !isCodeHidden;
  el.myCodeDigits.classList.toggle("hidden-code", isCodeHidden);
}

function showOpponentMove(guess, marks) {
  el.smsTitle.textContent = `Ход ${opponentName}`;
  el.smsDigits.innerHTML = "";
  guess.split("").forEach((d, i) => {
    const c = document.createElement("div");
    c.className = "sms-digit " + marks[i];
    c.textContent = d;
    el.smsDigits.appendChild(c);
  });
  el.smsNotif.classList.add("show");
  setTimeout(() => el.smsNotif.classList.remove("show"), 3000);
}

el.board.addEventListener("click", (e) => {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  if (!isOnline && currentTurn !== "human") return;
  if (isOnline && currentTurn !== socket.id) return;

  const index = Array.from(el.board.children).indexOf(cell);
  if (locked[index]) return;
  if (input[index]) { input[index] = ""; cursor = index; }
  else { cursor = index; }
  renderBoard(); renderPad();
});

/* ============ ЧАТ ============ */
function openChat() {
  document.body.classList.add("blur-active");
  document.getElementById("chat-modal").classList.remove("hidden");
}
function sendChat() {
  const inp = document.getElementById("chat-input");
  if (!inp.value.trim()) return;
  const hist = document.getElementById("chat-history");
  const msg = document.createElement("div");
  msg.className = "chat-msg me";
  msg.textContent = inp.value;
  hist.appendChild(msg);
  inp.value = "";
  hist.scrollTop = hist.scrollHeight;
}

initMenu();
</script>
</body>
</html>
