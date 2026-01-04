/**
 * Table Display Logic - Image-based Fog of War
 */

// State
let ws = null;
let sessionId = null;
let currentMode = 'blank';

// Map state - image-based fog
let mapImage = null;        // Image object
let fogMaskImage = null;    // Image object for fog mask
let mapImageSrc = null;     // Base64 map image
let fogMaskSrc = null;      // Base64 fog mask

// Figure state
let figures = [];

// DOM Elements
const elements = {
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  joinScreen: document.getElementById('join-screen'),
  mainDisplay: document.getElementById('main-display'),
  joinCodeInput: document.getElementById('join-code-input'),
  joinBtn: document.getElementById('join-btn'),
  joinError: document.getElementById('join-error'),
  mapCanvas: document.getElementById('map-canvas'),
  handoutImage: document.getElementById('handout-image'),
  decisionTitle: document.getElementById('decision-title'),
  decisionOptions: document.getElementById('decision-options'),
  puzzleContainer: document.getElementById('puzzle-container'),
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  initEventListeners();
  resizeCanvas();
});

// Handle window resize
window.addEventListener('resize', () => {
  resizeCanvas();
  if (currentDungeon) {
    renderMap();
  }
});

function resizeCanvas() {
  const canvas = elements.mapCanvas;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// WebSocket Setup
function initWebSocket() {
  ws = new WSClient();

  ws.on('connected', () => {
    updateConnectionStatus(true);

    // Check for join code in URL and auto-join
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      elements.joinCodeInput.value = codeParam.toUpperCase();
      joinSession();
    }
  });

  ws.on('disconnected', () => {
    updateConnectionStatus(false);
  });

  ws.on('session:joined', (data) => {
    sessionId = data.sessionId;
    showMainDisplay();
  });

  ws.on('display:mode', (data) => {
    setDisplayMode(data.mode);
  });

  // New image-based map events
  ws.on('map:state', (data) => {
    // Load map image
    if (data.mapImage) {
      mapImageSrc = data.mapImage;
      mapImage = new Image();
      mapImage.onload = () => {
        // Load fog mask after map loads
        if (data.fogMask) {
          fogMaskSrc = data.fogMask;
          fogMaskImage = new Image();
          fogMaskImage.onload = () => renderMap();
          fogMaskImage.src = data.fogMask;
        } else {
          renderMap();
        }
      };
      mapImage.src = data.mapImage;
    }
    setDisplayMode('map');
  });

  ws.on('map:fogUpdate', (data) => {
    // Update just the fog mask
    if (data.fogMask) {
      fogMaskSrc = data.fogMask;
      fogMaskImage = new Image();
      fogMaskImage.onload = () => renderMap();
      fogMaskImage.src = data.fogMask;
    }
  });

  ws.on('map:clear', () => {
    // Clear map and fog
    mapImage = null;
    fogMaskImage = null;
    mapImageSrc = null;
    fogMaskSrc = null;
    renderMap();
  });

  ws.on('figures:update', (data) => {
    figures = data.figures || [];
    if (currentMode === 'map') {
      renderMap();
    }
  });

  ws.on('figures:clear', () => {
    figures = [];
    if (currentMode === 'map') {
      renderMap();
    }
  });

  ws.on('handout:display', (data) => {
    elements.handoutImage.src = data.imageUrl;
    setDisplayMode('handout');
  });

  ws.on('handout:clear', () => {
    setDisplayMode('map');
  });

  ws.on('decision:display', (data) => {
    showDecision(data);
    setDisplayMode('decision');
  });

  ws.on('decision:clear', () => {
    setDisplayMode('map');
  });

  ws.on('puzzle:display', (data) => {
    showPuzzle(data);
    setDisplayMode('puzzle');
  });

  ws.on('error', (data) => {
    console.error('Server error:', data);
    elements.joinError.textContent = data.message;
    elements.joinError.classList.remove('hidden');
  });

  ws.connect();
}

