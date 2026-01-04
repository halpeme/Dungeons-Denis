/**
 * GM Controller Logic - Image-based Fog of War
 */

// State
let ws = null;
let sessionId = null;
let gmToken = null;
let joinCode = null;

// Map/Fog state
let mapImage = null;
let mapCanvas = null;
let mapCtx = null;
let fogCanvas = null;
let fogCtx = null;
let fogDataCanvas = null;  // Offscreen canvas for fog data (used for transforms)
let fogDataCtx = null;
let previewCanvas = null;
let previewCtx = null;
let previewDataCanvas = null;  // Offscreen canvas for preview data
let previewDataCtx = null;
let brushSize = 40;
let isRevealing = true; // true = reveal, false = hide
let isDrawing = false;
let hasPreview = false; // true when there's pending reveal preview

// Viewport state (for canvas-based zoom/pan)
const viewport = {
  x: 0,        // Pan offset X (in screen pixels)
  y: 0,        // Pan offset Y (in screen pixels)
  scale: 1,    // Zoom level (0.5 to 3)
  rotation: 0  // Rotation in degrees (0, 90, 180, 270)
};
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

// Pan/Draw mode state
let isDrawMode = false;  // false = pan mode (when zoomed), true = draw mode
let isPanning = false;
let lastPanX = 0;
let lastPanY = 0;

// Figure state
let figureCanvas = null;
let figureCtx = null;
let figures = []; // Confirmed figures
let previewFigure = null; // Figure being dragged/placed
let isDraggingFigure = false;
let draggedFigureId = null; // If moving existing figure
let figurePointerStart = null; // Track pointer start for click vs drag
const DRAG_THRESHOLD = 10; // Pixels to distinguish click from drag

// Preset maps from Splittermond
const presetMaps = [
  // City Maps (Arakea)
  { id: 'askalas-traum', name: 'Askalas Traum', category: 'City', path: '/maps/presets/askalas-traum.jpg' },
  { id: 'eisenbrann', name: 'Eisenbrann', category: 'City', path: '/maps/presets/eisenbrann.jpg' },
  { id: 'fulnia', name: 'Fulnia', category: 'City', path: '/maps/presets/fulnia.jpg' },
  { id: 'gondalis', name: 'Gondalis', category: 'City', path: '/maps/presets/gondalis.jpg' },
  { id: 'nuum', name: 'Nuum', category: 'City', path: '/maps/presets/nuum.jpg' },
  { id: 'talaberis', name: 'Talaberis', category: 'City', path: '/maps/presets/talaberis.jpg' },
  // City Maps (Binnenmeere)
  { id: 'aldentrutz', name: 'Aldentrutz', category: 'City', path: '/maps/presets/aldentrutz.jpg' },
  { id: 'garstal', name: 'Garstal', category: 'City', path: '/maps/presets/garstal.jpg' },
  { id: 'herathis', name: 'Herathis', category: 'City', path: '/maps/presets/herathis.jpg' },
  { id: 'jaldisruh', name: 'Jaldisruh', category: 'City', path: '/maps/presets/jaldisruh.jpg' },
  { id: 'kyningswacht', name: 'Kyningswacht', category: 'City', path: '/maps/presets/kyningswacht.jpg' },
  { id: 'sarnburg', name: 'Sarnburg', category: 'City', path: '/maps/presets/sarnburg.jpg' },
  { id: 'suedfang', name: 'Südfang', category: 'City', path: '/maps/presets/suedfang.jpg' },
  { id: 'sunnafest', name: 'Sunnafest', category: 'City', path: '/maps/presets/sunnafest.jpg' },
  // City Maps (Takasadu)
  { id: 'esmoda', name: 'Esmoda', category: 'City', path: '/maps/presets/esmoda.jpg' },
  { id: 'inani', name: 'Inani', category: 'City', path: '/maps/presets/inani.jpg' },
  { id: 'palitan', name: 'Palitan', category: 'City', path: '/maps/presets/palitan.jpg' },
  { id: 'sentatau', name: 'Sentatau', category: 'City', path: '/maps/presets/sentatau.jpg' },
  // City Maps (Pash-Anar)
  { id: 'ezteraad', name: 'Ezteraad', category: 'City', path: '/maps/presets/ezteraad.jpg' },
  { id: 'fedir', name: 'Fedir', category: 'City', path: '/maps/presets/fedir.jpg' },
  { id: 'khanbur', name: 'Khanbur', category: 'City', path: '/maps/presets/khanbur.jpg' },
  { id: 'lanrim', name: 'Lanrim', category: 'City', path: '/maps/presets/lanrim.jpg' },
  { id: 'ranah', name: 'Ranah', category: 'City', path: '/maps/presets/ranah.jpg' },
  { id: 'shinshamassu', name: 'Shinshamassu', category: 'City', path: '/maps/presets/shinshamassu.jpg' },
  { id: 'tar-shalaaf', name: 'Tar-Shalaaf', category: 'City', path: '/maps/presets/tar-shalaaf.jpg' },
  { id: 'vaipur', name: 'Vaipur', category: 'City', path: '/maps/presets/vaipur.jpg' },
  { id: 'wuestentrutz', name: 'Wüstentrutz', category: 'City', path: '/maps/presets/wuestentrutz.jpg' },
  // Regional Maps
  { id: 'arkurien', name: 'Arkurien', category: 'Region', path: '/maps/presets/arkurien.jpg' },
  { id: 'badashan', name: 'Badashan', category: 'Region', path: '/maps/presets/badashan.jpg' },
  { id: 'dakardsmyr', name: 'Dakardsmyr', category: 'Region', path: '/maps/presets/dakardsmyr.jpg' },
  { id: 'elyrea', name: 'Elyrea', category: 'Region', path: '/maps/presets/elyrea.jpg' },
  { id: 'farukan', name: 'Farukan', category: 'Region', path: '/maps/presets/farukan.jpg' },
  { id: 'flammensenke', name: 'Flammensenke', category: 'Region', path: '/maps/presets/flammensenke.jpg' },
  { id: 'mahaluu-archipel', name: 'Mahaluu Archipel', category: 'Region', path: '/maps/presets/mahaluu-archipel.jpg' },
  { id: 'mertalischer-staedtebund', name: 'Mertalischer Städtebund', category: 'Region', path: '/maps/presets/mertalischer-staedtebund.jpg' },
  { id: 'pangawai', name: 'Pangawai', category: 'Region', path: '/maps/presets/pangawai.jpg' },
  { id: 'patalis', name: 'Patalis', category: 'Region', path: '/maps/presets/patalis.jpg' },
  { id: 'sadu', name: 'Sadu', category: 'Region', path: '/maps/presets/sadu.jpg' },
  { id: 'selenia', name: 'Selenia', category: 'Region', path: '/maps/presets/selenia.jpg' },
  { id: 'suderinseln', name: 'Suderinseln', category: 'Region', path: '/maps/presets/suderinseln.jpg' },
  { id: 'surmakar', name: 'Surmakar', category: 'Region', path: '/maps/presets/surmakar.jpg' },
  { id: 'tar-kesh', name: 'Tar-Kesh', category: 'Region', path: '/maps/presets/tar-kesh.jpg' },
  { id: 'turubar', name: 'Turubar', category: 'Region', path: '/maps/presets/turubar.jpg' },
  { id: 'ungebrochen', name: 'Ungebrochen', category: 'Region', path: '/maps/presets/ungebrochen.jpg' },
  { id: 'unreich', name: 'Unreich', category: 'Region', path: '/maps/presets/unreich.jpg' },
  { id: 'wandernde-waelder', name: 'Wandernde Wälder', category: 'Region', path: '/maps/presets/wandernde-waelder.jpg' },
  { id: 'zhoujiang', name: 'Zhoujiang', category: 'Region', path: '/maps/presets/zhoujiang.jpg' },
];

