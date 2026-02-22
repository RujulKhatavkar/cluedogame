const socket = io();

let playerNames;
let cards;
const suspects = ["Miss Scarlett", "Colonel Mustard", "Mrs. White", "Mr. Green", "Mrs. Peacock", "Professor Plum"];
const weapons = ["Candlestick", "Dagger", "Lead Pipe", "Revolver", "Rope", "Wrench"];
const gameRooms = ["Kitchen", "Ballroom", "Conservatory", "Dining Room", "Billiard Room", "Library", "Lounge", "Hall", "Study"];
let uid; // Declare uid here
let playerNameIndivisual;
let playerName;

// Combine all cards
const allCardNames = [...suspects, ...weapons, ...gameRooms];

document.getElementById('createRoomBtn').addEventListener('click', () => {
  socket.emit('createRoom');
});

document.getElementById('joinRoomBtn').addEventListener('click', () => {
  uid = prompt('Enter Room UID:'); // Set uid here
  socket.emit('joinRoom', uid);
});

document.getElementById('startGameBtn').addEventListener('click', () => {
  uid = prompt('Enter Room UID to start the game:'); // Set uid here

  socket.emit('startGame', uid);
  const elementsToHide = [
    document.getElementById('createRoomBtn'),
    document.getElementById('joinRoomBtn'),
    document.getElementById('startGameBtn')
  ];

  elementsToHide.forEach(element => {
    if (element) {
      element.classList.add('hidden');
    }
  });
  const dropdownContainer = document.getElementById('dropdowns');
  const suspectDropdown = createDropdown('suspects', suspects);
  const weaponDropdown = createDropdown('weapons', weapons);
  const roomDropdown = createDropdown('gameRooms', gameRooms);

  dropdownContainer.appendChild(suspectDropdown);
  dropdownContainer.appendChild(weaponDropdown);
  dropdownContainer.appendChild(roomDropdown);
});

// document.getElementById('nextTurnBtn').addEventListener('click', () => {
//   const suspectDropdown = document.getElementById('suspects');
//   const weaponDropdown = document.getElementById('weapons');
//   const roomDropdown = document.getElementById('rooms');
//
//   const selectedSuspect = suspectDropdown.value;
//   const selectedWeapon = weaponDropdown.value;
//   // const selectedRoom = roomDropdown.value;
//
//   socket.emit('nextTurn', uid, {
//     suspect: selectedSuspect,
//     weapon: selectedWeapon,
//     // room: selectedRoom
//   });
//
//   console.log("hello")
//
// });
//

socket.on('hideJoinButton', () => {
  // Hide the "Join Room" button on all devices
  document.getElementById('joinRoomBtn').classList.add('hidden');
  document.getElementById('createRoomBtn').classList.add('hidden');
  document.getElementById('startGameBtn').classList.add('hidden');
  document.getElementById('nextTurnBtn').classList.remove('hidden');

});


socket.on('roomCreated', (data) => {
  uid = data.uid;
  playerName = data.playerName;
  console.log(`Room created with UID: ${uid}`);
  console.log(`You are ${playerName}`);
});
socket.on('playerNames', (receivedPlayerNames) => {
  console.log('Player names:', receivedPlayerNames);

  // Assign the received player names to the variable

  playerNames = receivedPlayerNames;

  // Display player names on the monitor
  const playerNamesDisplay = document.getElementById('playerNamesDisplay');
  console.log(playerNames);
});

socket.on('receiveCards', (data) => {
  console.log('Received cards:', data);
  // const allCardNames = [...new Set(Object.values(cards).flat())];

  playerNameIndivisual = data.playerNameIndivisual;
  const cards = data.cards
  playerNamesDisplay.innerHTML = `You are <strong>${playerNameIndivisual}</strong>`;

  recievedCards = cards;
  playerCards.innerText = cards
  // console.log(allCardNames);
  createDynamicTable(allCardNames, playerNames);
  // You can add logic here to display the cards on the client side
});



socket.on('roomNotFound', () => {
  alert('Room not found. Please check the UID and try again.');
});

