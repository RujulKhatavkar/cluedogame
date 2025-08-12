// app.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
// ✅ correct static path
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = socketIO(server);

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ------------------------ Game Data ------------------------
const rooms = {}; // { uid: [ {id, name}, ... ], state: {...} }

const suspects = ["Miss Scarlett", "Colonel Mustard", "Mr. White", "Dr. Green", "Mrs. Peacock", "Professor Plum"];
const weapons  = ["Candlestick", "Knife", "Lead Pipe", "Revolver", "Rope", "Wrench"];
const gameRooms = ["Kitchen", "Ballroom", "Conservatory", "Dining Room", "Billiard Room", "Library", "Lounge", "Hall", "Study"];

// Per-room state helper
function state(uid){
  const room = rooms[uid];
  if (!room.state){
    room.state = {
      turn: 1,                // 1-based
      promptIndex: null,      // last prompted player index (0-based)
      responses: [],          // responses for current assumption
      deactivated: new Set(), // names that are out
      cardsByPlayer: {},      // { "Player 1": [cards...] }
      assumption: null,       // { suspect, weapon, room }
      removed: null,          // hidden solution
      awaiting: false         // expecting responses in current round
    };
  }
  return room.state;
}

// ------------------------ Socket.IO ------------------------
io.on('connection', (socket) => {
  console.log(`Player ${socket.id} connected`);

  // Create room
  socket.on('createRoom', () => {
    const uid = generateUID();
    rooms[uid] = [{ id: socket.id, name: 'Player 1' }];
    socket.join(uid);
    console.log(`Room created with UID: ${uid}`);
    socket.emit('roomCreated', uid);
  });

  // Join room
  socket.on('joinRoom', (uid) => {
    if (!rooms[uid]) return socket.emit('roomNotFound');
    const playerNumber = rooms[uid].length + 1;
    rooms[uid].push({ id: socket.id, name: `Player ${playerNumber}` });
    socket.join(uid);
    console.log(`Player ${socket.id} joined room ${uid}`);
  });

  // Start game
  socket.on('startGame', (uid) => {
    if (!rooms[uid]) return;
    const playersInRoom = rooms[uid];

    // init state
    const st = state(uid);
    st.turn = 1;
    st.promptIndex = null;
    st.responses = [];
    st.deactivated = new Set();
    st.assumption = null;
    st.awaiting = false;

    // deal cards & store per-room
    const dealt = distributeCards(uid, playersInRoom.length);
    st.cardsByPlayer = dealt;

    // send players + initial turn
    io.to(uid).emit('playerNames', playersInRoom.map(p => p.name));
    io.to(uid).emit('updateTurn', { turn: st.turn, playerName: playersInRoom[st.turn - 1].name, uid });

    // send each player their cards
    playersInRoom.forEach((player, index) => {
      io.to(player.id).emit('receiveCards', {
        playerNameIndivisual: player.name,
        cards: dealt[`Player ${index + 1}`]
      });
    });

    io.to(uid).emit('hideJoinButton');
  });

  // New assumption from current player
  socket.on('sendAssumption', (uid, assumption) => {
    if (!rooms[uid]) return socket.emit('updateTurnError', 'Room not found.');
    const playersInRoom = rooms[uid];
    const st = state(uid);

    st.assumption = assumption;
    st.responses = [];
    st.promptIndex = null;
    st.awaiting = true;

    const askerName = playersInRoom[st.turn - 1].name;
    socket.to(uid).emit('receiveAssumption', { assumption, playerName: askerName });
    sendPromptToNextPlayer(uid, assumption, askerName);
  });

  // A player responded to the prompt
  socket.on('playerResponse', (uid, response) => {
    if (!rooms[uid]) return socket.emit('updateTurnError', 'Room not found.');
    const playersInRoom = rooms[uid];
    const st = state(uid);
    if (!st.awaiting) return; // ignore late/stale replies

    const responder = playersInRoom.find(p => p.name === response.playerName);
    const responderId = responder ? responder.id : null;

    const hasCard = (name, card) => (st.cardsByPlayer[name] || []).includes(card);

    const ok = (response.selectedCard[0] !== 'Skip')
      ? hasCard(response.playerName, response.selectedCard[0])
      : !Object.values(st.assumption || {}).some(c => hasCard(response.playerName, c)); // Skip valid only if no matching card

    if (ok){
      st.responses.push(response);
      if (responderId) io.to(responderId).emit('correctSubmission');

      if (st.responses.length >= expectedResponders(uid)){
        return finishPromptRound(uid);
      }
      const askerName = playersInRoom[st.turn - 1].name;
      sendPromptToNextPlayer(uid, st.assumption, askerName);
    } else {
      if (responderId) io.to(responderId).emit('wrongSubmition'); // keep original event name
    }
  });

  // Final guess check
  socket.on('checkGuess', (uid, { playerNameIndivisual, answer }) => {
    if (!rooms[uid]) return;

    const st = state(uid);
    if (JSON.stringify(answer) === JSON.stringify(st.removed)){
      io.to(uid).emit('winner', { playerName: playerNameIndivisual });
      return;
    }

    // wrong guess → deactivate player & reset round state
    st.deactivated.add(playerNameIndivisual);
    st.responses = [];
    st.promptIndex = null;
    st.assumption = null;
    st.awaiting = false;

    const playersInRoom = rooms[uid];

    // advance to next active player
    let next = st.turn;
    for (let i = 0; i < playersInRoom.length; i++){
      next = (next % playersInRoom.length) + 1;
      if (!st.deactivated.has(playersInRoom[next - 1].name)) break;
    }
    st.turn = next;

    io.to(uid).emit('loser', { playerName: playerNameIndivisual });
    io.to(uid).emit('updateTurn', { turn: st.turn, playerName: playersInRoom[st.turn - 1].name });
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    for (const uid in rooms){
      const idx = rooms[uid].findIndex(p => p.id === socket.id);
      if (idx !== -1){
        const name = rooms[uid][idx].name;
        const st = state(uid);
        st.deactivated.add(name);

        const playersInRoom = rooms[uid];
        // if it was their turn, advance to next active
        if (playersInRoom.length){
          if (st.turn - 1 === idx){
            for (let i = 0; i < playersInRoom.length; i++){
              st.turn = (st.turn % playersInRoom.length) + 1;
              if (!st.deactivated.has(playersInRoom[st.turn - 1].name)) break;
            }
            io.to(uid).emit('updateTurn', { turn: st.turn, playerName: playersInRoom[st.turn - 1].name });
          }
        }
        console.log(`Player ${socket.id} disconnected from room ${uid}`);
        break;
      }
    }
  });
});

