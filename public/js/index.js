const socket = io();

let playerNames;
let cards;
const suspects = ["Miss Scarlett", "Colonel Mustard", "Mrs. White", "Mr. Green", "Mrs. Peacock", "Professor Plum"];
const weapons = ["Candlestick", "Dagger", "Lead Pipe", "Revolver", "Rope", "Wrench"];
const gameRooms = ["Kitchen", "Ballroom", "Conservatory", "Dining Room", "Billiard Room", "Library", "Lounge", "Hall", "Study"];
let uid; // Declare uid here
let playerNameIndivisual;
let playerName;
let assumption;
let gameUid;

// Combine all cards
const allCardNames = [...suspects, ...weapons, ...gameRooms];

// To create rooms
document.getElementById('createRoomBtn').addEventListener('click', () => {
  socket.emit('createRoom');
  document.getElementById('joinRoomBtn').classList.add('hidden');
});

// To join rooms
document.getElementById('joinRoomBtn').addEventListener('click', () => {
  uid = prompt('Enter Room UID:');
  if (uid) {
    socket.emit('joinRoom', uid);
    document.getElementById('createRoomBtn').classList.add('hidden');
    document.getElementById('startGameBtn').classList.add('hidden');
  } else {
    console.error('Invalid UID entered.');
  }
});


socket.on('playerNames', (receivedPlayerNames) => {
  console.log('Player names:', receivedPlayerNames);

  // Assign the received player names to the variable
  playerNames = receivedPlayerNames;

  // Display player names on the monitor
  const playerNamesDisplay = document.getElementById('playerNamesDisplay');
});
socket.on('receiveCards', (data) => {
  console.log('Received cards:', data);
  // const allCardNames = [...new Set(Object.values(cards).flat())];

  playerNameIndivisual = data.playerNameIndivisual;
  const cards = data.cards;
  playerNamesDisplay.innerHTML = `You are <strong>${playerNameIndivisual}</strong>`;

  recievedCards = cards;
  playerCards.innerText = cards;
  // console.log(allCardNames);
  createDynamicTable(allCardNames, playerNames);
   createCards(cards);
  // You can add logic here to display the cards on the client side
});

function createCards(cards) {
  const cardsContainer = document.getElementById('cardsContainer');
  cardsContainer.innerHTML = ''; // Clear previous cards

  cards.forEach(card => {
    const cardElement = document.createElement('div');
    cardElement.classList.add('card');

    const cardTitle = document.createElement('h3');
    cardTitle.classList.add('card-title');
    cardTitle.textContent = card;

    const cardContent = document.createElement('p');
    cardContent.classList.add('card-content');
    cardContent.textContent = 'Card description goes here...'; // You can replace this with actual card description

    cardElement.appendChild(cardTitle);
    cardElement.appendChild(cardContent);

    cardsContainer.appendChild(cardElement);
  });
}




// To start game, hide buttons and show dropdown to player1
document.getElementById('startGameBtn').addEventListener('click', () => {
  uid = prompt('Enter Room UID to start the game:'); // Set uid here


  if (uid) {
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
  } else {
    console.error('Invalid UID entered.');
  }
});

socket.on('hideJoinButton', () => {
  // Hide the "Join Room" button on all devices
  document.getElementById('joinRoomBtn').classList.add('hidden');
  document.getElementById('createRoomBtn').classList.add('hidden');
  document.getElementById('startGameBtn').classList.add('hidden');
if (gameUid){
  gameUid.innerHTML = ''
}
  // document.getElementById('nextTurnBtn').classList.remove('hidden');
  console.log(playerNameIndivisual)
  if (playerNameIndivisual === 'Player 1'){
    document.getElementById('final').classList.remove('hidden');
    document.getElementById('nextTurnBtn').classList.remove('hidden');
    dropdownContainer = document.getElementById('dropdowns');
    const suspectDropdown = createDropdown('suspects', suspects);
    const weaponDropdown = createDropdown('weapons', weapons);
    const roomDropdown = createDropdown('gameRooms', gameRooms);

    dropdownContainer.appendChild(suspectDropdown);
    dropdownContainer.appendChild(weaponDropdown);
    dropdownContainer.appendChild(roomDropdown);
    console.log(uid)
  }
});

