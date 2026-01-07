/**
 * Table Display Logic - Image-based Fog of War
 */

// State
let ws = null;
let sessionId = null;
let currentMode = 'blank';

// Map state - image-based fog
let mapImage = null;        // Image object
let mapImageSrc = null;     // Base64 map image
let fogDataCanvas = null;   // Offscreen canvas for fog
let fogCtx = null;          // Context for fog canvas

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
  initInteractionListeners(); // Add listeners
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
    // Auto-join the active session
    ws.autoJoinSession();
  });

  // Handle server errors (e.g. no session yet)
  ws.on('error', (data) => {
    if (data.code === 'NO_SESSION') {
      // Update UI to show waiting state
      const statusText = document.querySelector('#join-screen .animate-pulse p');
      if (statusText) statusText.textContent = 'Waiting for GM to start session...';

      // Retry after 2 seconds
      setTimeout(() => {
        if (ws && ws.connected && !sessionId) {
          ws.autoJoinSession();
        }
      }, 2000);
    } else {
      console.error('Server error:', data);
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
        // Initialize fog canvas
        if (!fogDataCanvas) {
          fogDataCanvas = document.createElement('canvas');
          fogCtx = fogDataCanvas.getContext('2d');
        }
        fogDataCanvas.width = mapImage.width;
        fogDataCanvas.height = mapImage.height;

        // Load fog mask after map loads
        if (data.fogMask) {
          const fogImg = new Image();
          fogImg.onload = () => {
            fogCtx.clearRect(0, 0, fogDataCanvas.width, fogDataCanvas.height);
            fogCtx.drawImage(fogImg, 0, 0);
            resetViewport(); // Reset fit on load
          };
          fogImg.src = data.fogMask;
        } else {
          // Default to full black if no mask
          fogCtx.fillStyle = '#000000';
          fogCtx.fillRect(0, 0, fogDataCanvas.width, fogDataCanvas.height);
          resetViewport();
        }
      };
      mapImage.src = data.mapImage;
    }
    setDisplayMode('map');
  });

  ws.on('map:fogUpdate', (data) => {
    // Update the entire fog mask
    if (data.fogMask) {
      const fogImg = new Image();
      fogImg.onload = () => {
        if (fogCtx) {
          fogCtx.clearRect(0, 0, fogDataCanvas.width, fogDataCanvas.height);
          fogCtx.drawImage(fogImg, 0, 0);
          renderMap();
        }
      };
      fogImg.src = data.fogMask;
    }
  });

  ws.on('map:fogPartial', (data) => {
    if (!fogDataCanvas || !fogCtx) return;

    const chunkImg = new Image();
    chunkImg.onload = () => {
      fogCtx.drawImage(chunkImg, data.x, data.y);
      renderMap();
    };
    chunkImg.src = data.chunk;
  });

  ws.on('map:clear', () => {
    // Clear map and fog
    mapImage = null;
    fogDataCanvas = null;
    fogCtx = null;
    mapImageSrc = null;
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
  // No join button needed - auto-join on connect
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

// Viewport State
let viewport = {
  scale: 1,
  x: 0,
  y: 0,
  rotation: 0
};

// Constants
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

// === VIEWPORT TRANSFORM FUNCTIONS ===

// Convert screen coordinates to canvas coordinates
function screenToCanvas(clientX, clientY) {
  const canvas = elements.mapCanvas;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

// Apply viewport transform to a canvas context
function applyViewportTransform(ctx) {
  ctx.translate(viewport.x, viewport.y);
  ctx.scale(viewport.scale, viewport.scale);
  ctx.rotate(viewport.rotation * Math.PI / 180);
}

// Zoom centered on a specific screen point
function zoomAtPoint(clientX, clientY, scaleFactor) {
  const pt = screenToCanvas(clientX, clientY);

  // Calculate world point under cursor before zoom
  // worldX = (screenX - viewportX) / scale
  const worldX = (pt.x - viewport.x) / viewport.scale;
  const worldY = (pt.y - viewport.y) / viewport.scale;

  // Update scale
  const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.scale * scaleFactor));

  // Adjust viewport to keep world point under cursor
  // newViewportX = screenX - worldX * newScale
  viewport.x = pt.x - worldX * newScale;
  viewport.y = pt.y - worldY * newScale;
  viewport.scale = newScale;

  renderMap();
}

function resetViewport() {
  if (!mapImage) return;

  const canvas = elements.mapCanvas;
  // Fit map to canvas
  const scale = Math.min(
    canvas.width / mapImage.width,
    canvas.height / mapImage.height
  );

  viewport.scale = scale;
  // Center map
  viewport.x = (canvas.width - mapImage.width * scale) / 2;
  viewport.y = (canvas.height - mapImage.height * scale) / 2;
  viewport.rotation = 0;

  renderMap();
}

// Map Rendering - Image-based fog of war
function renderMap() {
  const canvas = elements.mapCanvas;
  const ctx = canvas.getContext('2d');

  // Clear canvas with dark background
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform for clear
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

  // Draw scene with viewport transform
  ctx.save();
  applyViewportTransform(ctx);

  // Draw the map image (at 0,0 in world space)
  ctx.drawImage(mapImage, 0, 0);

  // Apply fog mask on top
  if (fogDataCanvas) {
    ctx.drawImage(fogDataCanvas, 0, 0);
  } else {
    // No fog mask yet = everything hidden (solid black)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, mapImage.width, mapImage.height);
  }

  // Draw figures on top of fog
  if (figures && figures.length > 0) {
    ctx.globalCompositeOperation = 'source-over';
    drawFigures(ctx, figures);
  }

  ctx.restore();
}

// Draw figures on table display
function drawFigures(ctx, figures) {
  figures.forEach(figure => {
    // In world space, easy!
    const x = figure.position.x;
    const y = figure.position.y;
    // Scale figure size slightly with zoom but not 1:1 to avoid tiny/huge icons
    // Actually, keeping them world-scale is usually best for maps,
    // but maybe we want a minimum visible size? 
    // For now, let's keep them fixed world size (20px radius base)
    const radius = 20;

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
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw number or POI symbol
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

// Interaction Event Listeners
function initInteractionListeners() {
  const canvas = elements.mapCanvas;

  // Mouse Wheel Zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomAtPoint(e.clientX, e.clientY, scaleFactor);
  }, { passive: false });

  // Mouse Drag Pan
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      // Adjust viewport (taking canvas scaling into account)
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      viewport.x += deltaX * scaleX;
      viewport.y += deltaY * scaleY;
      renderMap();
    }
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'default';
  });

  // Touch Gestures (Pinch/Pan)
  let initialPinchDistance = null;
  let initialPinchZoom = null;
  let initialPinchCenter = null;
  let initialViewportX = null;
  let initialViewportY = null;
  let lastTouchX = 0;
  let lastTouchY = 0;
  let fingerCount = 0;

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    fingerCount = e.touches.length;

    if (fingerCount === 1) {
      // Pan start
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    } else if (fingerCount === 2) {
      // Pinch start
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      initialPinchDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      initialPinchZoom = viewport.scale;
      initialPinchCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };
      initialViewportX = viewport.x;
      initialViewportY = viewport.y;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();

    if (e.touches.length === 1 && fingerCount === 1) {
      // Single finger pan
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const deltaX = touchX - lastTouchX;
      const deltaY = touchY - lastTouchY;
      lastTouchX = touchX;
      lastTouchY = touchY;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      viewport.x += deltaX * scaleX;
      viewport.y += deltaY * scaleY;
      renderMap();

    } else if (e.touches.length === 2 && initialPinchDistance) {
      // Pinch Zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      // Calculate new scale
      const zoomRatio = currentDistance / initialPinchDistance;
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialPinchZoom * zoomRatio));

      // Calculate center point logic (zoom towards center)
      // This is simplified pinch zoom logic
      const currentCenter = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      };

      // We want to keep the point under the pinch center stable relative to the world

      // Get internal canvas coords of initial center
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const initialCanvasX = (initialPinchCenter.x - rect.left) * scaleX;
      const initialCanvasY = (initialPinchCenter.y - rect.top) * scaleY;

      // World point at initial center
      const worldX = (initialCanvasX - initialViewportX) / initialPinchZoom;
      const worldY = (initialCanvasY - initialViewportY) / initialPinchZoom;

      // Current canvas coords
      const currentCanvasX = (currentCenter.x - rect.left) * scaleX;
      const currentCanvasY = (currentCenter.y - rect.top) * scaleY;

      // New viewport pos: currentCanvas - world * newScale
      viewport.x = currentCanvasX - worldX * newScale;
      viewport.y = currentCanvasY - worldY * newScale;
      viewport.scale = newScale;

      renderMap();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    fingerCount = e.touches.length;
    if (fingerCount === 0) {
      initialPinchDistance = null;
    }
    // Update last touch pos if we go from 2->1 fingers to avoid jump
    if (fingerCount === 1) {
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  });

  // Double tap to reset
  let lastTap = 0;
  canvas.addEventListener('touchend', (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 500 && tapLength > 0 && e.touches.length === 0) {
      // Check if it was a double tap or drag
      if (!isDragging) {
        // Send Ping on double tap/click
        const touch = e.changedTouches[0];
        handlePing(touch.clientX, touch.clientY);
      }
      e.preventDefault();
    }
    lastTap = currentTime;
  });

  // Mouse double click for desktop ping
  canvas.addEventListener('dblclick', (e) => {
    handlePing(e.clientX, e.clientY);
  });
}