// ------------------------ Turn/Prompt Helpers ------------------------
function sendPromptToNextPlayer(uid, assumption, askerName){
  const playersInRoom = rooms[uid];
  const st = state(uid);
  let idx = (st.promptIndex == null ? (st.turn - 1) : st.promptIndex);

  for (let i = 0; i < playersInRoom.length; i++){
    idx = (idx + 1) % playersInRoom.length;
    const next = playersInRoom[idx];
    if (next.name !== askerName && !st.deactivated.has(next.name)){
      io.to(next.id).emit('promptPlayer', assumption);
      st.promptIndex = idx;
      return;
    }
  }
  // nobody eligible → finish round immediately
  finishPromptRound(uid);
}

function expectedResponders(uid){
  const players = rooms[uid];
  const st = state(uid);
  const asker = players[st.turn - 1].name;
  return players.filter(p => p.name !== asker && !st.deactivated.has(p.name)).length;
}

function finishPromptRound(uid){
  const players = rooms[uid];
  const st = state(uid);

  const first = st.responses.find(r => r.selectedCard[0] !== 'Skip');
  const card = first ? first.selectedCard[0] : 'undefined';
  const who  = first ? first.playerName    : 'No one';

  const currentId = players[st.turn - 1].id;
  io.to(currentId).emit('playerResponse', { playerName: who, card });
  io.to(uid).emit('playerResponseAll', { playerName: who });

  // advance to next active player
  let next = st.turn;
  for (let i = 0; i < players.length; i++){
    next = (next % players.length) + 1;
    if (!st.deactivated.has(players[next - 1].name)) break;
  }
  st.turn = next;

  // reset round state
  st.promptIndex = null;
  st.responses = [];
  st.assumption = null;
  st.awaiting = false;

  io.to(uid).emit('updateTurn', { turn: st.turn, playerName: players[st.turn - 1].name });
}

// ------------------------ Dealing ------------------------
function distributeCards(uid, totalPlayers) {
  const shuffledSuspects = shuffle([...suspects]);
  const shuffledWeapons  = shuffle([...weapons]);
  const shuffledRooms    = shuffle([...gameRooms]);

  // remove one from each category (solution)
  const removedSuspect = shuffledSuspects.pop();
  const removedWeapon  = shuffledWeapons.pop();
  const removedRoom    = shuffledRooms.pop();

  const remainingCards = [...shuffledSuspects, ...shuffledWeapons, ...shuffledRooms];
  const shuffledRemainingCards = shuffle(remainingCards);

  const cards = {};
  const cardsPerPlayer = Math.floor(shuffledRemainingCards.length / totalPlayers);
  let cardIndex = 0;

  for (let i = 0; i < totalPlayers; i++) {
    cards[`Player ${i + 1}`] = shuffledRemainingCards.slice(cardIndex, cardIndex + cardsPerPlayer);
    cardIndex += cardsPerPlayer;
  }

  // keep solution in per-room state
  state(uid).removed = { suspect: removedSuspect, weapon: removedWeapon, room: removedRoom };
  console.log('Removed Cards (solution):', state(uid).removed);

  return cards;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ------------------------ Utils & Server ------------------------
function generateUID() {
  return Math.random().toString(36).substring(2, 8);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
