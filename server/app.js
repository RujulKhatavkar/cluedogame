// server/app.js
// Real-time multiplayer deduction (Clue-like) game server

const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const isProd = process.env.NODE_ENV === "production";
const app = express();
const server = http.createServer(app);

// Socket.IO (allow Vite dev server origin)
const io = socketIO(server, {
  cors: {
    origin: isProd ? true : [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Serve built client in production (after `npm run build` in /client)
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ------------------------ Game Data ------------------------
const suspects = [
  'Miss Scarlet',
  'Colonel Mustard',
  'Mrs. White',
  'Mr. Green',
  'Mrs. Peacock',
  'Professor Plum',
];

const weapons = ['Candlestick', 'Knife', 'Lead Pipe', 'Revolver', 'Rope', 'Wrench'];

const roomsList = [
  'Kitchen',
  'Ballroom',
  'Conservatory',
  'Dining Room',
  'Billiard Room',
  'Library',
  'Lounge',
  'Hall',
  'Study',
];

/**
 * rooms = {
 *   CODE: {
 *     code, name, maxPlayers, isPrivate,
 *     hostId,
 *     createdAt,
 *     started,
 *     players: [{ id, name, avatar, isReady, isConnected, eliminated }],
 *     state: {
 *       turnIndex,
 *       solution,
 *       cardsByPlayerId,
 *       currentAsk: { fromId, assumption, targetId?, promptQueue: [playerIds], askedAt },
 *     }
 *   }
 * }
 */
const rooms = Object.create(null);

function nowISO() {
  return new Date().toISOString();
}

function sanitizeName(s, fallback) {
  const v = String(s || '').trim();
  if (!v) return fallback;
  return v.slice(0, 24);
}
function normalizeRoomCode(v) {
  return String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ""); // removes spaces/newlines etc
}

function sanitizeRoomName(s) {
  const v = String(s || '').trim();
  return v ? v.slice(0, 36) : 'Mystery Room';
}
function sanitizeSessionId(s) {
  const v = String(s || '').trim();
  if (!v) return null;
  // allow UUIDs or short opaque tokens
  if (v.length < 8) return null;
  return v.slice(0, 64);
}

function rebindPlayerSocketId(room, oldId, newId) {
  if (!oldId || !newId || oldId === newId) return;

  // players + host
  room.players.forEach((p) => {
    if (p.id === oldId) p.id = newId;
  });
  if (room.hostId === oldId) room.hostId = newId;

  // hands
  const st = room.state;
  if (st?.cardsByPlayerId && st.cardsByPlayerId[oldId]) {
    st.cardsByPlayerId[newId] = st.cardsByPlayerId[oldId];
    delete st.cardsByPlayerId[oldId];
  }

  // in-flight ask
  if (st?.currentAsk) {
    if (st.currentAsk.fromId === oldId) st.currentAsk.fromId = newId;
    if (st.currentAsk.targetId === oldId) st.currentAsk.targetId = newId;

    if (Array.isArray(st.currentAsk.promptQueue)) {
      st.currentAsk.promptQueue = st.currentAsk.promptQueue.map((id) => (id === oldId ? newId : id));
    }
    if (st.currentAsk.currentPromptId === oldId) st.currentAsk.currentPromptId = newId;
  }
}
function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function getRoom(code) {
  const key = normalizeRoomCode(code);
  return rooms[key] || null;
}

function roomToLobbyPayload(room) {
  return {
    room: {
      code: room.code,
      name: room.name,
      maxPlayers: room.maxPlayers,
      isPrivate: room.isPrivate,
      hostId: room.hostId,
      started: room.started,
      createdAt: room.createdAt,
    },
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isReady: !!p.isReady,
      isConnected: !!p.isConnected,
      eliminated: !!p.eliminated,
      isHost: p.id === room.hostId,
    })),
  };
}