// === VIEWPORT TRANSFORM FUNCTIONS ===

// Convert screen coordinates to canvas coordinates
function screenToCanvas(clientX, clientY) {
  const rect = mapCanvas.getBoundingClientRect();

  // Get position relative to the canvas element (in CSS/display pixels)
  const displayX = clientX - rect.left;
  const displayY = clientY - rect.top;

  // Scale from display size to internal canvas size
  // (canvas internal size may differ from CSS display size)
  const scaleX = mapCanvas.width / rect.width;
  const scaleY = mapCanvas.height / rect.height;
  const internalX = displayX * scaleX;
  const internalY = displayY * scaleY;

  // Apply inverse viewport transform (undo pan and zoom)
  const x = (internalX - viewport.x) / viewport.scale;
  const y = (internalY - viewport.y) / viewport.scale;

  // Handle rotation (rotate point around canvas center)
  if (viewport.rotation !== 0) {
    const cx = mapCanvas.width / 2;
    const cy = mapCanvas.height / 2;
    const radians = -viewport.rotation * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = x - cx;
    const dy = y - cy;
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos
    };
  }

  return { x, y };
}

// Apply viewport transform to a canvas context
function applyViewportTransform(ctx) {
  const cx = mapCanvas.width / 2;
  const cy = mapCanvas.height / 2;

  ctx.translate(viewport.x, viewport.y);
  ctx.scale(viewport.scale, viewport.scale);

  if (viewport.rotation !== 0) {
    ctx.translate(cx, cy);
    ctx.rotate(viewport.rotation * Math.PI / 180);
    ctx.translate(-cx, -cy);
  }
}

// Zoom centered on a specific screen point
function zoomAtPoint(clientX, clientY, scaleFactor) {
  // Get canvas point under cursor BEFORE zoom
  const worldPoint = screenToCanvas(clientX, clientY);

  // Apply zoom
  const newScale = viewport.scale * scaleFactor;
  viewport.scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

  // Convert screen position to internal canvas coordinates
  const rect = mapCanvas.getBoundingClientRect();
  const displayX = clientX - rect.left;
  const displayY = clientY - rect.top;
  const scaleX = mapCanvas.width / rect.width;
  const scaleY = mapCanvas.height / rect.height;
  const internalX = displayX * scaleX;
  const internalY = displayY * scaleY;

  // Adjust pan so cursor stays on same world point
  viewport.x = internalX - worldPoint.x * viewport.scale;
  viewport.y = internalY - worldPoint.y * viewport.scale;

  updateZoomDisplay();
  updateDrawModeButton();
  updateCursor();
  renderAll();
}

// Set zoom level (for button controls)
function setZoom(newZoom) {
  const rect = mapCanvas.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  zoomAtPoint(centerX, centerY, newZoom / viewport.scale);
}

// Set rotation
function setRotation(newRotation) {
  viewport.rotation = ((newRotation % 360) + 360) % 360;
  renderAll();
}

// Reset viewport to default
function resetViewport() {
  viewport.x = 0;
  viewport.y = 0;
  viewport.scale = 1;
  viewport.rotation = 0;
  isDrawMode = false;
  updateZoomDisplay();
  updateDrawModeButton();
  updateCursor();
  renderAll();
}

// Update zoom level display
function updateZoomDisplay() {
  const display = document.getElementById('zoom-level');
  if (display) {
    display.textContent = `${Math.round(viewport.scale * 100)}%`;
  }
}

// Update draw mode button visibility and state
function updateDrawModeButton() {
  const btn = document.getElementById('draw-mode-btn');
  if (!btn) return;

  if (viewport.scale > 1) {
    btn.classList.remove('hidden');
    if (isDrawMode) {
      btn.classList.add('bg-amber-600');
      btn.classList.remove('bg-gray-700');
      btn.textContent = 'Draw Mode ON';
    } else {
      btn.classList.remove('bg-amber-600');
      btn.classList.add('bg-gray-700');
      btn.textContent = 'Draw Mode';
    }
  } else {
    btn.classList.add('hidden');
    isDrawMode = false;
  }
}

// Update cursor based on mode
function updateCursor() {
  if (!fogCanvas) return;

  if (viewport.scale > 1 && !isDrawMode) {
    fogCanvas.style.cursor = isPanning ? 'grabbing' : 'grab';
  } else {
    fogCanvas.style.cursor = 'crosshair';
  }
}

// Render all canvas layers with viewport transform
function renderAll() {
  if (!mapImage || !mapCanvas) return;

  // Render map
  mapCtx.setTransform(1, 0, 0, 1, 0, 0);
  mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
  applyViewportTransform(mapCtx);
  mapCtx.drawImage(mapImage, 0, 0);

  // Render fog
  renderFogLayer();

  // Render figures
  renderFiguresLayer();

  // Render preview
  renderPreviewLayer();
}