// === PING SYSTEM ===
let lastPingTime = 0;
const PING_COOLDOWN = 500; // 0.5 seconds

function handlePing(screenX, screenY) {
  const now = Date.now();
  if (now - lastPingTime < PING_COOLDOWN) {
    return; // Rate limit
  }

  // Convert to world coordinates
  const pt = screenToCanvas(screenX, screenY);
  const worldX = (pt.x - viewport.x) / viewport.scale;
  const worldY = (pt.y - viewport.y) / viewport.scale;

  // Send to server
  if (ws && sessionId) {
    ws.send('map:ping', { x: worldX, y: worldY });
    lastPingTime = now;

    // Show local visual feedback (ripple)
    showPingRipple(screenX, screenY);
  }
}

function showPingRipple(x, y) {
  const ripple = document.createElement('div');
  ripple.className = 'ping-ripple';
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  document.body.appendChild(ripple);

  // Animation handled by CSS
  setTimeout(() => ripple.remove(), 1000);
}

// UI Controls
function createUIControls() {
  const container = document.createElement('div');
  container.className = 'fixed bottom-4 right-4 flex gap-2 z-50';

  const resetBtn = document.createElement('button');
  resetBtn.className = 'bg-gray-800 text-amber-500 p-3 rounded-full shadow-lg border border-amber-900/50 hover:bg-gray-700 active:scale-95 transition-all';
  resetBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
    </svg>
  `;
  resetBtn.title = 'Reset Zoom';
  resetBtn.onclick = resetViewport;

  container.appendChild(resetBtn);
  document.body.appendChild(container);
}

// Initialize UI after load
document.addEventListener('DOMContentLoaded', () => {
  createUIControls();
});