function createDynamicTable(playerNames, allcardNames) {
  const table = document.getElementById('playerCardsTable');
  table.innerHTML = '';
  table.border = "1"

  // Create header row with player names
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = '<th>Card Names</th>' + allcardNames.map(cardName => `<th>${cardName}</th>`).join('');
  table.appendChild(headerRow);

  // Create rows for each card
  playerNames.forEach((playerName) => {
    const row = document.createElement('tr');
    row.innerHTML = `<td>${playerName}</td>` + allcardNames.map(() => '<td></td>').join('');
    table.appendChild(row);
  });
}
const playerCardsTable = document.getElementById('playerCardsTable');

// Event delegation for dynamic table
playerCardsTable.addEventListener('click', function (event) {
  const target = event.target;
  console.log('clicked');

  if (target.innerText === '') {
    target.setAttribute('isempty', 'true');
  }

  // Check if the clicked element is a td (table cell) and has no content
  if (target.tagName === 'TD' && target.getAttribute('isempty') === 'true') {
    const currentState = target.getAttribute('data-state') || 'empty';

    // Toggle between correct icon and cross
    console.log(target.getAttribute('currentState'))
    switch (currentState) {
      case 'empty':
        target.innerHTML = '<i class="correct-icon">✔️</i>';
        target.setAttribute('data-state', 'correct');
        break;
      case 'correct':
        target.innerHTML = '<i class="cross-icon">❌</i>';
        target.setAttribute('data-state', 'doubt');
        break;
      case 'doubt':
        target.innerHTML = '<i class="cross-icon">🟡</i>';
        target.setAttribute('data-state', 'cross');
        break;
      case 'cross':
        target.innerHTML = '';
        target.removeAttribute('data-state');
        break;
      default:
        break;
    }
  }
});

// CSS for styling the icons
// You can customize the styling based on your requirements
const style = document.createElement('style');
style.innerHTML = `
  .correct-icon {
    color: green;
  }

  .cross-icon {
    color: red;
  }

  .selected {
    cursor: pointer;
  }`;
  // Update 'updateTurn' event handler to show dropdowns only to the player whose turn it is
  socket.on('updateTurn', (data) => {
      console.log('Turn updated:', data);
      turn = data.turn;
      const playerName = data.playerName;

      // Remove existing dropdowns
      const dropdownContainer = document.getElementById('dropdowns');
      dropdownContainer.innerHTML = '';

      // Check if it's the player's turn
      console.log(playerName, 'Player ', turn)
      if (playerName === 'Player ' + turn) {
          // Create and append dropdowns for suspects, weapons, and game rooms

          const suspectDropdown = createDropdown('suspects', suspects);
          const weaponDropdown = createDropdown('weapons', weapons);
          const roomDropdown = createDropdown('gameRooms', gameRooms);

          dropdownContainer.appendChild(suspectDropdown);
          dropdownContainer.appendChild(weaponDropdown);
          dropdownContainer.appendChild(roomDropdown);
      }
  });

  // Update 'nextTurnBtn' event listener to emit selected values to everyone
  document.getElementById('nextTurnBtn').addEventListener('click', () => {
      const suspectDropdown = document.getElementById('suspects');
      const weaponDropdown = document.getElementById('weapons');
      const roomDropdown = document.getElementById('gameRooms');


      const selectedSuspect = suspectDropdown.value;
      const selectedWeapon = weaponDropdown.value;
      const selectedRoom = roomDropdown.value;
      const assumption = {
        // Assuming you have values for suspect, weapon, and room
        suspect: selectedSuspect,
        weapon : selectedWeapon,
        room : selectedRoom
    };
    console.log(assumption)

      socket.emit('sendAssumption', uid, assumption);

      // Emit selected values to everyone
      socket.emit('nextTurn', uid, {
          suspect: selectedSuspect,
          weapon: selectedWeapon,
          room: selectedRoom
      });
  });
  function createDropdown(name, options) {
      const dropdown = document.createElement('select');
      dropdown.name = name;
      dropdown.id = name;

      options.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.text = option;
          dropdown.add(optionElement);
      });

      return dropdown;
  }
