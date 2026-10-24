const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- БЕЗОПАСНАЯ ОТПРАВКА В TELEGRAM ---
app.post('/api/feedback', async (req, res) => {
  const { nick, text } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const time = new Date().toLocaleString('ru-RU');
  
  const message = `[${nick || 'Аноним'}], [${time}], [${ip}]\nТекст: ${text}`;
  const token = process.env.TG_TOKEN || '8892435569:AAHXI7glTlWde8tc2GY2BAAO96LzaIjbhBo';
  const chatId = process.env.TG_CHAT_ID || '8052527190';
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
    if (response.ok) res.json({ success: true });
    else res.status(500).json({ success: false });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

// --- ИГРОВАЯ ЛОГИКА ---
let waitingPlayer = null;
const privateRooms = {}; 
const activeGames = {};  

function scoreGuess(guess, secret) {
  const len = 6;
  const marks = Array(len).fill("gray");
  const secretLeft = Array(len).fill(true);
  const guessLeft = Array(len).fill(true);

  for (let i = 0; i < len; i++) {
    if (guess[i] === secret[i]) { marks[i] = "green"; secretLeft[i] = false; guessLeft[i] = false; }
  }
  return marks; // Убрали желтые подсказки, только green и gray
}

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

io.on('connection', (socket) => {
  socket.on('find_random', (data) => {
    socket.username = data.username;
    socket.secretCode = data.code;

    if (waitingPlayer && waitingPlayer.id !== socket.id) {
      const roomId = `random_${waitingPlayer.id}_${socket.id}`;
      socket.join(roomId);
      waitingPlayer.join(roomId);

      const p1 = waitingPlayer;
      const p2 = socket;

      activeGames[roomId] = {
        p1: { id: p1.id, username: p1.username, code: p1.secretCode, wantsRematch: false },
        p2: { id: p2.id, username: p2.username, code: p2.secretCode, wantsRematch: false },
        turn: p1.id
      };

      io.to(roomId).emit('game_start', {
        roomId: roomId, p1_name: p1.username, p2_name: p2.username, turn: p1.id
      });
      waitingPlayer = null;
    } else {
      waitingPlayer = socket;
      socket.emit('waiting_random');
    }
  });

  socket.on('create_room', (data) => {
    let code = generateRoomCode();
    while (privateRooms[code]) code = generateRoomCode();
    
    privateRooms[code] = {
      hostId: socket.id,
      hostName: data.username,
      hostCode: data.code
    };
    socket.join(`private_${code}`);
    socket.emit('room_created', { roomCode: code });
  });

  socket.on('join_room', (data) => {
    const code = data.roomCode.toUpperCase();
    const room = privateRooms[code];

    if (!room) { socket.emit('err_msg', "Комната не найдена."); return; }
    if (room.hostId === socket.id) { socket.emit('err_msg', "Вы не можете войти в свою же комнату."); return; }

    const roomId = `private_${code}`;
    socket.join(roomId);
    const hostSocket = io.sockets.sockets.get(room.hostId);

    if (!hostSocket) { socket.emit('err_msg', "Создатель комнаты отключился."); delete privateRooms[code]; return; }

    socket.username = data.username;
    activeGames[roomId] = {
      p1: { id: hostSocket.id, username: room.hostName, code: room.hostCode, wantsRematch: false },
      p2: { id: socket.id, username: data.username, code: data.code, wantsRematch: false },
      turn: hostSocket.id
    };

    io.to(roomId).emit('game_start', {
      roomId: roomId, p1_name: room.hostName, p2_name: data.username, turn: hostSocket.id
    });

    delete privateRooms[code];
  });

  socket.on('chat_message', (data) => {
    io.to(data.roomId).emit('chat_message', { username: data.username, text: data.text });
  });

  socket.on('make_guess', (data) => {
    const { roomId, guess } = data;
    const game = activeGames[roomId];
    if (!game || game.turn !== socket.id) return;

    const isP1 = socket.id === game.p1.id;
    const opponent = isP1 ? game.p2 : game.p1;

    const marks = scoreGuess(guess, opponent.code);
    const isWin = marks.every(m => m === "green");
    game.turn = opponent.id;

    io.to(roomId).emit('guess_result', { guess, marks, isWin, nextTurn: opponent.id, player: socket.id });

    if (isWin) {
      game.winner = socket.id;
      game.winningCode = opponent.code;
      game.loserCode = socket.id === game.p1.id ? game.p2.code : game.p1.code; // Код победителя (для проигравшего)
      io.to(roomId).emit('game_over', { winner: socket.id, code: opponent.code });
    }
  });

  socket.on('rematch_request', (data) => {
    const game = activeGames[data.roomId];
    if (!game) return;
    const isP1 = socket.id === game.p1.id;
    if (isP1) game.p1.wantsRematch = true;
    else game.p2.wantsRematch = true;

    const opponent = isP1 ? game.p2 : game.p1;
    io.to(opponent.id).emit('rematch_offered', { from: socket.username });

    if (game.p1.wantsRematch && game.p2.wantsRematch) {
      // Начинаем заново
      game.p1.code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
      game.p2.code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
      game.p1.wantsRematch = false;
      game.p2.wantsRematch = false;
      game.winner = null;
      game.turn = game.p1.id;
      
      io.to(data.roomId).emit('game_start', {
        roomId: data.roomId, p1_name: game.p1.username, p2_name: game.p2.username, turn: game.p1.id
      });
    }
  });

  socket.on('rematch_decline', (data) => {
    const game = activeGames[data.roomId];
    if (!game) return;
    const opponent = socket.id === game.p1.id ? game.p2 : game.p1;
    io.to(opponent.id).emit('rematch_declined');
    delete activeGames[data.roomId];
  });

  socket.on('leave_game', (data) => {
    const game = activeGames[data.roomId];
    if (game) {
      const opponent = socket.id === game.p1.id ? game.p2 : game.p1;
      io.to(opponent.id).emit('opponent_left');
      delete activeGames[data.roomId];
    }
  });

  socket.on('disconnect', () => {
    if (waitingPlayer && waitingPlayer.id === socket.id) waitingPlayer = null;
    
    for (const [roomId, game] of Object.entries(activeGames)) {
      if (game.p1.id === socket.id || game.p2.id === socket.id) {
        const opponent = game.p1.id === socket.id ? game.p2 : game.p1;
        io.to(opponent.id).emit('opponent_left');
        delete activeGames[roomId];
        break;
      }
    }
    
    for (const [code, room] of Object.entries(privateRooms)) {
      if (room.hostId === socket.id) delete privateRooms[code];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