// Render fog layer with viewport transform
function renderFogLayer() {
  if (!fogCtx || !fogCanvas || !fogDataCanvas) return;

  // Clear display canvas
  fogCtx.setTransform(1, 0, 0, 1, 0, 0);
  fogCtx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);

  // Apply viewport transform and draw from fog data
  applyViewportTransform(fogCtx);
  fogCtx.drawImage(fogDataCanvas, 0, 0);
}

// Render figures layer with viewport transform
function renderFiguresLayer() {
  if (!figureCtx || !figureCanvas) return;
  figureCtx.setTransform(1, 0, 0, 1, 0, 0);
  figureCtx.clearRect(0, 0, figureCanvas.width, figureCanvas.height);
  applyViewportTransform(figureCtx);
  figures.forEach(fig => drawFigure(figureCtx, fig, 1.0));
}

// Render preview layer with viewport transform
function renderPreviewLayer() {
  if (!previewCtx || !previewCanvas || !previewDataCanvas) return;

  // Clear display canvas
  previewCtx.setTransform(1, 0, 0, 1, 0, 0);
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

  // Apply viewport transform and draw from preview data
  applyViewportTransform(previewCtx);
  previewCtx.drawImage(previewDataCanvas, 0, 0);
}

// DOM Elements
const elements = {
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  sessionPanel: document.getElementById('session-panel'),
  controlPanel: document.getElementById('control-panel'),
  createSessionPanel: document.getElementById('create-session-panel'),
  joinCodePanel: document.getElementById('join-code-panel'),
  joinCode: document.getElementById('join-code'),
  tableConnected: document.getElementById('table-connected'),
  settingsJoinCode: document.getElementById('settings-join-code'),
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  initEventListeners();
  initMapCanvas();
  initPresetMaps();
});

// Handle window resize - debounced to avoid excessive redraws
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (mapImage) {
      // Resize container
      const container = document.getElementById('map-canvas-container');
      const mapViewportEl = document.getElementById('map-viewport');
      const maxHeight = window.innerHeight - 340;
      const aspectRatio = mapImage.height / mapImage.width;

      // Get viewport's parent width for reference
      const parentWidth = mapViewportEl.parentElement.clientWidth - 32;
      let displayWidth = parentWidth;
      let displayHeight = parentWidth * aspectRatio;

      if (displayHeight > maxHeight) {
        displayHeight = maxHeight;
        displayWidth = displayHeight / aspectRatio;
      }

      container.style.width = `${displayWidth}px`;
      container.style.height = `${displayHeight}px`;
      mapViewportEl.style.width = `${displayWidth}px`;
      mapViewportEl.style.height = `${displayHeight}px`;

      // Re-render with current viewport state
      renderAll();
    }
  }, 100);
});

// WebSocket Setup
function initWebSocket() {
  ws = new WSClient();

  ws.on('connected', () => {
    updateConnectionStatus(true);
    const saved = getSavedSession();
    if (saved) {
      ws.reconnectSession(saved.sessionId, saved.gmToken);
    }
  });

  ws.on('disconnected', () => {
    updateConnectionStatus(false);
  });

  ws.on('session:created', (data) => {
    sessionId = data.sessionId;
    gmToken = data.gmToken;
    joinCode = data.joinCode;
    saveSession();
    showJoinCode();
    showControlPanel();
  });

  ws.on('session:reconnected', (data) => {
    sessionId = data.sessionId;
    joinCode = data.joinCode;
    showJoinCode();
    showControlPanel();
  });

  ws.on('session:state', (data) => {
    // Restore map state after reconnect
    if (data.mapImage) {
      loadMapFromData(data.mapImage, data.fogMask);
    }
    // Restore figures after reconnect
    if (data.figures && data.figures.length > 0) {
      figures = data.figures;
      renderFigures();
    }
  });

  ws.on('table:connected', () => {
    elements.tableConnected.textContent = 'Connected';
    elements.tableConnected.className = 'ml-2 text-green-400';
    // Send current map state to newly connected table
    if (mapImage) {
      sendMapState();
    }
  });

  ws.on('table:disconnected', () => {
    elements.tableConnected.textContent = 'Not Connected';
    elements.tableConnected.className = 'ml-2 text-red-400';
  });

  ws.on('puzzle:submitted', (data) => {
    alert(`Answer received: ${JSON.stringify(data.answer)}`);
  });

  ws.on('error', (data) => {
    console.error('Server error:', data);
    alert(`Error: ${data.message}`);
  });

  ws.connect();
}

