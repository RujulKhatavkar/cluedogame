// server/app.js
// Real-time multiplayer deduction (Clue-like) game server with optional hard AI bots

const crypto = require('crypto');
const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);

const io = socketIO(server, {
  cors:
    process.env.NODE_ENV === 'production'
      ? { origin: true, methods: ['GET', 'POST'], credentials: true }
      : {
          origin: [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
          ],
          methods: ['GET', 'POST'],
          credentials: true,
        },
});

const newSessionId = () =>
  crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

app.get('/api/health', (_req, res) => res.json({ ok: true }));

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

const ALL_CARDS = [...suspects, ...weapons, ...roomsList];
const SOLUTION_OWNER = '__solution__';
const BOT_THINK_MS = 650;
const BOT_AVATARS = ['detective', 'professor', 'colonel', 'doctor', 'mr', 'mrs', 'reverend', 'miss'];

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
  return String(v || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function sanitizeRoomName(s) {
  const v = String(s || '').trim();
  return v ? v.slice(0, 36) : 'Mystery Room';
}

function sanitizeSessionId(s) {
  const v = String(s || '').trim();
  if (!v) return null;
  if (v.length < 8) return null;
  return v.slice(0, 64);
}

function sanitizeBotCount(raw, maxPlayers) {
  const num = Number(raw) || 0;
  return Math.max(0, Math.min(2, Math.min(maxPlayers - 1, num)));
}

function isAlivePlayer(p) {
  return !!p && !p.eliminated && p.isConnected;
}

function clearBotTimer(room) {
  if (room?.state?.botTimer) {
    clearTimeout(room.state.botTimer);
    room.state.botTimer = null;
  }
}

function generateRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function getRoom(code) {
  const key = normalizeRoomCode(code);
  return rooms[key] || null;
}

function roomError(socket, message, code = 'ROOM_ERROR') {
  socket.emit('room:error', { code, message });
}

function chooseNextHost(room) {
  return (
    room.players.find((p) => !p.isBot && p.isConnected && !p.eliminated) ||
    room.players.find((p) => !p.isBot) ||
    null
  );
}

function rebindPlayerSocketId(room, oldId, newId) {
  if (!oldId || !newId || oldId === newId) return;

  room.players.forEach((p) => {
    if (p.id === oldId) p.id = newId;
  });

  if (room.hostId === oldId) room.hostId = newId;

  const st = room.state;

  if (st?.cardsByPlayerId && st.cardsByPlayerId[oldId]) {
    st.cardsByPlayerId[newId] = st.cardsByPlayerId[oldId];
    delete st.cardsByPlayerId[oldId];
  }

  if (st?.currentAsk) {
    if (st.currentAsk.fromId === oldId) st.currentAsk.fromId = newId;
    if (st.currentAsk.targetId === oldId) st.currentAsk.targetId = newId;
    if (Array.isArray(st.currentAsk.promptQueue)) {
      st.currentAsk.promptQueue = st.currentAsk.promptQueue.map((id) => (id === oldId ? newId : id));
    }
    if (Array.isArray(st.currentAsk.promptedPlayerIds)) {
      st.currentAsk.promptedPlayerIds = st.currentAsk.promptedPlayerIds.map((id) =>
        id === oldId ? newId : id
      );
    }
    if (st.currentAsk.currentPromptId === oldId) st.currentAsk.currentPromptId = newId;
  }
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
      isBot: !!p.isBot,
      botDifficulty: p.botDifficulty || null,
    })),
  };
}