socket.on('roomCreated', (data) => {
  uid = data;
  console.log(`Room created with UID: ${uid}`);

  // Create a <h1> element to display the UID
  gameUid = document.getElementById('uidGiven')
  gameUid.innerHTML = 'Give the following code to your friends who want to join the game:<br>' + uid;

  // Append the <h1> element to the document body
  document.body.appendChild(uidGiven);
});


socket.on('roomNotFound', () => {
  alert('Room not found. Please check the UID and try again.');
});



function createDynamicTable(playerNames, allcardNames) {
  const table = document.getElementById('playerCardsTable');
  table.innerHTML = '';
  table.border = "1";

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

// Update the 'nextTurnBtn' click event listener
document.getElementById('nextTurnBtn').addEventListener('click', () => {


    // Fetch dropdown elements
    const dropdownContainer = document.getElementById('dropdowns');

    const suspectDropdown = document.getElementById('suspects');
    const weaponDropdown = document.getElementById('weapons');
    const roomDropdown = document.getElementById('gameRooms');


    // Check if any dropdown element is null and if uid is defined
    if (uid && suspectDropdown && weaponDropdown && roomDropdown) {
        // Get selected values from dropdowns
        const selectedSuspect = suspectDropdown.value;
        const selectedWeapon = weaponDropdown.value;
        const selectedRoom = roomDropdown.value;

        // Create assumption object
        const assumption = {
            suspect: selectedSuspect,
            weapon: selectedWeapon,
            room: selectedRoom
        };
        console.log('Assumption:', assumption);

        // Emit assumption to server
        socket.emit('sendAssumption', uid, assumption);
        console.log('Sent assumption to server:', assumption);

    } else {
        console.error('One or more dropdown elements not found or UID is undefined.');
    }

})
// Add a listener to receive the updated turn from the server
socket.on('updateTurn', (data) => {
    console.log('Received updated turn:', data);

    // Update the turn display or perform any necessary actions based on the updated turn
    turn = data.turn;
    const playerName = data.playerName;
    // Example: Update UI to display whose turn it is
    if (playerNameIndivisual === 'Player ' + turn) {
        // Create and append dropdowns for suspects, weapons, and game rooms
        const dropdownContainer = document.getElementById('dropdowns');
        const suspectDropdown = createDropdown('suspects', suspects);
        const weaponDropdown = createDropdown('weapons', weapons);
        const roomDropdown = createDropdown('gameRooms', gameRooms);

        dropdownContainer.appendChild(suspectDropdown);
        dropdownContainer.appendChild(weaponDropdown);
        dropdownContainer.appendChild(roomDropdown);


  document.getElementById('nextTurnBtn').classList.remove('hidden');
  document.getElementById('final').classList.remove('hidden');

}
  else {
    const dropdownContainer = document.getElementById('dropdowns');
    dropdownContainer.innerHTML = '';
  document.getElementById('nextTurnBtn').classList.add('hidden');
  document.getElementById('final').classList.add('hidden');
  document.getElementById('question').classList.add('hidden');

  }

 currentAssumption = document.getElementById('assumptions')
 currentAssumption.innerHTML = ''
});

// Add an error handler to catch any 'updateTurn' errors
socket.on('updateTurnError', (error) => {
    console.error('Error updating turn:', error);
    // Handle the error appropriately, such as displaying an error message to the user
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

socket.on('receiveAssumption', (data) => {
  console.log('Received assumption from server:', data);
  guesser = data.playerName;
  guess = data.assumption
     document.getElementById('assumptions').innerHTML = `<strong>${guesser}</strong> thinks ${guess.suspect} killed with ${guess.weapon} in ${guess.room}`



  // Handle the received assumption as needed
  // For example, update UI to display the assumption information
});

socket.on('promptPlayer', (prompt) => {
  console.log('Received prompt:', prompt);

  // Create a div element to hold the checkboxes
  const checkboxContainer = document.createElement('div');

  // Add a class to the container for styling
  checkboxContainer.classList.add('checkbox-container');

  // Create a checkbox for each card mentioned in the prompt
  document.getElementById('question').classList.remove('hidden');

  const cards = ['suspect', 'weapon', 'room'];
  cards.forEach(card => {
    const checkbox = document.createElement('input');
    checkbox.type = 'radio';
    checkbox.name = 'card';
    checkbox.value = prompt[card];
    checkbox.id = prompt[card];
    const label = document.createElement('label');
    label.htmlFor = card;
    label.appendChild(document.createTextNode(`${card}: ${prompt[card]}`));
    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(label);
    checkboxContainer.appendChild(document.createElement('br'));
  });

  // Add a "Skip" option
  const skipCheckbox = document.createElement('input');
  skipCheckbox.type = 'radio';
  skipCheckbox.name = 'card';
  skipCheckbox.value = 'Skip';
  skipCheckbox.id = 'Skip';
  const skipLabel = document.createElement('label');
  skipLabel.htmlFor = 'Skip';
  skipLabel.appendChild(document.createTextNode('Skip'));
  checkboxContainer.appendChild(skipCheckbox);
  checkboxContainer.appendChild(skipLabel);
  checkboxContainer.appendChild(document.createElement('br'));

  // Add a submit button
  const submitButton = document.createElement('button');
  submitButton.innerText = 'Submit';
  submitButton.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('input[type="radio"]:checked');
    const selectedCards = Array.from(checkboxes).map(checkbox => checkbox.value);
    const playerName = playerNameIndivisual; // Assuming you have playerNameIndivisual defined
    console.log('Selected cards:', selectedCards);
    // Emit the player's response to the server with player name
    socket.emit('playerResponse', uid, { playerName, selectedCards });
    // Clear the checkbox container
    checkboxContainer.innerHTML = '';
    // Hide the question
    document.getElementById('question').classList.add('hidden');
  });
  // Initially disable the submit button
  submitButton.disabled = true;
  checkboxContainer.appendChild(submitButton);

  // Append the checkbox container to the document body
  document.body.appendChild(checkboxContainer);

  // Add event listeners to radio buttons to enable submit button when checked
  const radioButtons = document.querySelectorAll('input[type="radio"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
      submitButton.disabled = false;
    });
  });
});