// Event Listeners
function initEventListeners() {
  // Create session
  document.getElementById('create-session-btn').addEventListener('click', () => {
    ws.createSession();
  });

  // Reconnect
  document.getElementById('reconnect-btn').addEventListener('click', () => {
    const saved = getSavedSession();
    if (saved) {
      ws.reconnectSession(saved.sessionId, saved.gmToken);
    } else {
      alert('No saved session found');
    }
  });

  // Copy code
  document.getElementById('copy-code-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(joinCode);
    document.getElementById('copy-code-btn').textContent = 'Copied!';
    setTimeout(() => {
      document.getElementById('copy-code-btn').textContent = 'Copy Code';
    }, 2000);
  });

  // Copy session table link
  document.getElementById('copy-session-link-btn')?.addEventListener('click', () => {
    const link = document.getElementById('session-table-link');
    if (link) {
      navigator.clipboard.writeText(link.value);
      const btn = document.getElementById('copy-session-link-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = 'Copy';
      }, 2000);
    }
  });

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showTab(btn.dataset.tab);
    });
  });

  // Map upload - Gallery
  document.getElementById('upload-map-btn').addEventListener('click', () => {
    document.getElementById('map-image-file').click();
  });

  document.getElementById('map-image-file').addEventListener('change', handleMapUpload);

  // Map upload - Camera
  document.getElementById('camera-map-btn')?.addEventListener('click', () => {
    document.getElementById('map-camera-file').click();
  });

  document.getElementById('map-camera-file')?.addEventListener('change', handleMapUpload);

  document.getElementById('change-map-btn')?.addEventListener('click', () => {
    document.getElementById('map-image-file').click();
  });

  // Fog controls
  document.getElementById('clear-fog-btn')?.addEventListener('click', clearFog);
  document.getElementById('reveal-all-btn')?.addEventListener('click', revealAll);

  // Brush size
  document.querySelectorAll('.brush-size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      brushSize = parseInt(btn.dataset.size);
      document.querySelectorAll('.brush-size-btn').forEach(b => {
        b.classList.remove('bg-amber-600');
        b.classList.add('bg-gray-700');
      });
      btn.classList.remove('bg-gray-700');
      btn.classList.add('bg-amber-600');
    });
  });

  // Mode toggle
  document.getElementById('mode-reveal-btn')?.addEventListener('click', () => {
    isRevealing = true;
    document.getElementById('mode-reveal-btn').classList.add('bg-green-600');
    document.getElementById('mode-reveal-btn').classList.remove('bg-gray-700');
    document.getElementById('mode-hide-btn').classList.remove('bg-red-600');
    document.getElementById('mode-hide-btn').classList.add('bg-gray-700');
  });

  document.getElementById('mode-hide-btn')?.addEventListener('click', () => {
    // Cancel any pending preview when switching to hide mode
    if (hasPreview) {
      cancelPreview();
    }
    isRevealing = false;
    document.getElementById('mode-hide-btn').classList.add('bg-red-600');
    document.getElementById('mode-hide-btn').classList.remove('bg-gray-700');
    document.getElementById('mode-reveal-btn').classList.remove('bg-green-600');
    document.getElementById('mode-reveal-btn').classList.add('bg-gray-700');
  });

  // Zoom controls
  document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
    setZoom(viewport.scale + ZOOM_STEP);
  });
  document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
    setZoom(viewport.scale - ZOOM_STEP);
  });
  document.getElementById('zoom-reset-btn')?.addEventListener('click', () => {
    resetViewport();
  });

  // Rotation controls
  document.getElementById('rotate-left-btn')?.addEventListener('click', () => {
    setRotation(viewport.rotation - 90);
  });
  document.getElementById('rotate-right-btn')?.addEventListener('click', () => {
    setRotation(viewport.rotation + 90);
  });

  // Draw mode toggle
  document.getElementById('draw-mode-btn')?.addEventListener('click', () => {
    isDrawMode = !isDrawMode;
    updateDrawModeButton();
    updateCursor();
  });

  // Handouts
  document.getElementById('upload-handout-btn')?.addEventListener('click', () => {
    document.getElementById('handout-file').click();
  });
  document.getElementById('handout-file')?.addEventListener('change', handleHandoutUpload);
  document.getElementById('push-handout-btn')?.addEventListener('click', pushHandout);
  document.getElementById('clear-handout-btn')?.addEventListener('click', clearHandout);

  // Decisions
  document.getElementById('add-option-btn')?.addEventListener('click', addDecisionOption);
  document.getElementById('push-decision-btn')?.addEventListener('click', pushDecision);
  document.getElementById('clear-decision-btn')?.addEventListener('click', clearDecision);

  // Puzzles
  document.getElementById('puzzle-type')?.addEventListener('change', (e) => {
    document.querySelectorAll('[id^="puzzle-"][id$="-form"]').forEach(form => {
      form.classList.add('hidden');
    });
    document.getElementById(`puzzle-${e.target.value}-form`)?.classList.remove('hidden');
  });
  document.getElementById('push-puzzle-btn')?.addEventListener('click', pushPuzzle);
  initLockedDoorForm();

  // Display mode
  document.querySelectorAll('.display-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ws.send('display:mode', { mode: btn.dataset.mode });
    });
  });

  // Copy table link
  document.getElementById('copy-link-btn')?.addEventListener('click', () => {
    const tableLink = document.getElementById('table-link');
    if (tableLink) {
      navigator.clipboard.writeText(tableLink.value);
      const btn = document.getElementById('copy-link-btn');
      btn.textContent = 'Copied!';
      setTimeout(() => {
        btn.textContent = 'Copy';
      }, 2000);
    }
  });

  // End session
  document.getElementById('end-session-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to end this session?')) {
      clearSession();
      location.reload();
    }
  });
}

// Map Canvas Setup
function initMapCanvas() {
  mapCanvas = document.getElementById('map-canvas');
  figureCanvas = document.getElementById('figure-canvas');
  fogCanvas = document.getElementById('fog-canvas');
  previewCanvas = document.getElementById('preview-canvas');

  if (!mapCanvas || !fogCanvas) return;

  mapCtx = mapCanvas.getContext('2d');
  fogCtx = fogCanvas.getContext('2d');
  if (figureCanvas) {
    figureCtx = figureCanvas.getContext('2d');
  }
  if (previewCanvas) {
    previewCtx = previewCanvas.getContext('2d');
  }

  // Touch/mouse events for drawing and figure interaction
  // All events go through fog canvas since it's the top layer
  fogCanvas.addEventListener('pointerdown', startDrawing);
  fogCanvas.addEventListener('pointermove', draw);
  fogCanvas.addEventListener('pointerup', stopDrawing);
  fogCanvas.addEventListener('pointerleave', stopDrawing);

  // Prevent scrolling while drawing (but allow pinch)
  fogCanvas.style.touchAction = 'none';

  // Multi-touch gesture state
  let initialPinchDistance = null;
  let initialPinchZoom = null;
  let initialPinchAngle = null;
  let initialPinchRotation = null;

  // Handle pinch-to-zoom and two-finger rotate
  fogCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      initialPinchDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      initialPinchZoom = viewport.scale;
      initialPinchAngle = Math.atan2(
        touch2.clientY - touch1.clientY,
        touch2.clientX - touch1.clientX
      );
      initialPinchRotation = viewport.rotation;
    }
  }, { passive: false });

  fogCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDistance !== null) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];

      // Calculate pinch center for zoom-to-point
      const pinchCenterX = (touch1.clientX + touch2.clientX) / 2;
      const pinchCenterY = (touch1.clientY + touch2.clientY) / 2;

      // Calculate new distance for zoom
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      const zoomRatio = currentDistance / initialPinchDistance;
      const newScale = initialPinchZoom * zoomRatio;

      // Zoom to pinch center
      zoomAtPoint(pinchCenterX, pinchCenterY, newScale / viewport.scale);

      // Calculate angle for rotation
      const currentAngle = Math.atan2(
        touch2.clientY - touch1.clientY,
        touch2.clientX - touch1.clientX
      );
      const angleDelta = (currentAngle - initialPinchAngle) * 180 / Math.PI;
      // Snap to 90 degree increments when past 45 degrees
      const snappedAngle = Math.round(angleDelta / 90) * 90;
      if (Math.abs(snappedAngle) >= 90) {
        setRotation(initialPinchRotation + snappedAngle);
        // Reset the initial angle to prevent continuous rotation
        initialPinchAngle = currentAngle;
        initialPinchRotation = viewport.rotation;
      }
    }
  }, { passive: false });

  fogCanvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      initialPinchDistance = null;
      initialPinchZoom = null;
      initialPinchAngle = null;
      initialPinchRotation = null;
    }
  });

  // Mouse wheel zoom support (zoom to cursor)
  const mapViewport = document.getElementById('map-viewport');
  mapViewport?.addEventListener('wheel', (e) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomAtPoint(e.clientX, e.clientY, scaleFactor);
  }, { passive: false });

  // Figure palette drag handlers
  document.querySelectorAll('.figure-btn').forEach(btn => {
    btn.addEventListener('pointerdown', (e) => {
      const type = btn.dataset.type;
      const number = btn.dataset.number ? parseInt(btn.dataset.number) : undefined;
      startFigureDrag(type, number);
    });
  });

  // Clear figures button
  document.getElementById('clear-figures-btn')?.addEventListener('click', clearAllFigures);

  // Preview confirm/cancel buttons
  document.getElementById('confirm-preview-btn')?.addEventListener('click', confirmPreview);
  document.getElementById('cancel-preview-btn')?.addEventListener('click', cancelPreview);
}

