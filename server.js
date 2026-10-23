const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let waitingPlayer = null;
const privateRooms = {}; // { roomCode: { hostId, hostName, hostCode } }
const activeGames = {};  // { roomId: { p1: {...}, p2: {...}, turn: socketId } }

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
      io.to(roomId).emit('game_over', { winner: socket.id, code: opponent.code, winnerName: socket.username });
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
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