// Event listener for player response to the prompt
socket.on('playerResponseAll', (data) => {
  console.log('Received player response:', data.playerName);
  document.getElementById('reply').innerHTML = `<strong>${data.playerName}</strong> has showed a card`


  // Handle the player's response as needed
  // For example, update UI to display the response
});

socket.on('playerResponse', (data) => {
  console.log('Received player response:', data.playerName,data.card);
  if (data.card === 'undefined'){
      document.getElementById('reply1').innerHTML = `None has a clue`
  }else{
  document.getElementById('reply1').innerHTML = `<strong>${data.playerName}</strong> has ${data.card}`
}

  // Handle the player's response as needed
  // For example, update UI to display the response
});

document.getElementById('final').addEventListener('click', () => {
  console.log("clicked me")
  const suspectDropdown = document.getElementById('suspects');
  const weaponDropdown = document.getElementById('weapons');
  const roomDropdown = document.getElementById('gameRooms');

  const selectedSuspect = suspectDropdown.value;
  const selectedWeapon = weaponDropdown.value;
  const selectedRoom = roomDropdown.value;

  const answer = {
      suspect: selectedSuspect,
      weapon: selectedWeapon,
      room: selectedRoom
  };
  console.log(answer)

socket.emit('checkGuess', uid, { playerNameIndivisual, answer });
});

socket.on('winner',(data)=>{
  console.log(data)
  alert(`${data.playerName} won the game`)
    document.getElementById('game').classList.add('hidden');

})
