const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');




const app = express();
app.use(express.static('__dirname'));
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static(path.join(__dirname, 'public')));

// Define a route to serve your HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const rooms = {};
const players = {};
let turn =1

let promptResponsesCounter = 0;
const suspects = ["Miss Scarlett", "Colonel Mustard", "Mr. White", "Dr. Green", "Mrs. Peacock", "Professor Plum"];
const weapons = ["Candlestick", "Dagger", "Lead Pipe", "Revolver", "Rope", "Wrench"];
const gameRooms = ["Kitchen", "Ballroom", "Conservatory", "Dining Room", "Billiard Room", "Library", "Lounge", "Hall", "Study"];
let responses = [];
let playerassumption;
let removedCards = {}
turn2 = undefined;
let deactivatedPlayers = [];


// Combine all cards
// const allCardNames = [...suspects, ...weapons, ...gameRooms];

io.on('connection', (socket) => {
  console.log(`Player ${socket.id} connected`);

  socket.on('createRoom', () => {
    const uid = generateUID();
    const playerName = `Player 1`;
    rooms[uid] = [{ id: socket.id, name: `Player 1` }];

    console.log(`Room created with UID: ${uid}`);
    socket.join(uid);
    // console.log(`Ryou are: ${playerName}`);
    socket.emit('roomCreated', uid);
  });

  socket.on('joinRoom', (uid) => {
    if (rooms[uid]) {
      const playerNumber = rooms[uid].length + 1;
      rooms[uid].push({ id: socket.id, name: `Player ${playerNumber}` });
      socket.join(uid);
      console.log(`Player ${socket.id} joined room ${uid}`);
    } else {
      socket.emit('roomNotFound');
    }
  });

  socket.on('startGame', (uid) => {
    if (rooms[uid]) {
      const playersInRoom = rooms[uid];
      const playerNames = playersInRoom.map(player => player.name);
      console.log('playerinroom' ,playersInRoom)
      console.log('playerName',playerNames)
      currentTurn = 1;
      turn = 1

      // Send player names to the client
      io.to(uid).emit('playerNames', playerNames);
      io.to(uid).emit('updateTurn', { turn, playerName: playersInRoom[turn - 1].name, uid }); // Pass uid here
      console.log(turn)
      turn2 = undefined;
      // Distribute cards
       const cards = distributeCards(uid, playersInRoom.length);

playersInRoom.forEach((player, index) => {
  io.to(player.id).emit('receiveCards', { playerNameIndivisual: player.name, cards: cards[`Player ${index + 1}`] });
  console.log('individual card', cards[`Player ${index + 1}`]);
});


      io.to(uid).emit('hideJoinButton');
    }
  });
  function sendPromptToNextPlayer(uid, assumption) {
    const playersInRoom = rooms[uid];
    const currentPlayerId = socket.id; // Get the current player's ID
    const currentPlayerIndex = (turn - 1) % playersInRoom.length; // Get the index of the current player
    console.log(currentPlayerIndex)
    // const turn2 = (currentPlayerIndex + 1) % playersInRoom.length;
    if ((typeof turn2 === 'undefined')){
      console.log('I am here')
       turn2 = (currentPlayerIndex)
    }
    console.log('innerturn',turn2)

    console.log(turn);
    let nextPlayerIndex = (turn2+1) % playersInRoom.length;
    console.log(nextPlayerIndex)
    const nextPlayer = playersInRoom[nextPlayerIndex];
    console.log(nextPlayer)

    if (nextPlayer.id !== currentPlayerId){
        io.to(nextPlayer.id).emit('promptPlayer', assumption);
    }
    turn2 = nextPlayerIndex
  }

  socket.on('sendAssumption', (uid, assumption) => {
    console.log('Received assumption with UID:', uid);
      if (rooms[uid]) {
          const playersInRoom = rooms[uid];
          console.log('Received assumption from client:', assumption);
          playerassumption = assumption;

          // Emit the assumption to all other players in the same room
          socket.to(uid).emit('receiveAssumption', { assumption,playerName: playersInRoom[turn - 1].name });

          console.log('Sent assumption to other players:', assumption);
          sendPromptToNextPlayer(uid, assumption);

      } else {
          // If room is not found, emit an error event
          socket.emit('updateTurnError', 'Room not found.');
      }
  });
function checkForCard(playerName){
  const playerCards = cards[playerName];
  const selectedValues = Object.values(playerassumption);
  for (const card of selectedValues) {
    console.log(card)
    console.log(playerCards)


 if (playerCards.includes(card)) {

   return false; // Player has at least one of the selected cards, so return true
 }
}
return true
}


socket.on('playerResponse', (uid, response) => {
  if (rooms[uid]) {
    const playersInRoom = rooms[uid];
    console.log(response)
    let hasSelectedCards; // Declare the variable here
    let firstNonSkipCardResponse;
    // let currentPlayerId;
    innerCurrentPlayerId = playersInRoom.find(player => player.name === response.playerName).id;


    if (response.selectedCard[0] !== 'Skip') {
        hasSelectedCards = checkPlayerCards(response.playerName, response.selectedCard[0]); // Assign value without 'let'
    } else {
      console.log('hey')
        hasSelectedCards = checkForCard(response.playerName);
    }




if (hasSelectedCards){    // Append the response to the list of responses
    responses.push(response);
    console.log(responses,'hey')

    io.to(innerCurrentPlayerId).emit('correctSubmission');



    // Check if responses from all players have been received
    if (responses.length === playersInRoom.length - 1) { // Assuming each player except the current player responds
      // Find the first non-skip card
      const firstNonSkipCardResponse = responses.find(response => response.selectedCard[0] !== 'Skip');
      console.log(firstNonSkipCardResponse)

      // If a non-skip card is found
      if (firstNonSkipCardResponse){

         playerName = firstNonSkipCardResponse.playerName;
         firstNonSkipCard = firstNonSkipCardResponse.selectedCard[0];
      }
      else {
        console.log('here')
        firstNonSkipCard = 'undefined';
        playerName = 'No one'

      }
        const currentPlayerIndex = turn - 1; //turn =2,cpi=1
        let nextIndex = (currentPlayerIndex+1) % playersInRoom.length;//ni=2

      // Get the ID of the player whose turn it is
        currentPlayerId = playersInRoom[currentPlayerIndex].id;
        if ((typeof firstNonSkipCard === 'undefined')){
          console.log('yes')
           firstNonSkipCard = 'undefined';
           playerName = 'No one'
        }

        // Emit playerName and the first non-skip card found
        io.to(currentPlayerId).emit('playerResponse', {playerName, card: firstNonSkipCard});
        io.to(uid).emit('playerResponseAll',{playerName});

      turn = (turn % playersInRoom.length) + 1;
      // console.log(deactivatedPlayers.includes(playersInRoom[nextIndex].name))
      if (deactivatedPlayers.includes(playersInRoom[nextIndex].name)) {
          turn = (turn % playersInRoom.length) + 1;
      }



     io.to(uid).emit('updateTurn', { turn, playerName: playersInRoom[turn - 1].name});

     console.log('Updated turn:', turn);

      // Reset the responses array for the next prompt
      responses = [];
      turn2 = undefined;

    }
    else{
        sendPromptToNextPlayer(uid, playerassumption);
        console.log("here")
    }
  } else {
        io.to(innerCurrentPlayerId).emit('wrongSubmition');
        console.log("lost")
  }
}else {
    // If room is not found, emit an error event
    socket.emit('updateTurnError', 'Room not found.');
  }
});


function checkPlayerCards(playerName,selectedCard){
    // if cards[playerName].includes(selectedCards.values)
    const playerCards = cards[playerName];
    console.log(cards)
    // const selectedValues = Object.values(selectedCards);
    // for (const card of selectedValues) {
   if (playerCards.includes(selectedCard)) {
     console.log(playerCards.includes(selectedCard))
     return true; // Player has at least one of the selected cards, so return true
 }
 return false

}

socket.on('checkGuess',(uid, response)=>{
  if (rooms[uid]) {
    const playersInRoom = rooms[uid];
    const removedCardsString = JSON.stringify(removedCards);
    const answerString = JSON.stringify(response.answer);

    if (removedCardsString == answerString){
      console.log('hurray')
       io.to(uid).emit("winner",{playerName:response.playerNameIndivisual})
    }
    else{

      deactivatedPlayers.push(response.playerNameIndivisual)
      console.log(turn)
        turn = (turn % playersInRoom.length) + 1;
      io.to(uid).emit("loser",{playerName:response.playerNameIndivisual})
      io.to(uid).emit('updateTurn', { turn, playerName: playersInRoom[turn - 1].name});
    }

  }

});




  socket.on('disconnect', () => {
    // Handle player disconnection
    for (const uid in rooms) {
      const index = rooms[uid].findIndex(player => player.id === socket.id);
      if (index !== -1) {
        rooms[uid].splice(index, 1);
        console.log(`Player ${socket.id} disconnected from room ${uid}`);
        break;
      }
    }
  });
});