function startDrawing(e) {
  if (!mapImage) return;

  const pos = screenToCanvas(e.clientX, e.clientY);

  // Check if we should pan instead of draw (zoomed in + not in draw mode)
  if (viewport.scale > 1 && !isDrawMode) {
    isPanning = true;
    lastPanX = e.clientX;
    lastPanY = e.clientY;
    updateCursor();
    return;
  }

  // Check if clicking on a figure first
  const clickedFigure = findFigureAtPosition(pos);
  if (clickedFigure) {
    // Record start position for click vs drag detection
    figurePointerStart = {
      x: pos.x,
      y: pos.y,
      figureId: clickedFigure.id,
      figure: clickedFigure
    };
    return; // Don't start fog drawing
  }

  // If dragging from palette, don't start fog drawing
  if (isDraggingFigure) {
    return;
  }

  // Start fog drawing
  isDrawing = true;
  draw(e);
}

function draw(e) {
  if (!mapImage) return;

  // Handle panning
  if (isPanning) {
    const dx = e.clientX - lastPanX;
    const dy = e.clientY - lastPanY;
    viewport.x += dx;
    viewport.y += dy;
    lastPanX = e.clientX;
    lastPanY = e.clientY;
    requestAnimationFrame(renderAll);
    return;
  }

  const pos = screenToCanvas(e.clientX, e.clientY);

  // Handle figure being dragged from palette
  if (isDraggingFigure && previewFigure) {
    previewFigure.position = pos;
    renderPreviewFigure();
    hasPreview = true;
    showPreviewActions();
    return;
  }

  // Handle click vs drag detection for figure on map
  if (figurePointerStart && !isDraggingFigure) {
    const dist = Math.sqrt(
      Math.pow(pos.x - figurePointerStart.x, 2) +
      Math.pow(pos.y - figurePointerStart.y, 2)
    );

    if (dist > DRAG_THRESHOLD) {
      // Start dragging the figure
      isDraggingFigure = true;
      previewFigure = { ...figurePointerStart.figure };
      draggedFigureId = figurePointerStart.figureId;
      // Remove from confirmed list
      figures = figures.filter(f => f.id !== figurePointerStart.figureId);
      renderFigures();

      // Update preview position
      previewFigure.position = pos;
      renderPreviewFigure();
      hasPreview = true;
      showPreviewActions();
    }
    return;
  }

  // Handle fog drawing
  if (!isDrawing) return;

  // Calculate brush size in canvas coordinates
  const brushRadius = brushSize / viewport.scale;

  if (isRevealing) {
    // Draw to preview data canvas (untransformed - same coordinate space as fog data)
    previewDataCtx.fillStyle = '#00ff66';
    previewDataCtx.beginPath();
    previewDataCtx.arc(pos.x, pos.y, brushRadius, 0, Math.PI * 2);
    previewDataCtx.fill();
    // Update display with transform
    renderPreviewLayer();
    hasPreview = true;
    showPreviewActions();
  } else {
    // Hide mode: draw directly to fog data (instant)
    fogDataCtx.globalCompositeOperation = 'source-over';
    fogDataCtx.fillStyle = '#000000';
    fogDataCtx.beginPath();
    fogDataCtx.arc(pos.x, pos.y, brushRadius, 0, Math.PI * 2);
    fogDataCtx.fill();
    renderAll();
  }
}

function stopDrawing(e) {
  // Handle pan end
  if (isPanning) {
    isPanning = false;
    updateCursor();
    return;
  }

  // Handle figure click (no drag) - show delete prompt
  if (figurePointerStart && !isDraggingFigure) {
    const figure = figurePointerStart.figure;
    const label = figure.type === 'poi' ? 'POI' : `${figure.type} ${figure.number}`;
    figurePointerStart = null;

    if (confirm(`Delete ${label}?`)) {
      figures = figures.filter(f => f.id !== figure.id);
      renderFigures();
      sendFiguresUpdate();
    }
    return;
  }

  // Handle figure drag completion - place at new position
  if (isDraggingFigure && previewFigure) {
    // Get final position
    if (e) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      previewFigure.position = pos;
    }

    // Add to figures
    figures.push(previewFigure);
    renderFigures();
    sendFiguresUpdate();

    // Clear preview
    previewFigure = null;
    draggedFigureId = null;
    isDraggingFigure = false;
    figurePointerStart = null;
    if (previewCtx) {
      previewCtx.setTransform(1, 0, 0, 1, 0, 0);
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    hasPreview = false;
    hidePreviewActions();
    return;
  }

  // Handle fog drawing stop
  if (isDrawing) {
    isDrawing = false;
    // Only send fog update immediately for hide mode
    if (!isRevealing) {
      sendFogUpdate();
    }
  }

  // Clear any stale state
  figurePointerStart = null;
}

