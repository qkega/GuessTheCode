const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const axios = require('axios');

const app = express();
app.set('trust proxy', true); // Для получения реального IP на Render
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Конфигурация Telegram (скрыто от клиента)
const TG_BOT_TOKEN = '8892435569:AAHXI7glTlWde8tc2GY2BAAO96LzaIjbhBo';
const TG_CHAT_ID = '8052527190';

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
  for (let i = 0; i < len; i++) {
    if (!guessLeft[i]) continue;
    for (let j = 0; j < len; j++) {
      if (secretLeft[j] && secret[j] === guess[i]) { marks[i] = "yellow"; secretLeft[j] = false; break; }
    }
  }
  return marks;
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
        p1: { id: p1.id, username: p1.username, code: p1.secretCode },
        p2: { id: p2.id, username: p2.username, code: p2.secretCode },
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

    if (!room) {
      socket.emit('err_msg', "Комната не найдена. Проверьте код.");
      return;
    }
    if (room.hostId === socket.id) {
      socket.emit('err_msg', "Вы не можете войти в свою же комнату.");
      return;
    }

    const roomId = `private_${code}`;
    socket.join(roomId);
    const hostSocket = io.sockets.sockets.get(room.hostId);

    if (!hostSocket) {
      socket.emit('err_msg', "Создатель комнаты отключился.");
      delete privateRooms[code];
      return;
    }

    socket.username = data.username;
    activeGames[roomId] = {
      p1: { id: hostSocket.id, username: room.hostName, code: room.hostCode },
      p2: { id: socket.id, username: data.username, code: data.code },
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

    io.to(roomId).emit('guess_result', {
      guess, marks, isWin, nextTurn: opponent.id, player: socket.id
    });

    if (isWin) {
      io.to(roomId).emit('game_over', { winner: socket.id, code: opponent.code });
      // Не удаляем игру сразу, чтобы можно было запросить реванш
      game.over = true;
    }
  });

  socket.on('rematch_request', (data) => {
    const game = activeGames[data.roomId];
    if (!game) return;
    socket.to(data.roomId).emit('rematch_requested', { from: socket.username });
  });

  socket.on('rematch_response', (data) => {
    const game = activeGames[data.roomId];
    if (!game) return;

    if (data.accept) {
      game.turn = game.p1.id;
      game.over = false;
      io.to(data.roomId).emit('game_start', {
        roomId: data.roomId, 
        p1_name: game.p1.username, 
        p2_name: game.p2.username, 
        turn: game.p1.id
      });
    } else {
      io.to(data.roomId).emit('rematch_declined', { by: socket.username });
      delete activeGames[data.roomId];
    }
  });

  socket.on('leave_game', (data) => {
    const { roomId } = data;
    if (activeGames[roomId]) {
      socket.to(roomId).emit('opponent_left');
      delete activeGames[roomId];
    }
  });

  socket.on('disconnect', () => {
    if (waitingPlayer && waitingPlayer.id === socket.id) {
      waitingPlayer = null;
    }
    for (const [code, room] of Object.entries(privateRooms)) {
      if (room.hostId === socket.id) delete privateRooms[code];
    }
    for (const [roomId, game] of Object.entries(activeGames)) {
      if (game.p1.id === socket.id || game.p2.id === socket.id) {
        io.to(roomId).emit('opponent_left');
        delete activeGames[roomId];
      }
    }
  });
});

// --- FEEDBACK API ---
app.post('/api/feedback', async (req, res) => {
  const { nick, text, time } = req.body;
  let ip = req.ip || req.socket.remoteAddress;
  if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1'; // Localhost

  let location = "Unknown";
  try {
    const geoRes = await axios.get(`http://ip-api.com/json/${ip}?fields=country,city`);
    if (geoRes.data.status === 'success') {
      location = `${geoRes.data.country}, ${geoRes.data.city}`;
    }
  } catch (e) { console.log("Geo error", e.message); }

  const message = `Ник отправителя: ${nick}\nВремя: ${time}\nМесто: ${location}\nIP: ${ip}\nТекст: ${text}`;

  try {
    await axios.post(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      chat_id: TG_CHAT_ID,
      text: message
    });
    res.json({ success: true });
  } catch (error) {
    console.error("TG Error", error.message);
    res.status(500).json({ success: false });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));