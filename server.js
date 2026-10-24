const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');
const axios = require('axios');

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const TG_BOT_TOKEN = '8892435569:AAHXI7glTlWde8tc2GY2BAAO96LzaIjbhBo';
const TG_CHAT_ID = '8052527190';

let waitingQueue = [];
const pendingMatches = {}; // roomId -> { p1, p2, p1Accepted, p2Accepted }
const activeGames = {};    // roomId -> { p1: {...}, p2: {...}, turn }
const privateRooms = {};   // roomCode -> { hostId, hostName, hostCode }
const rematchRequests = {};// roomId -> { p1: false, p2: false }

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

function genCode() {
  let c = ''; for (let i = 0; i < 6; i++) c += Math.floor(Math.random() * 10); return c;
}

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = ""; for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length)); return code;
}

io.on('connection', (socket) => {
  // ==== RANDOM MATCHMAKING ====
  socket.on('find_random', (data) => {
    socket.username = data.username;
    socket.secretCode = data.code;

    // Try to match with someone in queue
    while (waitingQueue.length > 0) {
      const opponent = waitingQueue.shift();
      if (opponent.connected && opponent.id !== socket.id) {
        const roomId = `pending_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        pendingMatches[roomId] = { p1: opponent, p2: socket, p1Accepted: false, p2Accepted: false };
        
        opponent.emit('match_found', { roomId, opponentName: socket.username });
        socket.emit('match_found', { roomId, opponentName: opponent.username });
        return;
      }
    }
    // No match, add to queue
    waitingQueue.push(socket);
    socket.emit('waiting_random');
  });

  socket.on('match_accept', (data) => {
    const match = pendingMatches[data.roomId];
    if (!match) return;
    if (socket.id === match.p1.id) match.p1Accepted = true;
    else if (socket.id === match.p2.id) match.p2Accepted = true;

    socket.emit('match_accepted');

    if (match.p1Accepted && match.p2Accepted) {
      const roomId = `game_${Date.now()}`;
      match.p1.join(roomId);
      match.p2.join(roomId);

      activeGames[roomId] = {
        p1: { id: match.p1.id, username: match.p1.username, code: match.p1.secretCode },
        p2: { id: match.p2.id, username: match.p2.username, code: match.p2.secretCode },
        turn: match.p1.id
      };

      io.to(roomId).emit('game_start', {
        roomId, p1_name: match.p1.username, p2_name: match.p2.username, turn: match.p1.id
      });
      delete pendingMatches[data.roomId];
    }
  });

  socket.on('match_decline', (data) => {
    const match = pendingMatches[data.roomId];
    if (!match) return;
    const other = socket.id === match.p1.id ? match.p2 : match.p1;
    
    other.emit('match_declined', { by: socket.username });
    
    if (other.connected) {
      waitingQueue.push(other);
      other.emit('waiting_random');
    }
    delete pendingMatches[data.roomId];
  });

  // ==== PRIVATE ROOMS ====
  socket.on('create_room', (data) => {
    let code = generateRoomCode();
    while (privateRooms[code]) code = generateRoomCode();
    privateRooms[code] = { hostId: socket.id, hostName: data.username, hostCode: data.code };
    socket.join(`private_${code}`);
    socket.emit('room_created', { roomCode: code });
  });

  socket.on('join_room', (data) => {
    const code = data.roomCode.toUpperCase();
    const room = privateRooms[code];
    if (!room) return socket.emit('err_msg', "Комната не найдена");
    if (room.hostId === socket.id) return socket.emit('err_msg', "Нельзя войти в свою комнату");

    socket.join(`private_${code}`);
    const hostSocket = io.sockets.sockets.get(room.hostId);
    if (!hostSocket) return socket.emit('err_msg', "Хост отключился");

    const roomId = `private_game_${Date.now()}`;
    hostSocket.join(roomId);
    socket.join(roomId);

    activeGames[roomId] = {
      p1: { id: hostSocket.id, username: room.hostName, code: room.hostCode },
      p2: { id: socket.id, username: data.username, code: data.code },
      turn: hostSocket.id
    };

    io.to(roomId).emit('game_start', {
      roomId, p1_name: room.hostName, p2_name: data.username, turn: hostSocket.id
    });
    delete privateRooms[code];
  });

  // ==== GAMEPLAY ====
  socket.on('make_guess', (data) => {
    const game = activeGames[data.roomId];
    if (!game || game.turn !== socket.id) return;

    const isP1 = socket.id === game.p1.id;
    const opponent = isP1 ? game.p2 : game.p1;
    const marks = scoreGuess(data.guess, opponent.code);
    const isWin = marks.every(m => m === "green");
    game.turn = opponent.id;

    io.to(data.roomId).emit('guess_result', {
      guess: data.guess, marks, isWin, nextTurn: opponent.id, player: socket.id
    });

    if (isWin) {
      io.to(data.roomId).emit('game_over', { winner: socket.id, code: opponent.code });
    }
  });

  // ==== REMATCH ====
  socket.on('rematch_accept', (data) => {
    const game = activeGames[data.roomId];
    if (!game) return;
    if (!rematchRequests[data.roomId]) rematchRequests[data.roomId] = { p1: false, p2: false };

    if (socket.id === game.p1.id) rematchRequests[data.roomId].p1 = true;
    else rematchRequests[data.roomId].p2 = true;

    socket.emit('rematch_waiting');

    if (rematchRequests[data.roomId].p1 && rematchRequests[data.roomId].p2) {
      // Generate new codes
      game.p1.code = genCode();
      game.p2.code = genCode();
      game.turn = game.p1.id;

      io.to(game.p1.id).emit('new_secret_code', { code: game.p1.code });
      io.to(game.p2.id).emit('new_secret_code', { code: game.p2.code });

      io.to(data.roomId).emit('game_start', {
        roomId: data.roomId, p1_name: game.p1.username, p2_name: game.p2.username, turn: game.p1.id, restart: true
      });
      delete rematchRequests[data.roomId];
    } else {
      socket.to(data.roomId).emit('rematch_opponent_accepted');
    }
  });

  socket.on('rematch_decline', (data) => {
    socket.to(data.roomId).emit('rematch_declined', { by: socket.username });
    delete activeGames[data.roomId];
    delete rematchRequests[data.roomId];
  });

  // ==== CHAT & LEAVE ====
  socket.on('chat_message', (data) => {
    io.to(data.roomId).emit('chat_message', { username: data.username, text: data.text });
  });

  socket.on('leave_game', (data) => {
    if (activeGames[data.roomId]) {
      socket.to(data.roomId).emit('opponent_left');
      delete activeGames[data.roomId];
    }
  });

  socket.on('disconnect', () => {
    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
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

// ==== FEEDBACK ====
app.post('/api/feedback', async (req, res) => {
  const { nick, text, time } = req.body;
  let ip = req.ip || req.socket.remoteAddress;
  if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';

  let location = "Unknown";
  try {
    const geo = await axios.get(`http://ip-api.com/json/${ip}?fields=country,city`);
    if (geo.data.status === 'success') location = `${geo.data.country}, ${geo.data.city}`;
  } catch (e) {}

  const msg = `Ник: ${nick}\nВремя: ${time}\nМесто: ${location}\nIP: ${ip}\nТекст: ${text}`;

  try {
    await axios.post(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      chat_id: TG_CHAT_ID, text: msg
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on ${PORT}`));