function showPreviewActions() {
  document.getElementById('preview-actions')?.classList.remove('hidden');
}

function hidePreviewActions() {
  document.getElementById('preview-actions')?.classList.add('hidden');
}

function confirmPreview() {
  if (!hasPreview || !previewDataCanvas || !fogDataCanvas) return;

  // Apply fog preview to fog data canvas (cut out the revealed areas)
  // We need to use the preview data as a mask to remove from fog
  fogDataCtx.globalCompositeOperation = 'destination-out';
  fogDataCtx.drawImage(previewDataCanvas, 0, 0);
  fogDataCtx.globalCompositeOperation = 'source-over';

  // Clear preview data and display
  previewDataCtx.clearRect(0, 0, previewDataCanvas.width, previewDataCanvas.height);
  if (previewCtx) {
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  }
  hasPreview = false;
  hidePreviewActions();

  // Update display and sync to table
  renderAll();
  sendFogUpdate();
}

function cancelPreview() {
  // Handle figure preview cancellation (restore if was moving existing)
  if (previewFigure && draggedFigureId) {
    // Was moving existing figure, restore it to original position
    figures.push(previewFigure);
    renderFigures();
  }

  // Clear all preview state
  previewFigure = null;
  draggedFigureId = null;
  isDraggingFigure = false;
  figurePointerStart = null;

  // Clear the preview data and display canvases
  if (previewDataCtx && previewDataCanvas) {
    previewDataCtx.clearRect(0, 0, previewDataCanvas.width, previewDataCanvas.height);
  }
  if (previewCtx && previewCanvas) {
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  }
  hasPreview = false;
  hidePreviewActions();
}

// Map handling
function handleMapUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // Reset zoom/rotation when loading new map
  resetViewport();

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      mapImage = img;
      showMapCanvas(); // Show first so container has dimensions
      setupMapCanvases(img);
      clearFog(); // Start with everything hidden
      sendMapState();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function loadMapFromData(imageData, fogMaskData) {
  const img = new Image();
  img.onload = () => {
    mapImage = img;
    showMapCanvas(); // Show first so container has dimensions
    setupMapCanvases(img);

    if (fogMaskData) {
      const fogImg = new Image();
      fogImg.onload = () => {
        // Draw fog mask to the offscreen fog data canvas
        fogDataCtx.drawImage(fogImg, 0, 0);
        renderAll();
      };
      fogImg.src = fogMaskData;
    } else {
      clearFog();
    }
  };
  img.src = imageData;
}

// === PRESET MAPS ===

// Track which maps are available
const availableMaps = new Set();

// Initialize preset maps UI
function initPresetMaps() {
  // Check which maps are available first
  let checkCount = 0;
  presetMaps.forEach(map => {
    const testImg = new Image();
    testImg.onload = () => {
      availableMaps.add(map.id);
      checkCount++;
      if (checkCount === presetMaps.length) {
        renderPresetMapsGrid('preset-maps-grid', 'all');
        renderPresetMapsGrid('preset-maps-grid-loaded', 'all');
        updateEmptyMessage();
      }
    };
    testImg.onerror = () => {
      checkCount++;
      if (checkCount === presetMaps.length) {
        renderPresetMapsGrid('preset-maps-grid', 'all');
        renderPresetMapsGrid('preset-maps-grid-loaded', 'all');
        updateEmptyMessage();
      }
    };
    testImg.src = map.path;
  });

  // Set up category filter listeners
  document.getElementById('preset-category-filter')?.addEventListener('change', (e) => {
    renderPresetMapsGrid('preset-maps-grid', e.target.value);
  });
  document.getElementById('preset-category-filter-loaded')?.addEventListener('change', (e) => {
    renderPresetMapsGrid('preset-maps-grid-loaded', e.target.value);
  });
}

// Render preset maps grid with optional category filter
function renderPresetMapsGrid(gridId, category) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  grid.innerHTML = '';
  const isCompact = gridId.includes('loaded');

  const filteredMaps = category === 'all'
    ? presetMaps
    : presetMaps.filter(m => m.category === category);

  filteredMaps.forEach(map => {
    const isAvailable = availableMaps.has(map.id);
    const btn = document.createElement('button');

    if (isCompact) {
      btn.className = `preset-map-btn text-xs p-1 rounded transition-colors ${
        isAvailable
          ? 'bg-gray-600 hover:bg-gray-500'
          : 'bg-gray-800 opacity-50 cursor-not-allowed'
      }`;
      btn.textContent = map.name;
    } else {
      btn.className = `preset-map-btn p-2 rounded-lg text-sm flex flex-col items-center gap-1 transition-colors ${
        isAvailable
          ? 'bg-gray-700 hover:bg-gray-600'
          : 'bg-gray-800 opacity-50 cursor-not-allowed'
      }`;
      btn.innerHTML = `
        <span class="font-bold text-xs">${map.name}</span>
        <span class="text-xs text-gray-400">${map.category}</span>
      `;
    }

    if (isAvailable) {
      btn.onclick = () => loadPresetMap(map);
    } else {
      btn.title = 'Map not downloaded. Run: npm run download-maps';
    }

    grid.appendChild(btn);
  });
}

// Update empty message visibility
function updateEmptyMessage() {
  const emptyMsg = document.getElementById('preset-maps-empty');
  if (emptyMsg) {
    if (availableMaps.size === 0) {
      emptyMsg.classList.remove('hidden');
    } else {
      emptyMsg.classList.add('hidden');
    }
  }
}

// Load a preset map
function loadPresetMap(map) {
  // Reset zoom/rotation when loading new map
  resetViewport();

  const img = new Image();
  img.onload = () => {
    mapImage = img;
    showMapCanvas();
    setupMapCanvases(img);
    clearFog();
    sendMapState();
  };
  img.onerror = () => {
    alert(`Failed to load map: ${map.name}\nRun 'npm run download-maps' to download preset maps.`);
  };
  img.src = map.path;
}