function broadcastLobby(room) {
  console.log(
    "BROADCAST LOBBY players =",
    room.players.map((p) => ({
      name: p.name,
      isBot: !!p.isBot,
      id: p.id,
    }))
  );
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
  for (let i = 0; i < n; i += 1) {
    idx = (idx + 1) % n;
    const p = players[idx];
    if (isAlivePlayer(p)) return idx;
  }

  return fromIndex;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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

function getCategoryCards(cardOrCategory) {
  if (cardOrCategory === 'suspect' || suspects.includes(cardOrCategory)) return suspects;
  if (cardOrCategory === 'weapon' || weapons.includes(cardOrCategory)) return weapons;
  return roomsList;
}

function makeBotPlayer(room, index) {
  return {
    id: `bot-${room.code}-${index}-${crypto.randomBytes(4).toString('hex')}`,
    name: `AI ${index}`,
    avatar: BOT_AVATARS[(index - 1) % BOT_AVATARS.length],
    isReady: true,
    sessionId: null,
    isConnected: true,
    eliminated: false,
    isBot: true,
    botDifficulty: 'hard',
  };
}

function createBotBrain(room, botId) {
  const owners = [...room.players.map((p) => p.id), SOLUTION_OWNER];
  const possibleOwnersByCard = Object.create(null);

  ALL_CARDS.forEach((card) => {
    possibleOwnersByCard[card] = new Set(owners);
  });

  return {
    botId,
    possibleOwnersByCard,
    claims: [],
    history: [],
    lastAskSignature: null,
  };
}

function getBotBrain(room, botId) {
  room.state.botBrains = room.state.botBrains || Object.create(null);
  if (!room.state.botBrains[botId]) {
    room.state.botBrains[botId] = createBotBrain(room, botId);
  }
  return room.state.botBrains[botId];
}

function removePossibleOwner(room, botId, cardName, ownerId) {
  const brain = getBotBrain(room, botId);
  const set = brain.possibleOwnersByCard[cardName];
  if (!set || !set.has(ownerId)) return false;
  if (set.size === 1) return false;

  set.delete(ownerId);
  if (set.size === 0) {
    set.add(ownerId);
    return false;
  }
  return true;
}

function setKnownOwner(room, botId, cardName, ownerId) {
  const brain = getBotBrain(room, botId);
  const set = brain.possibleOwnersByCard[cardName];

  if (set && set.size === 1 && set.has(ownerId)) return false;

  brain.possibleOwnersByCard[cardName] = new Set([ownerId]);

  if (ownerId === SOLUTION_OWNER) {
    for (const sibling of getCategoryCards(cardName)) {
      if (sibling !== cardName) {
        removePossibleOwner(room, botId, sibling, SOLUTION_OWNER);
      }
    }
  }

  return true;
}

function runBotInference(room, botId) {
  const brain = getBotBrain(room, botId);
  let changed = true;
  let guard = 0;

  while (changed && guard < 100) {
    changed = false;
    guard += 1;

    for (const group of [suspects, weapons, roomsList]) {
      const solutionCandidates = group.filter((card) =>
        brain.possibleOwnersByCard[card]?.has(SOLUTION_OWNER)
      );
      if (solutionCandidates.length === 1) {
        changed = setKnownOwner(room, botId, solutionCandidates[0], SOLUTION_OWNER) || changed;
      }
    }

    for (const claim of brain.claims) {
      const possibleCards = claim.cards.filter((card) =>
        brain.possibleOwnersByCard[card]?.has(claim.responderId)
      );
      if (possibleCards.length === 1) {
        changed = setKnownOwner(room, botId, possibleCards[0], claim.responderId) || changed;
      }
    }
  }
}

function initializeBotBrains(room) {
  room.state.botBrains = Object.create(null);
  const botPlayers = room.players.filter((p) => p.isBot);

  for (const bot of botPlayers) {
    const brain = getBotBrain(room, bot.id);
    const hand = cardsForPlayer(room, bot.id);

    for (const card of ALL_CARDS) {
      if (hand.includes(card)) {
        brain.possibleOwnersByCard[card] = new Set([bot.id]);
      } else {
        brain.possibleOwnersByCard[card].delete(bot.id);
      }
    }

    runBotInference(room, bot.id);
  }
}

function learnFromResolvedAsk(room, resolution) {
  const {
    fromId,
    assumption,
    promptedPlayerIds = [],
    responderId = null,
    revealedCardName = null,
  } = resolution;

  const cards = [assumption.suspect, assumption.weapon, assumption.room];
  const responderIndex = responderId ? promptedPlayerIds.indexOf(responderId) : -1;
  const definitelyNoMatchIds =
    responderIndex >= 0 ? promptedPlayerIds.slice(0, responderIndex) : promptedPlayerIds;

  for (const bot of room.players.filter((p) => p.isBot)) {
    const brain = getBotBrain(room, bot.id);

    brain.history.push({
      at: nowISO(),
      fromId,
      responderId,
      cards: [...cards],
      promptedPlayerIds: [...promptedPlayerIds],
      revealedCardName: bot.id === fromId ? revealedCardName : null,
    });

    for (const pid of definitelyNoMatchIds) {
      for (const card of cards) {
        removePossibleOwner(room, bot.id, card, pid);
      }
    }

    if (!responderId) {
      for (const pid of promptedPlayerIds) {
        for (const card of cards) {
          removePossibleOwner(room, bot.id, card, pid);
        }
      }
    } else if (bot.id === fromId && revealedCardName) {
      setKnownOwner(room, bot.id, revealedCardName, responderId);
    } else {
      brain.claims.push({ responderId, cards: [...cards] });
    }

    runBotInference(room, bot.id);
  }
}

function getSolvedSolutionForBot(room, botId) {
  const brain = getBotBrain(room, botId);

  const pick = (group) =>
    group.find((card) => {
      const set = brain.possibleOwnersByCard[card];
      return set && set.size === 1 && set.has(SOLUTION_OWNER);
    }) || null;

  const suspect = pick(suspects);
  const weapon = pick(weapons);
  const roomName = pick(roomsList);

  if (suspect && weapon && roomName) {
    return { suspect, weapon, room: roomName };
  }

  return null;
}

function chooseAskCard(room, botId, cards) {
  const brain = getBotBrain(room, botId);

  const ranked = cards
    .map((card) => {
      const owners = brain.possibleOwnersByCard[card] || new Set();
      const onlyOwner = owners.size === 1 ? Array.from(owners)[0] : null;
      const knownByPlayer = !!onlyOwner && onlyOwner !== SOLUTION_OWNER;
      const solutionPossible = owners.has(SOLUTION_OWNER);
      const sizeScore = 10 - Math.min(owners.size || 10, 10);
      const score = (solutionPossible ? 100 : 0) + sizeScore - (knownByPlayer ? 100 : 0);
      return { card, owners, score };
    })
    .sort((a, b) => b.score - a.score || a.owners.size - b.owners.size || a.card.localeCompare(b.card));

  return ranked[0]?.card || cards[0];
}

function chooseHardBotAsk(room, botId) {
  const brain = getBotBrain(room, botId);

  const assumption = {
    suspect: chooseAskCard(room, botId, suspects),
    weapon: chooseAskCard(room, botId, weapons),
    room: chooseAskCard(room, botId, roomsList),
  };

  const candidates = room.players.filter((p) => p.id !== botId && !p.eliminated && p.isConnected);
  const scoredTargets = candidates
    .map((p) => ({
      id: p.id,
      score: [assumption.suspect, assumption.weapon, assumption.room].reduce(
        (sum, card) => sum + (brain.possibleOwnersByCard[card]?.has(p.id) ? 1 : 0),
        0
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const targetPlayerId = scoredTargets[0] && scoredTargets[0].score > 0 ? scoredTargets[0].id : null;

  brain.lastAskSignature = `${assumption.suspect}|${assumption.weapon}|${assumption.room}|${
    targetPlayerId || 'all'
  }`;

  return { assumption, targetPlayerId };
}

function chooseBotShowCard(room, botId, assumption) {
  const matches = matchingCards(cardsForPlayer(room, botId), assumption);
  if (!matches.length) return null;
  return matches.slice().sort()[0];
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

  room.players.forEach((p) => {
    cardsByPlayerId[p.id] = [];
  });

  for (let i = 0; i < remaining.length; i += 1) {
    const player = room.players[i % room.players.length];
    cardsByPlayerId[player.id].push(remaining[i]);
  }

  room.state.solution = solution;
  room.state.cardsByPlayerId = cardsByPlayerId;
  initializeBotBrains(room);

  return { solution, cardsByPlayerId };
}

function buildPromptQueue(room, fromId, targetId) {
  const players = room.players;
  const fromIdx = players.findIndex((p) => p.id === fromId);
  if (fromIdx === -1) return [];

  const eligible = (p) => p.id !== fromId && !p.eliminated && p.isConnected;

  if (targetId) {
    const target = players.find((p) => p.id === targetId);
    if (target && eligible(target)) return [target.id];
    return [];
  }

  const queue = [];
  for (let i = 1; i <= players.length; i += 1) {
    const p = players[(fromIdx + i) % players.length];
    if (eligible(p)) queue.push(p.id);
  }
  return queue;
}

function emitTurn(room) {
  clearBotTimer(room);

  const st = room.state;
  const turnPlayer = room.players[st.turnIndex];
  if (!turnPlayer || room.ended) return;

  io.to(room.code).emit('game:turn', {
    turnPlayerId: turnPlayer.id,
    turnPlayerName: turnPlayer.name,
    turnIndex: st.turnIndex,
  });

  if (turnPlayer.isBot && turnPlayer.isConnected && !turnPlayer.eliminated && !st.currentAsk) {
    room.state.botTimer = setTimeout(() => {
      try {
        executeBotTurn(room.code, turnPlayer.id);
      } catch (err) {
        console.error('Bot turn failed', err);
        const liveRoom = getRoom(room.code);
        if (liveRoom && liveRoom.started && !liveRoom.ended) {
          liveRoom.state.turnIndex = nextActiveTurnIndex(liveRoom, liveRoom.state.turnIndex);
          emitTurn(liveRoom);
        }
      }
    }, BOT_THINK_MS);
  }
}

function promptNext(room) {
  const ask = room.state.currentAsk;
  if (!ask || room.ended) return;

  const nextId = ask.promptQueue.shift();
  ask.currentPromptId = nextId || null;

  if (!nextId) {
    learnFromResolvedAsk(room, {
      fromId: ask.fromId,
      assumption: ask.assumption,
      promptedPlayerIds: [...ask.promptedPlayerIds],
      responderId: null,
      revealedCardName: null,
    });

    io.to(room.code).emit('game:cardShown', {
      fromPlayerId: null,
      fromPlayerName: 'No one',
    });

    room.state.currentAsk = null;
    room.state.turnIndex = nextActiveTurnIndex(room, room.state.turnIndex);
    emitTurn(room);
    return;
  }

  ask.promptedPlayerIds.push(nextId);

  const nextPlayer = room.players.find((p) => p.id === nextId);
  const fromPlayer = room.players.find((p) => p.id === ask.fromId);

  if (!nextPlayer || !fromPlayer) return promptNext(room);
  if (nextPlayer.eliminated || !nextPlayer.isConnected) return promptNext(room);

  if (nextPlayer.isBot) {
    clearBotTimer(room);
    room.state.botTimer = setTimeout(() => {
      try {
        executeBotShowCard(room.code, nextId);
      } catch (err) {
        console.error('Bot show-card failed', err);
        const liveRoom = getRoom(room.code);
        if (liveRoom && liveRoom.state.currentAsk?.currentPromptId === nextId) {
          promptNext(liveRoom);
        }
      }
    }, BOT_THINK_MS);
    return;
  }

  io.to(nextId).emit('game:prompt', {
    fromPlayerId: fromPlayer.id,
    fromPlayerName: fromPlayer.name,
    assumption: ask.assumption,
  });
}

function startAsk(room, asker, assumption, targetId = null) {
  if (!room || !asker || room.ended) return;
  const st = room.state;
  if (st.currentAsk) return;

  const queue = buildPromptQueue(room, asker.id, targetId);
  const targetName = targetId ? room.players.find((p) => p.id === targetId)?.name || null : null;

  st.currentAsk = {
    fromId: asker.id,
    assumption,
    targetId: targetId || null,
    promptQueue: [...queue],
    promptedPlayerIds: [],
    currentPromptId: null,
    askedAt: nowISO(),
  };

  io.to(room.code).emit('game:assumption', {
    fromPlayerId: asker.id,
    fromPlayerName: asker.name,
    assumption,
    targetPlayerId: targetId || null,
    targetPlayerName: targetName,
  });

  if (!queue.length) {
    learnFromResolvedAsk(room, {
      fromId: asker.id,
      assumption,
      promptedPlayerIds: [],
      responderId: null,
      revealedCardName: null,
    });

    io.to(room.code).emit('game:cardShown', {
      fromPlayerId: null,
      fromPlayerName: 'No one',
    });

    st.currentAsk = null;
    st.turnIndex = nextActiveTurnIndex(room, st.turnIndex);
    emitTurn(room);
    return;
  }

  promptNext(room);
}

function executeBotShowCard(roomCode, botId) {
  const room = getRoom(roomCode);
  if (!room || !room.started || room.ended) return;

  const ask = room.state.currentAsk;
  if (!ask || ask.currentPromptId !== botId) return;

  const responder = room.players.find((p) => p.id === botId);
  if (!responder || responder.eliminated || !responder.isConnected) {
    promptNext(room);
    return;
  }

  const cardName = chooseBotShowCard(room, botId, ask.assumption);
  if (!cardName) {
    promptNext(room);
    return;
  }

  io.to(ask.fromId).emit('game:cardRevealed', {
    fromPlayerId: responder.id,
    fromPlayerName: responder.name,
    cardName,
  });

  io.to(room.code).emit('game:cardShown', {
    fromPlayerId: responder.id,
    fromPlayerName: responder.name,
  });

  learnFromResolvedAsk(room, {
    fromId: ask.fromId,
    assumption: ask.assumption,
    promptedPlayerIds: [...ask.promptedPlayerIds],
    responderId: responder.id,
    revealedCardName: cardName,
  });

  room.state.currentAsk = null;
  room.state.turnIndex = nextActiveTurnIndex(room, room.state.turnIndex);
  emitTurn(room);
}

function endGameWithWinner(room, winnerPlayer, solutionOverride = null) {
  if (!room || room.ended) return;

  clearBotTimer(room);
  room.ended = true;
  room.state.currentAsk = null;

  io.to(room.code).emit('game:winner', {
    playerId: winnerPlayer.id,
    playerName: winnerPlayer.name,
    solution: solutionOverride || room.state.solution,
  });
}

function executeAccusation(room, accuser, answer) {
  if (!room || !room.started || room.ended) return;

  const sol = room.state.solution;
  if (!sol) return;

  const correct =
    answer.suspect === sol.suspect &&
    answer.weapon === sol.weapon &&
    answer.room === sol.room;

  if (correct) {
    endGameWithWinner(room, accuser, sol);
    return;
  }

  accuser.eliminated = true;

  io.to(room.code).emit('game:eliminated', {
    playerId: accuser.id,
    playerName: accuser.name,
  });

  const remaining = room.players.filter((p) => !p.eliminated && p.isConnected);
  if (remaining.length === 1) {
    endGameWithWinner(room, remaining[0], sol);
    return;
  }

  if (room.players[room.state.turnIndex]?.id === accuser.id) {
    room.state.turnIndex = nextActiveTurnIndex(room, room.state.turnIndex);
    emitTurn(room);
  }

  broadcastGamePlayers(room);
}

function executeBotTurn(roomCode, botId) {
  const room = getRoom(roomCode);
  if (!room || !room.started || room.ended) return;

  const st = room.state;
  const current = room.players[st.turnIndex];

  if (
    !current ||
    current.id !== botId ||
    !current.isBot ||
    current.eliminated ||
    !current.isConnected
  ) {
    return;
  }

  if (st.currentAsk) return;

  const solved = getSolvedSolutionForBot(room, botId);
  if (solved) {
    executeAccusation(room, current, solved);
    return;
  }

  const { assumption, targetPlayerId } = chooseHardBotAsk(room, botId);
  startAsk(room, current, assumption, targetPlayerId);
}

// ------------------------ Socket.IO ------------------------
io.on('connection', (socket) => {
  socket.on('room:create', (payload = {}) => {
    const roomName = sanitizeRoomName(payload.roomName || 'Mystery Room');
    const maxPlayers = Math.max(3, Math.min(6, Number(payload.maxPlayers) || 4));
    const botCount = sanitizeBotCount(payload.botCount, maxPlayers);
    const isPrivate = !!payload.isPrivate;

    const playerName = sanitizeName(payload.playerName, 'Host');
    const playerAvatar = String(payload.playerAvatar || 'detective');
    const sessionId = sanitizeSessionId(payload.sessionId) || newSessionId();

    let code = null;
    for (let i = 0; i < 10; i += 1) {
      const c = normalizeRoomCode(generateRoomCode());
      if (c && !rooms[c]) {
        code = c;
        break;
      }
    }

    if (!code) {
      return roomError(socket, 'Could not create room. Try again.', 'CREATE_FAILED');
    }

    const room = {
      code,
      name: roomName,
      maxPlayers,
      isPrivate,
      hostId: socket.id,
      createdAt: nowISO(),
      started: false,
      ended: false,
      players: [
        {
          id: socket.id,
          name: playerName,
          avatar: playerAvatar,
          isReady: false,
          sessionId,
          isConnected: true,
          eliminated: false,
          isBot: false,
          botDifficulty: null,
        },
      ],
      state: {
        turnIndex: 0,
        solution: null,
        cardsByPlayerId: Object.create(null),
        currentAsk: null,
        botBrains: Object.create(null),
        botTimer: null,
      },
    };

    for (let i = 1; i <= botCount; i += 1) {
      room.players.push(makeBotPlayer(room, i));
    }
    console.log(
  "AFTER CREATE:",
  room.players.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: !!p.isBot,
  }))
);
console.log("CREATE botCount =", botCount);
console.log(
  "CREATE players =",
  room.players.map((p) => ({
    name: p.name,
    isBot: !!p.isBot,
    id: p.id,
  }))
);

    rooms[code] = room;
    socket.join(code);

    socket.emit('room:created', {
      roomCode: code,
      roomName,
      maxPlayers,
      isPrivate,
      hostId: room.hostId,
      playerId: socket.id,
      sessionId,
      botCount,
    });
    console.log(
  "BEFORE LOBBY BROADCAST:",
  room.players.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: !!p.isBot,
    isConnected: !!p.isConnected,
  }))
);

    broadcastLobby(room);
  });

  socket.on('room:join', (payload = {}) => {
    const raw = payload.roomCode;
    const code = normalizeRoomCode(raw);

    const room = getRoom(code);
    if (!room) {
      return roomError(socket, 'Room not found. Check the code and try again.', 'ROOM_NOT_FOUND');
    }

    const playerName = sanitizeName(payload.playerName, `Player ${room.players.length + 1}`);
    const playerAvatar = String(payload.playerAvatar || 'detective');
    const sessionId = sanitizeSessionId(payload.sessionId) || newSessionId();

    const existingBySession = sessionId ? room.players.find((p) => p.sessionId === sessionId) : null;
    const existing = existingBySession || room.players.find((p) => p.id === socket.id);

    if (existingBySession && existingBySession.id !== socket.id) {
      const oldId = existingBySession.id;
      const oldSock = io.sockets.sockets.get(oldId);

      if (oldSock) {
        try {
          oldSock.leave(room.code);
        } catch {}
        try {
          oldSock.disconnect(true);
        } catch {}
      }

      existingBySession.id = socket.id;
      existingBySession.name = playerName;
      existingBySession.avatar = playerAvatar;
      existingBySession.isConnected = true;
      existingBySession.isBot = false;
      existingBySession.botDifficulty = null;

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
        sessionId,
      });
      console.log(
  "BEFORE LOBBY BROADCAST:",
  room.players.map((p) => ({
    id: p.id,
    name: p.name,
    isBot: !!p.isBot,
    isConnected: !!p.isConnected,
  }))
);
      broadcastLobby(room);

      if (room.started) {
        broadcastGamePlayers(room);
        emitTurn(room);
        socket.emit('game:hand', { cards: cardsForPlayer(room, socket.id) });

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

    if (existing && existing.id === socket.id) {
      existing.name = playerName;
      existing.avatar = playerAvatar;
      existing.sessionId = sessionId;
      existing.isConnected = true;
      existing.isBot = false;
      existing.botDifficulty = null;
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
        sessionId,
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
      isBot: false,
      botDifficulty: null,
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
      sessionId,
    });

    broadcastLobby(room);

    if (room.started) {
      const p = room.players.find((x) => x.id === socket.id);
      if (p) p.eliminated = true;
      broadcastGamePlayers(room);
      emitTurn(room);
      socket.emit('game:hand', { cards: [] });
    }
  });

  socket.on('room:leave', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room) return;

    const idx = room.players.findIndex((p) => p.id === socket.id);
    if (idx === -1) return;

    const wasHost = room.hostId === socket.id;

    if (!room.started) {
      room.players.splice(idx, 1);
    } else {
      room.players[idx].eliminated = true;
      room.players[idx].isConnected = false;
    }

    socket.leave(room.code);

    if (wasHost) {
      const nextHost = chooseNextHost(room);
      room.hostId = nextHost ? nextHost.id : null;
    }

    broadcastLobby(room);
    if (room.started) broadcastGamePlayers(room);

    if (!room.started && room.players.every((p) => p.isBot)) {
      clearBotTimer(room);
      delete rooms[room.code];
      return;
    }

    if (!room.started && room.players.length === 0) {
      clearBotTimer(room);
      delete rooms[room.code];
    }
  });

  socket.on('lobby:ready', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room || room.started) return;

    const p = room.players.find((x) => x.id === socket.id);
    if (!p || p.isBot) return;

    p.isReady = !!payload.isReady;
    broadcastLobby(room);
  });

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

  socket.on('game:start', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room || room.started) return;

    if (room.hostId !== socket.id) {
      return roomError(socket, 'Only the host can start the game.', 'NOT_HOST');
    }

    const connected = room.players.filter((p) => p.isConnected);
    if (connected.length < 3) {
      return roomError(socket, 'Need at least 3 total players (humans + bots) to start.', 'NOT_ENOUGH_PLAYERS');
    }

    const allReady = connected.every((p) => p.isReady || p.isBot);
    if (!allReady) {
      return roomError(socket, 'All human players must be ready.', 'NOT_READY');
    }

    room.started = true;
    room.ended = false;

    room.players.forEach((p) => {
      p.eliminated = false;
      if (p.isBot) p.isReady = true;
    });

    dealCards(room);
    room.state.currentAsk = null;
    room.state.turnIndex = Math.max(0, room.players.findIndex((p) => p.id === room.hostId));

    io.to(room.code).emit('game:started', {
      roomCode: room.code,
      roomName: room.name,
      startedAt: nowISO(),
    });

    broadcastGamePlayers(room);
    emitTurn(room);

    room.players.forEach((p) => {
      if (!p.isBot) {
        io.to(p.id).emit('game:hand', { cards: cardsForPlayer(room, p.id) });
      }
    });
  });

  socket.on('game:ask', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room || !room.started || room.ended) return;

    const st = room.state;
    const asker = room.players[st.turnIndex];

    if (!asker || asker.id !== socket.id) {
      return roomError(socket, 'Not your turn.', 'NOT_YOUR_TURN');
    }

    if (asker.isBot) {
      return roomError(socket, 'Bots control their own turns.', 'BOT_TURN');
    }

    if (st.currentAsk) {
      return roomError(socket, 'An ask is already in progress.', 'ASK_IN_PROGRESS');
    }

    const assumption = {
      suspect: String(payload.suspect || ''),
      weapon: String(payload.weapon || ''),
      room: String(payload.room || ''),
    };

    if (!suspects.includes(assumption.suspect)) {
      return roomError(socket, 'Invalid suspect.', 'BAD_INPUT');
    }
    if (!weapons.includes(assumption.weapon)) {
      return roomError(socket, 'Invalid weapon.', 'BAD_INPUT');
    }
    if (!roomsList.includes(assumption.room)) {
      return roomError(socket, 'Invalid room.', 'BAD_INPUT');
    }

    const targetId = payload.targetPlayerId ? String(payload.targetPlayerId) : null;
    startAsk(room, asker, assumption, targetId);
  });

  socket.on('game:showCard', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room || !room.started || room.ended) return;

    const st = room.state;
    const ask = st.currentAsk;
    if (!ask) return;

    if (ask.currentPromptId !== socket.id) {
      return socket.emit('game:showCard:invalid', {
        message: 'It is not your turn to respond.',
      });
    }

    const responder = room.players.find((p) => p.id === socket.id);
    if (!responder || responder.isBot) return;

    const matches = matchingCards(cardsForPlayer(room, responder.id), ask.assumption);
    const cardName = payload.cardName ? String(payload.cardName) : null;

    if (cardName) {
      if (!matches.includes(cardName)) {
        return socket.emit('game:showCard:invalid', {
          message: 'You can only show a matching card that you actually have.',
        });
      }

      io.to(ask.fromId).emit('game:cardRevealed', {
        fromPlayerId: responder.id,
        fromPlayerName: responder.name,
        cardName,
      });

      io.to(room.code).emit('game:cardShown', {
        fromPlayerId: responder.id,
        fromPlayerName: responder.name,
      });

      learnFromResolvedAsk(room, {
        fromId: ask.fromId,
        assumption: ask.assumption,
        promptedPlayerIds: [...ask.promptedPlayerIds],
        responderId: responder.id,
        revealedCardName: cardName,
      });

      room.state.currentAsk = null;
      room.state.turnIndex = nextActiveTurnIndex(room, room.state.turnIndex);
      emitTurn(room);
      return;
    }

    if (matches.length > 0) {
      return socket.emit('game:showCard:invalid', {
        message: 'You have a matching card. You must show one of them.',
      });
    }

    promptNext(room);
  });

  socket.on('game:accuse', (payload = {}) => {
    const room = getRoom(payload.roomCode);
    if (!room || !room.started || room.ended) return;

    const accuser = room.players.find((p) => p.id === socket.id);
    if (!accuser) return;

    if (accuser.eliminated) {
      return roomError(socket, 'You are eliminated and can only spectate.', 'SPECTATOR');
    }

    if (accuser.isBot) {
      return roomError(socket, 'Bots control their own accusations.', 'BOT_PLAYER');
    }

    const answer = {
      suspect: String(payload.suspect || ''),
      weapon: String(payload.weapon || ''),
      room: String(payload.room || ''),
    };

    executeAccusation(room, accuser, answer);
  });

  socket.on('disconnect', () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];
      const p = room.players.find((x) => x.id === socket.id);
      if (!p) continue;

      p.isConnected = false;

      if (!room.started) {
        if (room.hostId === socket.id) {
          const nextHost = chooseNextHost(room);
          room.hostId = nextHost ? nextHost.id : null;
        }
        broadcastLobby(room);
      } else {
        broadcastGamePlayers(room);

        if (room.state.currentAsk && room.state.currentAsk.currentPromptId === socket.id) {
          promptNext(room);
        }

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
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});