function generateUID() {
  return Math.random().toString(36).substr(2, 6);
}



// Update distributeCards function to use card names
// Update distributeCards function to remove one card from each category
function distributeCards(uid, totalPlayers) {
  // Shuffle the cards
  const shuffledSuspects = shuffle([...suspects]);
  const shuffledWeapons = shuffle([...weapons]);
  const shuffledRooms = shuffle([...gameRooms]);

  // Remove one card from each category
  const removedSuspect = shuffledSuspects.pop();
  const removedWeapon = shuffledWeapons.pop();
  const removedRoom = shuffledRooms.pop();

  // Combine the remaining cards
  const remainingCards = [...shuffledSuspects, ...shuffledWeapons, ...shuffledRooms];

  // Shuffle the remaining cards again
  const shuffledRemainingCards = shuffle(remainingCards);

  // Calculate the number of cards per player
  const cardsPerPlayer = Math.floor(shuffledRemainingCards.length / totalPlayers);

  // Distribute cards to players
  cards = {};
  let cardIndex = 0; // Track the index of shuffled remaining cards

  for (let i = 0; i < totalPlayers; i++) {
    cards[`Player ${i + 1}`] = shuffledRemainingCards.slice(cardIndex, cardIndex + cardsPerPlayer);

    cardIndex += cardsPerPlayer;
  }
  console.log(cards)

  // Store the removed cards in the room
  rooms[uid].removedCards = {
    suspect: removedSuspect,
    weapon: removedWeapon,
    room: removedRoom
  };

  removedCards = {
    suspect: removedSuspect,
    weapon: removedWeapon,
    room: removedRoom
  }

  // Console log the removed cards
  console.log('Removed Cards:', rooms[uid].removedCards);

  return cards;
}
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
