/**
 * GM Controller - Main Entry Point
 * Dungeons & Denis - Image-based Fog of War
 */

// === IMPORTS ===
import {
  setWs, setSessionId, setGmToken, setJoinCode,
  setMapImage, setFigures, setIsDrawing, setIsPanning, setLastPanX, setLastPanY,
  setHasPreview, setSelectedFigureType, setSelectedPlacedFigure, setLastFigureTapTime,
  setActivePing,
  ws, sessionId, gmToken, joinCode, mapImage, figures, elements, initElements,
  MODE, currentMode, viewport, MIN_ZOOM, MAX_ZOOM, brushSize, isRevealing, isDrawing,
  isPanning, lastPanX, lastPanY, hasPreview, selectedFigureType, selectedPlacedFigure,
  lastFigureTapTime, DOUBLE_TAP_THRESHOLD, activePing, presetMaps,
  fogCanvas, fogDataCanvas, fogDataCtx, previewDataCanvas, previewDataCtx, mapCanvas
} from './state.js';

import {
  screenToCanvas, applyViewportTransform, zoomAtPoint, updateZoomDisplay, updateCursor, resetViewport
} from './viewport.js';

import {
  generateFigureId, renderFigures, renderFiguresLayer, findFigureAtPosition,
  clearPaletteSelection, updateFigurePalette, sendFiguresUpdate
} from './figures.js';

import {
  clearFog, revealAll, confirmPreview, cancelPreview, showPreviewActions, sendFogUpdate, sendMapState,
  setRenderAllForFog
} from './fog.js';

import {
  initMapCanvas, setupMapCanvases, showMapCanvas, renderAll, renderFogLayer, renderPreviewLayer
} from './canvas.js';

import {
  initEventListeners, setMode, updateConnectionStatus, showJoinCode, showControlPanel
} from './ui.js';

// === WEBSOCKET CLIENT ===
// WSClient is loaded via separate script tag (non-module)
const WSClient = window.WSClient;

// === PRESET MAPS ===
const availableMaps = new Set();

function initPresetMaps() {
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

  document.getElementById('preset-category-filter')?.addEventListener('change', (e) => {
    renderPresetMapsGrid('preset-maps-grid', e.target.value);
  });
  document.getElementById('preset-category-filter-loaded')?.addEventListener('change', (e) => {
    renderPresetMapsGrid('preset-maps-grid-loaded', e.target.value);
  });
}

function renderPresetMapsGrid(gridId, category) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  grid.innerHTML = '';
  const isCompact = gridId.includes('loaded');
  const filteredMaps = category === 'all' ? presetMaps : presetMaps.filter(m => m.category === category);
  filteredMaps.sort((a, b) => a.name.localeCompare(b.name));

  filteredMaps.forEach(map => {
    const isAvailable = availableMaps.has(map.id);
    const btn = document.createElement('button');

    if (isCompact) {
      btn.className = `preset-map-btn text-xs p-1 rounded transition-colors ${isAvailable ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-800 opacity-50 cursor-not-allowed'}`;
      btn.textContent = map.name;
    } else {
      btn.className = `preset-map-btn p-2 rounded-lg text-sm flex flex-col items-center gap-1 transition-colors ${isAvailable ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-800 opacity-50 cursor-not-allowed'}`;
      btn.innerHTML = `<span class="font-bold text-xs">${map.name}</span><span class="text-xs text-gray-400">${map.category}</span>`;
    }

    if (isAvailable) {
      btn.onclick = () => loadPresetMap(map);
    } else {
      btn.title = 'Map not downloaded. Run: npm run download-maps';
    }
    grid.appendChild(btn);
  });
}

function updateEmptyMessage() {
  const emptyMsg = document.getElementById('preset-maps-empty');
  if (emptyMsg) {
    emptyMsg.classList.toggle('hidden', availableMaps.size > 0);
  }
}

function loadPresetMap(map) {
  resetViewport();
  const img = new Image();
  img.onload = () => {
    setMapImage(img);
    showMapCanvas();
    setupMapCanvases(img);
    clearFog();
    sendMapState(mapImage);
  };
  img.dataset.originalPath = map.path;
  img.onerror = () => alert(`Failed to load map: ${map.name}\nRun 'npm run download-maps' to download preset maps.`);
  img.src = map.path;
}