function setupMapCanvases(img) {
  const container = document.getElementById('map-canvas-container');
  const mapViewportEl = document.getElementById('map-viewport');

  // Get parent width (the tab content panel - viewport's parent)
  const parentWidth = mapViewportEl.parentElement.clientWidth - 32; // Account for padding

  // Calculate max height based on viewport (account for buttons)
  const maxHeight = window.innerHeight - 340;

  // Calculate dimensions that fit within constraints
  const aspectRatio = img.height / img.width;
  let displayWidth = parentWidth;
  let displayHeight = parentWidth * aspectRatio;

  // If too tall, constrain by height
  if (displayHeight > maxHeight) {
    displayHeight = maxHeight;
    displayWidth = displayHeight / aspectRatio;
  }

  // Update container and viewport size
  container.style.width = `${displayWidth}px`;
  container.style.height = `${displayHeight}px`;
  mapViewportEl.style.width = `${displayWidth}px`;
  mapViewportEl.style.height = `${displayHeight}px`;

  // Set canvas dimensions to match image (for quality)
  mapCanvas.width = img.width;
  mapCanvas.height = img.height;
  if (figureCanvas) {
    figureCanvas.width = img.width;
    figureCanvas.height = img.height;
  }
  fogCanvas.width = img.width;
  fogCanvas.height = img.height;
  if (previewCanvas) {
    previewCanvas.width = img.width;
    previewCanvas.height = img.height;
  }

  // Create/resize offscreen fog data canvas
  fogDataCanvas = document.createElement('canvas');
  fogDataCanvas.width = img.width;
  fogDataCanvas.height = img.height;
  fogDataCtx = fogDataCanvas.getContext('2d');

  // Create/resize offscreen preview data canvas
  previewDataCanvas = document.createElement('canvas');
  previewDataCanvas.width = img.width;
  previewDataCanvas.height = img.height;
  previewDataCtx = previewDataCanvas.getContext('2d');

  // Clear any existing preview
  if (previewDataCtx) {
    previewDataCtx.clearRect(0, 0, previewDataCanvas.width, previewDataCanvas.height);
  }
  hasPreview = false;
  hidePreviewActions();

  // Make fog visible but semi-transparent for GM
  fogCanvas.style.opacity = '0.7';

  // Reset viewport to default (this also renders all layers)
  resetViewport();
}

function showMapCanvas() {
  document.getElementById('map-upload-section').classList.add('hidden');
  document.getElementById('map-canvas-section').classList.remove('hidden');
}

function clearFog() {
  if (!fogDataCanvas) return;

  // Clear any preview first
  if (previewDataCtx && previewDataCanvas) {
    previewDataCtx.clearRect(0, 0, previewDataCanvas.width, previewDataCanvas.height);
  }
  if (previewCtx && previewCanvas) {
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  }
  hasPreview = false;
  hidePreviewActions();

  // Fill fog data with black (all hidden)
  fogDataCtx.globalCompositeOperation = 'source-over';
  fogDataCtx.fillStyle = '#000000';
  fogDataCtx.fillRect(0, 0, fogDataCanvas.width, fogDataCanvas.height);

  renderAll();
  sendFogUpdate();
}

function revealAll() {
  if (!fogDataCanvas) return;

  // Clear any preview first
  if (previewDataCtx && previewDataCanvas) {
    previewDataCtx.clearRect(0, 0, previewDataCanvas.width, previewDataCanvas.height);
  }
  if (previewCtx && previewCanvas) {
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  }
  hasPreview = false;
  hidePreviewActions();

  // Clear the fog data canvas (all revealed)
  fogDataCtx.clearRect(0, 0, fogDataCanvas.width, fogDataCanvas.height);

  renderAll();
  sendFogUpdate();
}

// Send map state to server/table
function sendMapState() {
  if (!mapImage || !fogDataCanvas) return;

  // Create a temp canvas to draw the untransformed map
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = mapImage.width;
  tempCanvas.height = mapImage.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(mapImage, 0, 0);

  const mapData = tempCanvas.toDataURL('image/jpeg', 0.8);
  const fogData = fogDataCanvas.toDataURL('image/png');

  ws.send('map:state', {
    mapImage: mapData,
    fogMask: fogData,
  });
}

function sendFogUpdate() {
  if (!fogDataCanvas) return;

  const fogData = fogDataCanvas.toDataURL('image/png');
  ws.send('map:fogUpdate', {
    fogMask: fogData,
  });
}

// === FIGURE FUNCTIONS ===

// Generate unique ID for figures
function generateFigureId() {
  return 'fig_' + Math.random().toString(36).substr(2, 9) + Date.now();
}

// Render all confirmed figures (with viewport transform)
function renderFigures() {
  renderFiguresLayer();
  updateFigurePalette();
}

// Update figure palette to show which figures are already placed
function updateFigurePalette() {
  document.querySelectorAll('.figure-btn').forEach(btn => {
    const type = btn.dataset.type;
    const number = btn.dataset.number ? parseInt(btn.dataset.number) : undefined;

    if (type !== 'poi' && number) {
      const isPlaced = figures.some(f => f.type === type && f.number === number);
      btn.classList.toggle('opacity-50', isPlaced);
      btn.classList.toggle('cursor-not-allowed', isPlaced);
    }
  });
}

// Render preview figure on preview canvas (with viewport transform)
function renderPreviewFigure() {
  if (!previewCtx || !previewFigure) return;
  previewCtx.save();
  previewCtx.setTransform(1, 0, 0, 1, 0, 0);
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  applyViewportTransform(previewCtx);
  drawFigure(previewCtx, previewFigure, 0.6);
  previewCtx.restore();
}

// Draw a single figure
function drawFigure(ctx, figure, opacity) {
  ctx.save();
  ctx.globalAlpha = opacity;

  const radius = 20;
  const { x, y } = figure.position;

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
}

// Start dragging a figure from palette
function startFigureDrag(type, number) {
  // Check if this figure type+number already exists (skip POI - unlimited)
  if (type !== 'poi' && number) {
    const existing = figures.find(f => f.type === type && f.number === number);
    if (existing) {
      // Figure already placed - don't allow duplicate
      return;
    }
  }

  previewFigure = {
    id: generateFigureId(),
    type,
    number,
    position: { x: 0, y: 0 },
    createdAt: Date.now()
  };
  isDraggingFigure = true;
}


// Find figure at given position
function findFigureAtPosition(pos) {
  const hitRadius = 30;
  return figures.find(fig => {
    const dist = Math.sqrt(
      Math.pow(fig.position.x - pos.x, 2) +
      Math.pow(fig.position.y - pos.y, 2)
    );
    return dist < hitRadius;
  });
}

