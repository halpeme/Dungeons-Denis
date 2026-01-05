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