// === MAP HANDLING ===
function handleMapUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  resetViewport();
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      setMapImage(img);
      showMapCanvas();
      setupMapCanvases(img);
      clearFog();
      sendMapState(mapImage);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function loadMapFromData(imageData, fogMaskData) {
  const img = new Image();
  img.onload = () => {
    setMapImage(img);
    showMapCanvas();
    setupMapCanvases(img);

    if (fogMaskData) {
      const fogImg = new Image();
      fogImg.onload = () => {
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

// === DRAWING HANDLERS ===
let dirtyRect = null;
let fogUpdateTimeout = null;

function updateDirtyRect(x, y, radius) {
  const minX = Math.floor(x - radius);
  const minY = Math.floor(y - radius);
  const maxX = Math.ceil(x + radius);
  const maxY = Math.ceil(y + radius);

  if (!dirtyRect) {
    dirtyRect = { minX, minY, maxX, maxY };
  } else {
    dirtyRect.minX = Math.min(dirtyRect.minX, minX);
    dirtyRect.minY = Math.min(dirtyRect.minY, minY);
    dirtyRect.maxX = Math.max(dirtyRect.maxX, maxX);
    dirtyRect.maxY = Math.max(dirtyRect.maxY, maxY);
  }
}

function startDrawing(e) {
  if (!mapImage) return;

  const pos = screenToCanvas(e.clientX, e.clientY);

  // ZOOM mode: pan/zoom only (no figures, no fog)
  if (currentMode === MODE.ZOOM) {
    setIsPanning(true);
    setLastPanX(e.clientX);
    setLastPanY(e.clientY);
    updateCursor();
    return;
  }

  // FIGURE mode: figure interactions only (no fog reveal)
  if (currentMode === MODE.FIGURE) {
    const clickedFigure = findFigureAtPosition(pos);
    const now = Date.now();

    if (clickedFigure) {
      // Double-tap to delete
      if (selectedPlacedFigure === clickedFigure.id && (now - lastFigureTapTime) < DOUBLE_TAP_THRESHOLD) {
        setFigures(figures.filter(f => f.id !== clickedFigure.id));
        setSelectedPlacedFigure(null);
        setLastFigureTapTime(0);
        renderFigures();
        sendFiguresUpdate();
        return;
      }
      // Select figure
      setSelectedPlacedFigure(clickedFigure.id);
      setSelectedFigureType(null);
      clearPaletteSelection();
      setLastFigureTapTime(now);
      renderFigures();
      return;
    }

    // Place new figure if type selected
    if (selectedFigureType) {
      const newFigure = {
        id: generateFigureId(),
        type: selectedFigureType.type,
        number: selectedFigureType.number,
        position: pos,
        createdAt: Date.now()
      };
      setFigures([...figures, newFigure]);
      setSelectedFigureType(null);
      clearPaletteSelection();
      renderFigures();
      sendFiguresUpdate();
      updateFigurePalette();
      return;
    }

    // Move selected figure
    if (selectedPlacedFigure) {
      const fig = figures.find(f => f.id === selectedPlacedFigure);
      if (fig) {
        fig.position = pos;
        setSelectedPlacedFigure(null);
        renderFigures();
        sendFiguresUpdate();
      }
      return;
    }

    return; // No action if no figure selected
  }

  // DRAW mode: fog reveal only
  if (currentMode === MODE.DRAW) {
    setIsDrawing(true);
    dirtyRect = null; // Reset dirty rect
    draw(e);
  }
}

function draw(e) {
  if (!mapImage) return;

  if (isPanning) {
    const rect = mapCanvas.getBoundingClientRect();
    const scaleX = mapCanvas.width / rect.width;
    const scaleY = mapCanvas.height / rect.height;
    const dx = (e.clientX - lastPanX) * scaleX;
    const dy = (e.clientY - lastPanY) * scaleY;

    viewport.x += dx;
    viewport.y += dy;
    setLastPanX(e.clientX);
    setLastPanY(e.clientY);
    renderAll();
    return;
  }

  if (!isDrawing) return;

  const pos = screenToCanvas(e.clientX, e.clientY);
  const brushRadius = brushSize / viewport.scale;

  if (isRevealing) {
    previewDataCtx.fillStyle = '#00ff66';
    previewDataCtx.beginPath();
    previewDataCtx.arc(pos.x, pos.y, brushRadius, 0, Math.PI * 2);
    previewDataCtx.fill();
    renderPreviewLayer();
    setHasPreview(true);
    showPreviewActions();
  } else {
    fogDataCtx.globalCompositeOperation = 'source-over';
    fogDataCtx.fillStyle = '#000000';
    fogDataCtx.beginPath();
    fogDataCtx.arc(pos.x, pos.y, brushRadius, 0, Math.PI * 2);
    fogDataCtx.fill();
    renderAll();

    // Track dirty rect
    updateDirtyRect(pos.x, pos.y, brushRadius);
  }
}

function stopDrawing(e) {
  if (isPanning) {
    setIsPanning(false);
    updateCursor();
    updateZoomDisplay();
    return;
  }

  if (isDrawing) {
    setIsDrawing(false);

    if (!isRevealing) {
      // Send partial update immediately
      if (dirtyRect && fogDataCanvas) {
        // Clamp to canvas bounds
        const x = Math.max(0, dirtyRect.minX);
        const y = Math.max(0, dirtyRect.minY);
        const w = Math.min(fogDataCanvas.width - x, dirtyRect.maxX - x);
        const h = Math.min(fogDataCanvas.height - y, dirtyRect.maxY - y);

        if (w > 0 && h > 0) {
          import('./fog.js').then(fog => fog.sendFogPartial(x, y, w, h));
        }
      }

      // Debounce full update to server for persistence
      if (fogUpdateTimeout) clearTimeout(fogUpdateTimeout);
      fogUpdateTimeout = setTimeout(() => {
        sendFogUpdate();
      }, 2000);
    }
  }
}

// === CANVAS INTERACTION SETUP ===
function setupCanvasInteraction() {
  if (!fogCanvas) return;

  fogCanvas.addEventListener('pointerdown', startDrawing);
  fogCanvas.addEventListener('pointermove', draw);
  fogCanvas.addEventListener('pointerup', stopDrawing);
  fogCanvas.addEventListener('pointerleave', stopDrawing);
  fogCanvas.style.touchAction = 'none';

  // Pinch-to-zoom state
  let initialPinchDistance = null;
  let initialPinchZoom = null;
  let initialPinchCenter = null;
  let initialViewportX = null;
  let initialViewportY = null;
  let pinchStarted = false;
  let pinchStabilizeCount = 0;
  let pinchHistory = [];
  const PINCH_HISTORY_SIZE = 5;
  let pinchAnimationFrame = null;
  let pendingPinchUpdate = null;

  function processPinchUpdate() {
    if (!pendingPinchUpdate) { pinchAnimationFrame = null; return; }
    const { newScale, newX, newY } = pendingPinchUpdate;
    viewport.scale = newScale;
    viewport.x = newX;
    viewport.y = newY;
    updateZoomDisplay();
    renderAll();
    pendingPinchUpdate = null;
    pinchAnimationFrame = null;
  }

  fogCanvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      setIsPanning(false);
      if (currentMode !== MODE.ZOOM) return;
      e.preventDefault();
      pinchStarted = false;
      pinchStabilizeCount = 0;
      initialPinchDistance = null;
      pendingPinchUpdate = null;
      pinchHistory = [];
    }
  }, { passive: false });

  fogCanvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      if (currentMode !== MODE.ZOOM) return;
      e.preventDefault();
      const t1 = e.touches[0], t2 = e.touches[1];
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      if (initialPinchDistance === null) {
        pinchStabilizeCount++;
        if (pinchStabilizeCount < (dist > 200 ? 8 : 6)) return;
        initialPinchDistance = dist;
        initialPinchZoom = viewport.scale;
        initialPinchCenter = { x: cx, y: cy };
        initialViewportX = viewport.x;
        initialViewportY = viewport.y;
        pinchHistory = Array(PINCH_HISTORY_SIZE).fill({ distance: dist, centerX: cx, centerY: cy });
        return;
      }

      pinchHistory.push({ distance: dist, centerX: cx, centerY: cy });
      if (pinchHistory.length > PINCH_HISTORY_SIZE) pinchHistory.shift();

      const avgDist = pinchHistory.reduce((s, i) => s + i.distance, 0) / pinchHistory.length;
      const zoomRatio = avgDist / initialPinchDistance;

      if (!pinchStarted && Math.abs(zoomRatio - 1) < 0.10) return;
      if (!pinchStarted) {
        initialPinchDistance = dist;
        initialPinchCenter = { x: cx, y: cy };
        initialViewportX = viewport.x;
        initialViewportY = viewport.y;
        initialPinchZoom = viewport.scale;
        pinchStarted = true;
        return;
      }

      const newZoomRatio = avgDist / initialPinchDistance;
      const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, initialPinchZoom * newZoomRatio));
      const rect = mapCanvas.getBoundingClientRect();
      const scaleX = mapCanvas.width / rect.width;
      const scaleY = mapCanvas.height / rect.height;
      const initInternalX = (initialPinchCenter.x - rect.left) * scaleX;
      const initInternalY = (initialPinchCenter.y - rect.top) * scaleY;
      const worldX = (initInternalX - initialViewportX) / initialPinchZoom;
      const worldY = (initInternalY - initialViewportY) / initialPinchZoom;
      const newX = initInternalX - worldX * newScale;
      const newY = initInternalY - worldY * newScale;

      pendingPinchUpdate = { newScale, newX, newY };
      if (!pinchAnimationFrame) pinchAnimationFrame = requestAnimationFrame(processPinchUpdate);
    }
  }, { passive: false });

  fogCanvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      initialPinchDistance = null;
      initialPinchZoom = null;
      initialPinchCenter = null;
      initialViewportX = null;
      initialViewportY = null;
      pinchStarted = false;
      pinchStabilizeCount = 0;
      pendingPinchUpdate = null;
      if (pinchAnimationFrame) { cancelAnimationFrame(pinchAnimationFrame); pinchAnimationFrame = null; }
    }
  });

  // Mouse wheel zoom
  document.getElementById('map-viewport')?.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAtPoint(e.clientX, e.clientY, e.deltaY > 0 ? 0.9 : 1.1);
  }, { passive: false });
}