// Event Listeners
function initEventListeners() {
  // Join session
  elements.joinBtn.addEventListener('click', joinSession);

  elements.joinCodeInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      joinSession();
    }
  });

  // Auto-uppercase join code
  elements.joinCodeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
}

function joinSession() {
  const code = elements.joinCodeInput.value.trim().toUpperCase();
  if (code.length !== 6) {
    elements.joinError.textContent = 'Please enter a 6-character code';
    elements.joinError.classList.remove('hidden');
    return;
  }

  elements.joinError.classList.add('hidden');
  ws.joinSession(code);
}

// UI Updates
function updateConnectionStatus(connected) {
  elements.statusDot.className = `w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`;
  elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';
}

function showMainDisplay() {
  elements.joinScreen.classList.add('hidden');
  elements.mainDisplay.classList.remove('hidden');
}

function setDisplayMode(mode) {
  currentMode = mode;

  // Hide all display modes
  document.querySelectorAll('.display-mode').forEach(el => {
    el.classList.add('hidden');
  });

  // Show the selected mode
  const displayEl = document.getElementById(`display-${mode}`);
  if (displayEl) {
    displayEl.classList.remove('hidden');
  }
}

// Map Rendering - Image-based fog of war
function renderMap() {
  const canvas = elements.mapCanvas;
  const ctx = canvas.getContext('2d');

  // Clear canvas with dark background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // If no map image, show empty
  if (!mapImage) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#666';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Waiting for map...', canvas.width / 2, canvas.height / 2);
    return;
  }

  // Calculate scale to fit map in canvas while maintaining aspect ratio
  const scale = Math.min(
    canvas.width / mapImage.width,
    canvas.height / mapImage.height
  );

  const scaledWidth = mapImage.width * scale;
  const scaledHeight = mapImage.height * scale;
  const offsetX = (canvas.width - scaledWidth) / 2;
  const offsetY = (canvas.height - scaledHeight) / 2;

  // Draw the map image
  ctx.drawImage(mapImage, offsetX, offsetY, scaledWidth, scaledHeight);

  // Apply fog mask on top
  // The fog mask is black where hidden, transparent where revealed
  if (fogMaskImage) {
    ctx.drawImage(fogMaskImage, offsetX, offsetY, scaledWidth, scaledHeight);
  } else {
    // No fog mask yet = everything hidden (solid black)
    ctx.fillStyle = '#000000';
    ctx.fillRect(offsetX, offsetY, scaledWidth, scaledHeight);
  }

  // Draw figures on top of fog - reset composite operation to ensure figures appear on top
  if (figures && figures.length > 0) {
    ctx.globalCompositeOperation = 'source-over';
    drawFigures(ctx, figures, offsetX, offsetY, scale);
  }
}