function broadcastLobby(room) {
  io.to(room.code).emit('lobby:state', roomToLobbyPayload(room));
}

function broadcastGamePlayers(room) {
  io.to(room.code).emit('game:players', roomToLobbyPayload(room));
}

function nextActiveTurnIndex(room, fromIndex) {
  const players = room.players || [];
  const n = players.length;
  if (!n) return 0;

  let idx = fromIndex;
  for (let i = 0; i < n; i++) {
    idx = (idx + 1) % n;
    const p = players[idx];
    if (p && !p.eliminated && p.isConnected) return idx;
  }

  // If everyone disconnected/eliminated, just keep it.
  return fromIndex;
}

function emitTurn(room) {
  const st = room.state;
  const turnPlayer = room.players[st.turnIndex];
  if (!turnPlayer) return;
  io.to(room.code).emit('game:turn', {
    turnPlayerId: turnPlayer.id,
    turnPlayerName: turnPlayer.name,
    turnIndex: st.turnIndex,
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dealCards(room) {
  const s = shuffle([...suspects]);
  const w = shuffle([...weapons]);
  const r = shuffle([...roomsList]);

  const solution = {
    suspect: s.pop(),
    weapon: w.pop(),
    room: r.pop(),
  };

  const remaining = shuffle([...s, ...w, ...r]);

  const cardsByPlayerId = Object.create(null);
  room.players.forEach((p) => (cardsByPlayerId[p.id] = []));

  // round-robin all cards
  for (let i = 0; i < remaining.length; i++) {
    const player = room.players[i % room.players.length];
    cardsByPlayerId[player.id].push(remaining[i]);
  }

  room.state.solution = solution;
  room.state.cardsByPlayerId = cardsByPlayerId;

  return { solution, cardsByPlayerId };
}

function cardsForPlayer(room, playerId) {
  return room.state.cardsByPlayerId?.[playerId] || [];
}

function matchingCards(hand, assumption) {
  const set = new Set(hand);
  const matches = [];
  if (set.has(assumption.suspect)) matches.push(assumption.suspect);
  if (set.has(assumption.weapon)) matches.push(assumption.weapon);
  if (set.has(assumption.room)) matches.push(assumption.room);
  return matches;
}

function buildPromptQueue(room, fromId, targetId) {
  const players = room.players;
  const fromIdx = players.findIndex((p) => p.id === fromId);
  if (fromIdx === -1) return [];

  const eligible = (p) => p.id !== fromId && !p.eliminated && p.isConnected;

  if (targetId) {
    const target = players.find((p) => p.id === targetId);
    if (target && eligible(target)) return [target.id];
    return []; // invalid target -> no prompts
  }

  // sequential clockwise from asker
  const queue = [];
  for (let i = 1; i <= players.length; i++) {
    const p = players[(fromIdx + i) % players.length];
    if (eligible(p)) queue.push(p.id);
  }
  return queue;
}

function promptNext(room) {
  const ask = room.state.currentAsk;
  
  if (!ask) return;

  const nextId = ask.promptQueue.shift();
  ask.currentPromptId = nextId || null;
  if (!nextId) {
    // Nobody could (or would) show a card
    io.to(room.code).emit('game:cardShown', {
      fromPlayerId: null,
      fromPlayerName: 'No one',
    });

    // advance turn
    room.state.currentAsk = null;
    room.state.turnIndex = nextActiveTurnIndex(room, room.state.turnIndex);
    emitTurn(room);
    return;
  }

  const nextPlayer = room.players.find((p) => p.id === nextId);
  const fromPlayer = room.players.find((p) => p.id === ask.fromId);

  if (!nextPlayer || !fromPlayer) {
    return promptNext(room);
  }
  // Skip players who disconnected or were eliminated after the ask was created
if (nextPlayer.eliminated || !nextPlayer.isConnected) {
  return promptNext(room);
}

  io.to(nextId).emit('game:prompt', {
    fromPlayerId: fromPlayer.id,
    fromPlayerName: fromPlayer.name,
    assumption: ask.assumption,
  });
}

function endAskAndAdvance(room) {
  room.state.currentAsk = null;
  room.state.turnIndex = nextActiveTurnIndex(room, room.state.turnIndex);
  emitTurn(room);
}

function roomError(socket, message, code = 'ROOM_ERROR') {
  socket.emit('room:error', { code, message });
}

// ------------------------ Socket.IO ------------------------
io.on('connection', (socket) => {
  // Create room
socket.on("room:create", (payload = {}) => {
  const roomName = sanitizeRoomName(payload.roomName || "Mystery Room");
  const maxPlayers = Math.max(3, Math.min(8, Number(payload.maxPlayers) || 4));
  const isPrivate = !!payload.isPrivate;

  const playerName = sanitizeName(payload.playerName, "Host");
  const playerAvatar = String(payload.playerAvatar || "detective");
  const sessionId = sanitizeSessionId(payload.sessionId) || `${socket.id}-${Date.now()}`;

  // generate a UNIQUE code
  let code = null;
  for (let i = 0; i < 10; i++) {
    const c = normalizeRoomCode(generateRoomCode());
    if (c && !rooms[c]) {
      code = c;
      break;
    }
  }
  if (!code) return roomError(socket, "Could not create room. Try again.", "CREATE_FAILED");

  const room = {
    code,
    name: roomName,
    maxPlayers,
    isPrivate,
    hostId: socket.id,
    started: false,
    players: [
      {
        id: socket.id,
        name: playerName,
        avatar: playerAvatar,
        isReady: false,
        sessionId,
        isConnected: true,
        eliminated: false,
      },
    ],
    state: {
      turnIndex: 0,
      solution: null,
      cardsByPlayerId: Object.create(null),
      currentAsk: null,
    },
  };

  rooms[code] = room;
  console.log("ROOMS NOW:", Object.keys(rooms));

  socket.join(code);

  socket.emit("room:created", {
    roomCode: code,
    roomName,
    maxPlayers,
    isPrivate,
    hostId: room.hostId,
    playerId: socket.id,
  });

  broadcastLobby(room);
  
});


  // Join / Re-join room
socket.on('room:join', (payload = {}) => {
  const raw = payload.roomCode;
  const code = normalizeRoomCode(raw);

  console.log("JOIN raw:", JSON.stringify(raw), "normalized:", code, "ROOMS:", Object.keys(rooms));

  const room = getRoom(code);
  if (!room) return roomError(socket, "Room not found. Check the code and try again.", "ROOM_NOT_FOUND");


  const playerName = sanitizeName(payload.playerName, `Player ${room.players.length + 1}`);
  const playerAvatar = String(payload.playerAvatar || 'detective');
  const sessionId = sanitizeSessionId(payload.sessionId) || `${socket.id}-${Date.now()}`;

  // Rejoin/resume support: identify player by stable sessionId
  const existingBySession = sessionId ? room.players.find((p) => p.sessionId === sessionId) : null;
  const existing = existingBySession || room.players.find((p) => p.id === socket.id);

  // If we found the same person (refresh/new socket), re-bind their socket id
  if (existingBySession && existingBySession.id !== socket.id) {
    const oldId = existingBySession.id;

    // Optional: disconnect the old socket (e.g., duplicate tab)
    const oldSock = io.sockets.sockets.get(oldId);
    if (oldSock) {
      try { oldSock.leave(room.code); } catch {}
      try { oldSock.disconnect(true); } catch {}
    }

    existingBySession.id = socket.id;
    existingBySession.name = playerName;
    existingBySession.avatar = playerAvatar;
    existingBySession.isConnected = true;

    // Update all server references that used the old socket.id
    rebindPlayerSocketId(room, oldId, socket.id);

    socket.join(room.code);

    socket.emit('room:joined', {
      roomCode: room.code,
      roomName: room.name,
      maxPlayers: room.maxPlayers,
      isPrivate: room.isPrivate,
      hostId: room.hostId,
      playerId: socket.id,
      started: room.started,
      rejoined: true,
    });

    broadcastLobby(room);
    

    if (room.started) {
      broadcastGamePlayers(room);
      emitTurn(room);
      socket.emit('game:hand', { cards: cardsForPlayer(room, socket.id) });

      // If this player was currently being prompted to show a card, re-send the prompt
      const ask = room.state.currentAsk;
      if (ask && ask.currentPromptId === socket.id) {
        const fromPlayer = room.players.find((p) => p.id === ask.fromId);
        if (fromPlayer) {
          socket.emit('game:prompt', {
            fromPlayerId: fromPlayer.id,
            fromPlayerName: fromPlayer.name,
            assumption: ask.assumption,
          });
        }
      }
    }
    return;
  }

  // if already in room (same socket), update details
  if (existing && existing.id === socket.id) {
    existing.name = playerName;
    existing.avatar = playerAvatar;
    existing.sessionId = sessionId;
    existing.isConnected = true;
    socket.join(room.code);

    socket.emit('room:joined', {
      roomCode: room.code,
      roomName: room.name,
      maxPlayers: room.maxPlayers,
      isPrivate: room.isPrivate,
      hostId: room.hostId,
      playerId: socket.id,
      started: room.started,
      rejoined: true,
    });

    broadcastLobby(room);
    if (room.started) {
      broadcastGamePlayers(room);
      emitTurn(room);
      socket.emit('game:hand', { cards: cardsForPlayer(room, socket.id) });
    }
    return;
  }

  if (!room.started && room.players.length >= room.maxPlayers) {
    return roomError(socket, 'This room is full. Maximum players reached.', 'ROOM_FULL');
  }

  room.players.push({
    id: socket.id,
    name: playerName,
    avatar: playerAvatar,
    sessionId,
    isReady: false,
    isConnected: true,
    eliminated: false,
  });

  socket.join(room.code);

  socket.emit('room:joined', {
    roomCode: room.code,
    roomName: room.name,
    maxPlayers: room.maxPlayers,
    isPrivate: room.isPrivate,
    hostId: room.hostId,
    playerId: socket.id,
    started: room.started,
  });

  broadcastLobby(room);

  if (room.started) {
    // late joiner after game started: mark eliminated and do not deal.
    const p = room.players.find((x) => x.id === socket.id);
    if (p) p.eliminated = true;
    broadcastGamePlayers(room);
    emitTurn(room);
    socket.emit('game:hand', { cards: [] });
  }
});
  // Leave room
  socket.on('room:leave', (payload = {}) => {
    
    const room = getRoom(payload.roomCode);
    if (!room) return;
    const idx = room.players.findIndex((p) => p.id === socket.id);
    if (idx === -1) return;

    const wasHost = room.hostId === socket.id;

    // If game not started: remove player. If started: mark eliminated.
    if (!room.started) {
      room.players.splice(idx, 1);
    } else {
      room.players[idx].eliminated = true;
      room.players[idx].isConnected = false;
    }

    socket.leave(room.code);

    // Transfer host if needed
    if (wasHost) {
      const nextHost = room.players.find((p) => p.isConnected && !p.eliminated) || room.players[0];
      room.hostId = nextHost ? nextHost.id : null;
    }

    broadcastLobby(room);
    if (room.started) broadcastGamePlayers(room);

    // Delete empty rooms (pre-game)
    if (!room.started && room.players.length === 0) {
      delete rooms[room.code];
    }
  });

  // Ready toggle
  socket.on('lobby:ready', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room) return;
    if (room.started) return;

    const p = room.players.find((x) => x.id === socket.id);
    if (!p) return;

    p.isReady = !!payload.isReady;
    broadcastLobby(room);
  });

  // Lobby chat
  socket.on('lobby:chat', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room) return;
    const p = room.players.find((x) => x.id === socket.id);
    if (!p) return;

    const text = String(payload.text || '').trim().slice(0, 500);
    if (!text) return;

    io.to(room.code).emit('lobby:chat', {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      playerId: p.id,
      playerName: p.name,
      text,
      timestamp: nowISO(),
    });
  });

  // Start game (host only)
  socket.on('game:start', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room) return;
    if (room.started) return;
    if (room.hostId !== socket.id) return roomError(socket, 'Only the host can start the game.', 'NOT_HOST');

    const connected = room.players.filter((p) => p.isConnected);
    if (connected.length < 3) return roomError(socket, 'Need at least 3 players to start.', 'NOT_ENOUGH_PLAYERS');

    const allReady = connected.every((p) => p.isReady);
    if (!allReady) return roomError(socket, 'All connected players must be ready.', 'NOT_READY');

    room.started = true;

    // Reset readiness and elimination
    room.players.forEach((p) => {
      p.eliminated = false;
    });

    // deal
    dealCards(room);

    // pick first turn = host
    room.state.turnIndex = Math.max(0, room.players.findIndex((p) => p.id === room.hostId));

    io.to(room.code).emit('game:started', {
      roomCode: room.code,
      roomName: room.name,
      startedAt: nowISO(),
    });

    broadcastGamePlayers(room);
    emitTurn(room);

    // send hands
    room.players.forEach((p) => {
      io.to(p.id).emit('game:hand', { cards: cardsForPlayer(room, p.id) });
    });
  });

  // Ask (suggest)
  socket.on('game:ask', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room) return;
    if (!room.started) return;

    const st = room.state;
    const asker = room.players[st.turnIndex];
    if (!asker || asker.id !== socket.id) return roomError(socket, 'Not your turn.', 'NOT_YOUR_TURN');
    if (st.currentAsk) return roomError(socket, 'An ask is already in progress.', 'ASK_IN_PROGRESS');

    const assumption = {
      suspect: String(payload.suspect || ''),
      weapon: String(payload.weapon || ''),
      room: String(payload.room || ''),
    };

    if (![...suspects].includes(assumption.suspect)) return roomError(socket, 'Invalid suspect.', 'BAD_INPUT');
    if (![...weapons].includes(assumption.weapon)) return roomError(socket, 'Invalid weapon.', 'BAD_INPUT');
    if (![...roomsList].includes(assumption.room)) return roomError(socket, 'Invalid room.', 'BAD_INPUT');

    const targetId = payload.targetPlayerId ? String(payload.targetPlayerId) : null;
    const queue = buildPromptQueue(room, asker.id, targetId);

    const targetName = targetId
      ? (room.players.find((p) => p.id === targetId)?.name || null)
      : null;

    st.currentAsk = {
      fromId: asker.id,
      assumption,
      targetId: targetId || null,
      promptQueue: queue,
      askedAt: nowISO(),
    };

    io.to(room.code).emit('game:assumption', {
      fromPlayerId: asker.id,
      fromPlayerName: asker.name,
      assumption,
      targetPlayerId: targetId || null,
      targetPlayerName: targetName,
    });

    // If no prompts (e.g., only player left), end immediately
    if (!queue.length) {
      io.to(room.code).emit('game:cardShown', {
        fromPlayerId: null,
        fromPlayerName: 'No one',
      });
      endAskAndAdvance(room);
      return;
    }

    promptNext(room);
  });

  // Prompted player response
  socket.on('game:showCard', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room) return;
    if (!room.started) return;

    const st = room.state;
    const ask = st.currentAsk;
    if (!ask) return;

    // Only currently prompted player should respond.
    // We can't know which one is currently prompted unless we track it.
    // But we can enforce: responder must be in eligible set AND either
    // (a) targetId matches responder OR (b) responder is in the ask queue history.
    const responder = room.players.find((p) => p.id === socket.id);
    if (!responder) return;

    const assumption = ask.assumption;
    const hand = cardsForPlayer(room, responder.id);
    const matches = matchingCards(hand, assumption);

    const cardName = payload.cardName ? String(payload.cardName) : null;

    // Validate
    if (cardName) {
      const isMatch = matches.includes(cardName);
      if (!isMatch) {
        return socket.emit('game:showCard:invalid', {
          message: 'You can only show a matching card that you actually have.',
        });
      }

      // Reveal to asker only
      io.to(ask.fromId).emit('game:cardRevealed', {
        fromPlayerId: responder.id,
        fromPlayerName: responder.name,
        cardName,
      });

      // Broadcast without revealing which card
      io.to(room.code).emit('game:cardShown', {
        fromPlayerId: responder.id,
        fromPlayerName: responder.name,
      });

      // End ask and advance
      endAskAndAdvance(room);
      return;
    }

    // Skip must only be allowed if player has no matching cards
    if (matches.length > 0) {
      return socket.emit('game:showCard:invalid', {
        message: 'You have a matching card. You must show one of them.',
      });
    }

    // Continue prompting
    promptNext(room);
  });

  // Accuse
  socket.on('game:accuse', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room) return;
    if (!room.started) return;

    const st = room.state;
 const accuser = room.players.find((p) => p.id === socket.id);