// === WEBSOCKET SETUP ===
function initWebSocket() {
  const wsClient = new WSClient();
  setWs(wsClient);
  // Expose to window for beforeunload/pagehide cleanup handlers
  window.wsClient = wsClient;

  wsClient.on('connecting', () => {
    updateConnectionStatus('connecting');
  });

  wsClient.on('connected', () => {
    updateConnectionStatus('connected');
    // Auto-create/reconnect to session (single-session mode)
    wsClient.createSession();
  });

  wsClient.on('disconnected', () => updateConnectionStatus('disconnected'));

  wsClient.on('reconnecting', (data) => {
    updateConnectionStatus('reconnecting', data);
  });

  wsClient.on('session:created', (data) => {
    setSessionId(data.sessionId);
    setGmToken(data.gmToken);
    setJoinCode(data.joinCode);
    saveSession();
    showJoinCode(data.joinCode);
    showControlPanel();
  });

  wsClient.on('session:reconnected', (data) => {
    setSessionId(data.sessionId);
    setJoinCode(data.joinCode);
    showJoinCode(data.joinCode);
    showControlPanel();
  });

  wsClient.on('session:state', (data) => {
    if (data.mapImage) loadMapFromData(data.mapImage, data.fogMask);
    if (data.figures?.length > 0) {
      setFigures(data.figures);
      renderFigures();
    }
  });

  wsClient.on('table:connected', () => {
    if (elements.tableConnected) {
      elements.tableConnected.textContent = 'Connected';
      elements.tableConnected.className = 'ml-2 text-green-400';
    }
    if (mapImage) sendMapState(mapImage);
  });

  wsClient.on('table:disconnected', () => {
    if (elements.tableConnected) {
      elements.tableConnected.textContent = 'Not Connected';
      elements.tableConnected.className = 'ml-2 text-red-400';
    }
  });

  wsClient.on('map:ping', (data) => {
    console.log('[GM] Received map:ping', data);
    // data.payload = { x, y }
    setActivePing({
      x: data.x,
      y: data.y,
      timestamp: Date.now()
    });
    renderAll();

    // Auto-clear ping after animation (e.g. 5 seconds)
    setTimeout(() => {
      if (activePing && Date.now() - activePing.timestamp > 4500) {
        setActivePing(null);
        renderAll();
      }
    }, 5000);
  });

  wsClient.on('error', (data) => {
    console.error('Server error:', data);
    alert(`Error: ${data.message}`);
  });

  // Wire up retry button
  document.getElementById('retry-btn')?.addEventListener('click', () => {
    wsClient.retryNow();
  });

  wsClient.connect();
  return wsClient;
}