// Draw figures on table display
function drawFigures(ctx, figures, offsetX, offsetY, scale) {
  figures.forEach(figure => {
    // Transform canvas coords to display coords
    const x = figure.position.x * scale + offsetX;
    const y = figure.position.y * scale + offsetY;
    const radius = 20 * scale;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // Draw colored circle
    ctx.fillStyle = figure.type === 'enemy' ? '#ef4444' :
                    figure.type === 'player' ? '#22c55e' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw white border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Draw number or POI symbol (use star instead of emoji for reliability)
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${radius * 1.2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (figure.type === 'poi') {
      ctx.fillText('★', x, y);
    } else {
      ctx.fillText(figure.number, x, y);
    }

    ctx.restore();
  });
}

// Decision Display
function showDecision(data) {
  elements.decisionTitle.textContent = data.title;
  elements.decisionOptions.innerHTML = data.options.map((opt, i) => `
    <div class="decision-option bg-gray-800 hover:bg-gray-700 p-6 rounded-xl text-3xl font-bold transition-colors cursor-pointer border-2 border-gray-700">
      <span class="text-amber-400 mr-4">${i + 1}.</span>
      ${opt.text}
    </div>
  `).join('');
}

// Puzzle Display
function showPuzzle(data) {
  const { type, data: puzzleData } = data;

  let html = '';

  switch (type) {
    case 'choice':
      html = `
        <h2 class="text-4xl font-bold mb-8 text-amber-400">${puzzleData.question}</h2>
        <div class="grid gap-4 max-w-2xl mx-auto">
          ${puzzleData.options.map((opt, i) => `
            <button class="puzzle-option bg-gray-800 hover:bg-gray-700 p-6 rounded-xl text-2xl font-bold transition-colors border-2 border-gray-700"
                    data-index="${i}">
              ${opt}
            </button>
          `).join('')}
        </div>
      `;
      break;

    case 'riddle':
      html = `
        <h2 class="text-4xl font-bold mb-4 text-amber-400">Riddle</h2>
        <p class="text-2xl mb-8 text-gray-300">${puzzleData.question}</p>
        ${puzzleData.hint ? `<p class="text-xl text-gray-500 mb-8">Hint: ${puzzleData.hint}</p>` : ''}
        <input type="text" id="riddle-answer-input"
               class="w-full max-w-lg text-center text-3xl bg-gray-800 border-2 border-gray-700 rounded-lg p-4"
               placeholder="Type your answer...">
        <button id="submit-riddle" class="mt-6 bg-amber-600 hover:bg-amber-500 px-8 py-4 rounded-lg text-xl font-bold">
          Submit Answer
        </button>
      `;
      break;

    case 'sequence':
      html = `
        <h2 class="text-4xl font-bold mb-4 text-amber-400">Sequence</h2>
        <p class="text-2xl mb-8 text-gray-300">${puzzleData.instruction}</p>
        <div id="sequence-items" class="flex flex-wrap justify-center gap-4 mb-8">
          ${puzzleData.items.map((item, i) => `
            <div class="sequence-item bg-gray-800 hover:bg-gray-700 p-6 rounded-xl text-xl cursor-pointer border-2 border-gray-700"
                 data-index="${i}">
              ${item}
            </div>
          `).join('')}
        </div>
        <div id="sequence-selected" class="flex flex-wrap justify-center gap-2 min-h-16 bg-gray-900 p-4 rounded-lg">
          <span class="text-gray-600">Click items in order...</span>
        </div>
        <button id="submit-sequence" class="mt-6 bg-amber-600 hover:bg-amber-500 px-8 py-4 rounded-lg text-xl font-bold">
          Submit Sequence
        </button>
      `;
      break;

    case 'lockedDoor':
      html = `
        <div class="locked-door-puzzle">
          <div class="door-frame bg-gradient-to-b from-amber-900 to-amber-950 p-8 rounded-lg border-4 border-amber-700 max-w-2xl mx-auto">
            <h2 class="text-4xl font-bold mb-2 text-amber-400 text-center">${puzzleData.title}</h2>
            <p class="text-gray-400 text-center mb-6">Touch the symbols in the correct order</p>

            <div class="door-symbols flex justify-center gap-4 mb-8">
              ${puzzleData.symbols.map(s => `
                <button class="door-symbol w-20 h-20 text-5xl bg-gray-800 hover:bg-gray-700 rounded-lg border-2 border-gray-600 transition-all"
                        data-symbol="${s.id}">
                  ${s.display}
                </button>
              `).join('')}
            </div>

            <div id="door-input-display" class="flex justify-center gap-2 min-h-16 bg-gray-900 p-4 rounded-lg mb-6">
              <span class="text-gray-500 text-xl">Touch symbols above...</span>
            </div>

            <div class="flex gap-4 justify-center">
              <button id="clear-door-input" class="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg text-lg">
                Clear
              </button>
              <button id="submit-door" class="bg-amber-600 hover:bg-amber-500 px-8 py-3 rounded-lg text-xl font-bold">
                Try Lock
              </button>
            </div>
          </div>

          <div id="door-result" class="hidden mt-8 text-center">
            <div id="door-success" class="hidden">
              <div class="text-6xl mb-4">🔓</div>
              <h3 class="text-4xl font-bold text-green-400">Door Unlocked!</h3>
            </div>
            <div id="door-failure" class="hidden">
              <div class="text-6xl mb-4">🔒</div>
              <h3 class="text-4xl font-bold text-red-400">Wrong Combination</h3>
              <p class="text-gray-400 mt-2">Try again...</p>
            </div>
          </div>
        </div>
      `;
      break;
  }

  elements.puzzleContainer.innerHTML = html;

  // Add event listeners for puzzle interactions
  if (type === 'choice') {
    document.querySelectorAll('.puzzle-option').forEach(btn => {
      btn.addEventListener('click', () => {
        ws.send('puzzle:submit', {
          puzzleId: data.id,
          answer: parseInt(btn.dataset.index),
        });
      });
    });
  } else if (type === 'riddle') {
    document.getElementById('submit-riddle')?.addEventListener('click', () => {
      const answer = document.getElementById('riddle-answer-input').value;
      ws.send('puzzle:submit', {
        puzzleId: data.id,
        answer: answer,
      });
    });
  } else if (type === 'sequence') {
    const selectedOrder = [];
    document.querySelectorAll('.sequence-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        if (!selectedOrder.includes(index)) {
          selectedOrder.push(index);
          item.classList.add('bg-amber-700', 'border-amber-500');
          updateSequenceDisplay(data.data.items, selectedOrder);
        }
      });
    });

    document.getElementById('submit-sequence')?.addEventListener('click', () => {
      ws.send('puzzle:submit', {
        puzzleId: data.id,
        answer: selectedOrder,
      });
    });
  } else if (type === 'lockedDoor') {
    const doorInput = [];
    const symbolsData = data.data.symbols;

    document.querySelectorAll('.door-symbol').forEach(btn => {
      btn.addEventListener('click', () => {
        const symbol = btn.dataset.symbol;
        doorInput.push(symbol);

        // Visual feedback
        btn.classList.add('scale-90');
        setTimeout(() => btn.classList.remove('scale-90'), 100);

        updateDoorInputDisplay(symbolsData, doorInput);
      });
    });

    document.getElementById('clear-door-input')?.addEventListener('click', () => {
      doorInput.length = 0;
      updateDoorInputDisplay(symbolsData, doorInput);
      // Hide any result
      document.getElementById('door-result').classList.add('hidden');
    });

    document.getElementById('submit-door')?.addEventListener('click', () => {
      // Check locally first for instant feedback
      const correct = JSON.stringify(doorInput) === JSON.stringify(data.data.correctSequence);

      document.getElementById('door-result').classList.remove('hidden');

      if (correct) {
        document.getElementById('door-success').classList.remove('hidden');
        document.getElementById('door-failure').classList.add('hidden');
        // Disable further input
        document.querySelectorAll('.door-symbol').forEach(b => b.disabled = true);
      } else {
        document.getElementById('door-success').classList.add('hidden');
        document.getElementById('door-failure').classList.remove('hidden');
        // Clear input after wrong answer
        setTimeout(() => {
          doorInput.length = 0;
          updateDoorInputDisplay(symbolsData, doorInput);
        }, 1500);
      }

      // Also send to server
      ws.send('puzzle:submit', {
        puzzleId: data.id,
        answer: doorInput.slice(), // Send copy
      });
    });
  }
}

function updateDoorInputDisplay(symbols, input) {
  const container = document.getElementById('door-input-display');
  if (input.length === 0) {
    container.innerHTML = '<span class="text-gray-500 text-xl">Touch symbols above...</span>';
  } else {
    const symbolMap = {};
    symbols.forEach(s => { symbolMap[s.id] = s.display; });

    container.innerHTML = input.map(id => `
      <span class="text-4xl">${symbolMap[id]}</span>
    `).join('');
  }
}

function updateSequenceDisplay(items, order) {
  const container = document.getElementById('sequence-selected');
  if (order.length === 0) {
    container.innerHTML = '<span class="text-gray-600">Click items in order...</span>';
  } else {
    container.innerHTML = order.map((i, pos) => `
      <div class="bg-amber-700 px-4 py-2 rounded text-lg">
        ${pos + 1}. ${items[i]}
      </div>
    `).join('');
  }
}