// Clear all figures
function clearAllFigures() {
  if (!confirm('Clear all figures?')) return;

  figures = [];
  previewFigure = null;
  draggedFigureId = null;
  figurePointerStart = null;
  if (figureCtx) {
    figureCtx.setTransform(1, 0, 0, 1, 0, 0);
    figureCtx.clearRect(0, 0, figureCanvas.width, figureCanvas.height);
  }
  if (previewCtx) {
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  }
  hasPreview = false;
  hidePreviewActions();
  updateFigurePalette();
  ws.send('figures:clear');
}

// Send figures update to server
function sendFiguresUpdate() {
  ws.send('figures:update', { figures });
}

// UI Updates
function updateConnectionStatus(connected) {
  elements.statusDot.className = `w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`;
  elements.statusText.textContent = connected ? 'Connected' : 'Disconnected';
}

function showJoinCode() {
  elements.createSessionPanel.classList.add('hidden');
  elements.joinCodePanel.classList.remove('hidden');
  elements.joinCode.textContent = joinCode;
  if (elements.settingsJoinCode) {
    elements.settingsJoinCode.textContent = joinCode;
  }

  // Set the table display links (include join code for auto-join)
  const baseUrl = window.location.origin;
  const tableUrl = `${baseUrl}/table?code=${joinCode}`;

  const tableLink = document.getElementById('table-link');
  if (tableLink) {
    tableLink.value = tableUrl;
  }

  const sessionTableLink = document.getElementById('session-table-link');
  if (sessionTableLink) {
    sessionTableLink.value = tableUrl;
  }
}

function showControlPanel() {
  elements.sessionPanel.classList.add('hidden');
  elements.controlPanel.classList.remove('hidden');
}

function showTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('text-amber-400', btn.dataset.tab === tabName);
    btn.classList.toggle('text-gray-400', btn.dataset.tab !== tabName);
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.add('hidden');
  });
  document.getElementById(`tab-${tabName}`)?.classList.remove('hidden');
}

// Session Management
function getSavedSession() {
  const saved = localStorage.getItem('dungeon-bridge-session');
  return saved ? JSON.parse(saved) : null;
}

function saveSession() {
  localStorage.setItem('dungeon-bridge-session', JSON.stringify({
    sessionId,
    gmToken,
  }));
}

function clearSession() {
  localStorage.removeItem('dungeon-bridge-session');
}

// Handouts
function handleHandoutUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    document.getElementById('handout-url').value = event.target.result;
  };
  reader.readAsDataURL(file);
}

function pushHandout() {
  const url = document.getElementById('handout-url').value;
  if (!url) {
    alert('Please enter an image URL or upload an image');
    return;
  }
  ws.send('handout:push', { imageUrl: url });
}

function clearHandout() {
  ws.send('handout:clear');
}

// Decisions
function addDecisionOption() {
  const container = document.getElementById('decision-options');
  const count = container.querySelectorAll('.decision-option').length + 1;
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = `Option ${count}`;
  input.className = 'decision-option w-full bg-gray-700 p-2 rounded';
  container.appendChild(input);
}

function pushDecision() {
  const title = document.getElementById('decision-title').value;
  const optionInputs = document.querySelectorAll('.decision-option');
  const options = Array.from(optionInputs)
    .map((input, i) => ({ id: `opt${i + 1}`, text: input.value }))
    .filter(opt => opt.text.trim());

  if (!title || options.length < 2) {
    alert('Please enter a title and at least 2 options');
    return;
  }

  ws.send('decision:push', {
    id: `decision_${Date.now()}`,
    title,
    options,
  });
}

function clearDecision() {
  ws.send('decision:clear');
}

// Puzzles
let doorSequence = [];
const symbolMap = {
  sun: '☀', moon: '☽', star: '★', fire: '🔥', water: '💧', skull: '💀',
  key: '🗝', eye: '👁', snake: '🐍', crown: '👑', sword: '⚔', shield: '🛡'
};

function initLockedDoorForm() {
  document.querySelectorAll('.symbol-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const symbol = btn.dataset.symbol;
      doorSequence.push(symbol);
      updateDoorSequenceDisplay();
    });
  });

  document.getElementById('clear-door-sequence')?.addEventListener('click', () => {
    doorSequence = [];
    updateDoorSequenceDisplay();
  });
}

function updateDoorSequenceDisplay() {
  const display = document.getElementById('door-sequence-display');
  if (!display) return;

  if (doorSequence.length === 0) {
    display.innerHTML = '<span class="text-gray-500">Click symbols above...</span>';
  } else {
    display.innerHTML = doorSequence.map(s => `
      <span class="text-3xl">${symbolMap[s]}</span>
    `).join('');
  }
}

function pushPuzzle() {
  const type = document.getElementById('puzzle-type').value;
  let data = {};

  if (type === 'choice') {
    data = {
      question: document.getElementById('choice-question').value,
      options: [
        document.getElementById('choice-opt1').value,
        document.getElementById('choice-opt2').value,
        document.getElementById('choice-opt3').value,
      ].filter(Boolean),
      correctAnswer: parseInt(document.getElementById('choice-answer').value) - 1,
    };
  } else if (type === 'riddle') {
    data = {
      question: document.getElementById('riddle-question').value,
      answer: document.getElementById('riddle-answer').value,
      hint: document.getElementById('riddle-hint').value,
    };
  } else if (type === 'sequence') {
    const items = document.getElementById('sequence-items').value.split('\n').filter(Boolean);
    const order = document.getElementById('sequence-order').value.split(',').map(n => parseInt(n.trim()) - 1);
    data = {
      instruction: document.getElementById('sequence-instruction').value,
      items,
      correctOrder: order,
    };
  } else if (type === 'lockedDoor') {
    if (doorSequence.length < 2) {
      alert('Please select at least 2 symbols for the sequence');
      return;
    }
    const uniqueSymbols = [...new Set(doorSequence)];
    data = {
      title: document.getElementById('door-title').value || 'Locked Door',
      symbols: uniqueSymbols.map(s => ({ id: s, display: symbolMap[s] })),
      correctSequence: doorSequence,
    };
  }

  ws.send('puzzle:push', {
    id: `puzzle_${Date.now()}`,
    type,
    data,
  });
}