// === SESSION MANAGEMENT ===
function getSavedSession() {
  const saved = localStorage.getItem('dungeon-bridge-session');
  return saved ? JSON.parse(saved) : null;
}

function saveSession() {
  localStorage.setItem('dungeon-bridge-session', JSON.stringify({ sessionId, gmToken }));
}

function clearSession() {
  localStorage.removeItem('dungeon-bridge-session');
}

// === WINDOW RESIZE ===
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (mapImage) {
      const container = document.getElementById('map-canvas-container');
      const mapViewportEl = document.getElementById('map-viewport');
      const maxHeight = window.innerHeight - 110;
      const aspectRatio = mapImage.height / mapImage.width;
      const parentWidth = mapViewportEl.parentElement.clientWidth;
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
      renderAll();
    }
  }, 100);
});

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  const wsClient = initWebSocket();
  window.wsClient = wsClient; // Exposed for debugging

  // Register renderAll with fog module
  setRenderAllForFog(renderAll);

  initEventListeners({
    onCreateSession: () => wsClient.createSession(),
    onReconnect: () => {
      const saved = getSavedSession();
      if (saved) wsClient.reconnectSession(saved.sessionId, saved.gmToken);
      else alert('No saved session found');
    },
    onEndSession: () => {
      if (confirm('Are you sure you want to end this session?')) {
        clearSession();
        location.reload();
      }
    },
    onMapUpload: handleMapUpload,
    ws: wsClient
  });

  initMapCanvas();
  setupCanvasInteraction();
  initPresetMaps();

  // Force settings panel closed
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) settingsModal.classList.add('hidden');
});
