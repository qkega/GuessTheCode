const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'users.json');
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '{}');

function getUsers() { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function saveUsers(users) { fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2)); }

let waitingPlayer = null;
const games = {};

function scoreGuess(guess, secret) {
  const len = 6;
  const marks = Array(len).fill("gray");
  const secretLeft = Array(len).fill(true);
  const guessLeft = Array(len).fill(true);

  for (let i = 0; i < len; i++) {
    if (guess[i] === secret[i]) { marks[i] = "green"; secretLeft[i] = false; guessLeft[i] = false; }
  }
  for (let i = 0; i < len; i++) {
    if (!guessLeft[i]) continue;
    for (let j = 0; j < len; j++) {
      if (secretLeft[j] && secret[j] === guess[i]) { marks[i] = "yellow"; secretLeft[j] = false; break; }
    }
  }
  return marks;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('auth', (data, callback) => {
    const { username, password, isRegister } = data;
    const users = getUsers();

    if (isRegister) {
      if (users[username]) {
        callback({ success: false, msg: "Этот ник уже занят" });
      } else {
        users[username] = password;
        saveUsers(users);
        callback({ success: true });
      }
    } else {
      if (users[username]) {
        if (users[username] === password) callback({ success: true });
        else callback({ success: false, msg: "Неверный пароль" });
      } else {
        callback({ success: false, msg: "Пользователь не найден" });
      }
    }
  });

  socket.on('find_game', (data) => {
    socket.username = data.username;
    socket.secretCode = data.code;

    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      const roomId = `room_${waitingPlayer.id}_${socket.id}`;
      socket.join(roomId);
      waitingPlayer.join(roomId);

      const p1 = waitingPlayer;
      const p2 = socket;

      games[roomId] = {
        p1: { id: p1.id, username: p1.username, code: p1.secretCode },
        p2: { id: p2.id, username: p2.username, code: p2.secretCode },
        turn: p1.id
      };

      io.to(roomId).emit('game_start', {
        roomId: roomId,
        p1_name: p1.username,
        p2_name: p2.username,
        turn: p1.id
      });

      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
      socket.emit('waiting');
    }
  });

  socket.on('make_guess', (data) => {
    const { roomId, guess } = data;
    const game = games[roomId];
    if (!game || game.turn !== socket.id) return;

    const isP1 = socket.id === game.p1.id;
    const opponent = isP1 ? game.p2 : game.p1;
    const me = isP1 ? game.p1 : game.p2;

    const marks = scoreGuess(guess, opponent.code);
    const isWin = marks.every(m => m === "green");
    game.turn = opponent.id;

    io.to(roomId).emit('guess_result', {
      guess,
      marks,
      isWin,
      nextTurn: opponent.id,
      player: socket.id
    });

    if (isWin) {
      io.to(roomId).emit('game_over', { winner: socket.id, code: opponent.code });
      delete games[roomId];
    }
  });

  socket.on('disconnect', () => {
    if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});