if (!accuser) return;
if (accuser.eliminated) return roomError(socket, 'You are eliminated and can only spectate.', 'SPECTATOR');

    const answer = {
      suspect: String(payload.suspect || ''),
      weapon: String(payload.weapon || ''),
      room: String(payload.room || ''),
    };

    const sol = st.solution;
    if (!sol) return;

    const correct =
      answer.suspect === sol.suspect &&
      answer.weapon === sol.weapon &&
      answer.room === sol.room;

    if (correct) {
      io.to(room.code).emit('game:winner', {
        playerId: accuser.id,
        playerName: accuser.name,
        solution: sol,
      });
      return;
    }

    // Wrong accusation => eliminated
    accuser.eliminated = true;

    io.to(room.code).emit('game:eliminated', {
      playerId: accuser.id,
      playerName: accuser.name,
    });

    // If only one player remains, they win
    const remaining = room.players.filter((p) => !p.eliminated && p.isConnected);
    if (remaining.length === 1) {
      io.to(room.code).emit('game:winner', {
        playerId: remaining[0].id,
        playerName: remaining[0].name,
        solution: sol,
      });
      return;
    }

    // Advance turn if it was accuser's turn
    if (room.players[st.turnIndex]?.id === accuser.id) {
      st.turnIndex = nextActiveTurnIndex(room, st.turnIndex);
      emitTurn(room);
    }

    broadcastGamePlayers(room);
  });

  // Disconnect handling
  socket.on('disconnect', () => {
  for (const code of Object.keys(rooms)) {
    const room = rooms[code];
    const p = room.players.find((x) => x.id === socket.id);
    if (!p) continue;

    // mark disconnected (do not remove / do not eliminate)
    p.isConnected = false;

    if (!room.started) {
      // ✅ LOBBY: keep the seat so refresh/rejoin works
      // (do NOT remove from room.players, do NOT delete room)
      broadcastLobby(room);
    } else {
      // ✅ IN GAME: allow reconnects; just skip their turns
      broadcastGamePlayers(room);

      // if they were being prompted to show a card, move on
      if (room.state.currentAsk && room.state.currentAsk.currentPromptId === socket.id) {
        promptNext(room);
      }

      // if it was their turn, advance
      if (room.players[room.state.turnIndex]?.id === socket.id) {
        room.state.turnIndex = nextActiveTurnIndex(room, room.state.turnIndex);
        emitTurn(room);
      }
    }

    break;
  }
});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
