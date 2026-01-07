/**
 * GM Controller - Shared State Module
 * Centralized state management for the GM controller
 */

// === SESSION STATE ===
export let ws = null;
export let sessionId = null;
export let gmToken = null;
export let joinCode = null;

// === MAP/FOG STATE ===
export let mapImage = null;
export let mapCanvas = null;
export let mapCtx = null;
export let fogCanvas = null;
export let fogCtx = null;
export let fogDataCanvas = null;
export let fogDataCtx = null;
export let previewCanvas = null;
export let previewCtx = null;
export let previewDataCanvas = null;
export let previewDataCtx = null;
export let brushSize = 40;
export let isRevealing = true;
export let isDrawing = false;
export let hasPreview = false;

// === VIEWPORT STATE ===
export const viewport = {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
};
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.25;

// === MODE STATE ===
export const MODE = { ZOOM: 'zoom', DRAW: 'draw', FIGURE: 'figure' };
export let currentMode = MODE.ZOOM;
export let isSettingsModalOpen = false;
export let isPanning = false;
export let lastPanX = 0;
export let lastPanY = 0;

// === FIGURE STATE ===
export let figureCanvas = null;
export let figureCtx = null;
export let figures = [];
export let selectedFigureType = null;
export let selectedPlacedFigure = null;
export let lastFigureTapTime = 0;
export const DOUBLE_TAP_THRESHOLD = 350;
export let isFigurePaletteOpen = false;
export let activePing = null; // { x, y, timestamp }

// === BATCH STATE UPDATERS ===
// Use these for updating multiple related values at once

export function updateSession(updates) {
    if ('ws' in updates) ws = updates.ws;
    if ('sessionId' in updates) sessionId = updates.sessionId;
    if ('gmToken' in updates) gmToken = updates.gmToken;
    if ('joinCode' in updates) joinCode = updates.joinCode;
}

export function updateCanvases(updates) {
    if ('mapCanvas' in updates) mapCanvas = updates.mapCanvas;
    if ('mapCtx' in updates) mapCtx = updates.mapCtx;
    if ('fogCanvas' in updates) fogCanvas = updates.fogCanvas;
    if ('fogCtx' in updates) fogCtx = updates.fogCtx;
    if ('fogDataCanvas' in updates) fogDataCanvas = updates.fogDataCanvas;
    if ('fogDataCtx' in updates) fogDataCtx = updates.fogDataCtx;
    if ('previewCanvas' in updates) previewCanvas = updates.previewCanvas;
    if ('previewCtx' in updates) previewCtx = updates.previewCtx;
    if ('previewDataCanvas' in updates) previewDataCanvas = updates.previewDataCanvas;
    if ('previewDataCtx' in updates) previewDataCtx = updates.previewDataCtx;
    if ('figureCanvas' in updates) figureCanvas = updates.figureCanvas;
    if ('figureCtx' in updates) figureCtx = updates.figureCtx;
}

export function updateDrawing(updates) {
    if ('brushSize' in updates) brushSize = updates.brushSize;
    if ('isRevealing' in updates) isRevealing = updates.isRevealing;
    if ('isDrawing' in updates) isDrawing = updates.isDrawing;
    if ('hasPreview' in updates) hasPreview = updates.hasPreview;
}

export function updateMode(updates) {
    if ('currentMode' in updates) currentMode = updates.currentMode;
    if ('isSettingsModalOpen' in updates) isSettingsModalOpen = updates.isSettingsModalOpen;
    if ('isPanning' in updates) isPanning = updates.isPanning;
    if ('lastPanX' in updates) lastPanX = updates.lastPanX;
    if ('lastPanY' in updates) lastPanY = updates.lastPanY;
}

export function updateFigures(updates) {
    if ('figures' in updates) figures = updates.figures;
    if ('selectedFigureType' in updates) selectedFigureType = updates.selectedFigureType;
    if ('selectedPlacedFigure' in updates) selectedPlacedFigure = updates.selectedPlacedFigure;
    if ('lastFigureTapTime' in updates) lastFigureTapTime = updates.lastFigureTapTime;
    if ('isFigurePaletteOpen' in updates) isFigurePaletteOpen = updates.isFigurePaletteOpen;
    if ('activePing' in updates) activePing = updates.activePing;
}

// === INDIVIDUAL SETTERS (kept for backward compatibility) ===
export function setWs(value) { ws = value; }
export function setSessionId(value) { sessionId = value; }
export function setGmToken(value) { gmToken = value; }
export function setJoinCode(value) { joinCode = value; }
export function setMapImage(value) { mapImage = value; }
export function setMapCanvas(value) { mapCanvas = value; }
export function setMapCtx(value) { mapCtx = value; }
export function setFogCanvas(value) { fogCanvas = value; }
export function setFogCtx(value) { fogCtx = value; }
export function setFogDataCanvas(value) { fogDataCanvas = value; }
export function setFogDataCtx(value) { fogDataCtx = value; }
export function setPreviewCanvas(value) { previewCanvas = value; }
export function setPreviewCtx(value) { previewCtx = value; }
export function setPreviewDataCanvas(value) { previewDataCanvas = value; }
export function setPreviewDataCtx(value) { previewDataCtx = value; }
export function setBrushSizeValue(value) { brushSize = value; }
export function setIsRevealing(value) { isRevealing = value; }
export function setIsDrawing(value) { isDrawing = value; }
export function setHasPreview(value) { hasPreview = value; }
export function setCurrentMode(value) { currentMode = value; }
export function setIsSettingsModalOpen(value) { isSettingsModalOpen = value; }
export function setIsPanning(value) { isPanning = value; }
export function setLastPanX(value) { lastPanX = value; }
export function setLastPanY(value) { lastPanY = value; }
export function setFigureCanvas(value) { figureCanvas = value; }
export function setFigureCtx(value) { figureCtx = value; }
export function setFigures(value) { figures = value; }
export function setSelectedFigureType(value) { selectedFigureType = value; }
export function setSelectedPlacedFigure(value) { selectedPlacedFigure = value; }
export function setLastFigureTapTime(value) { lastFigureTapTime = value; }
export function setIsFigurePaletteOpen(value) { isFigurePaletteOpen = value; }
export function setActivePing(value) { activePing = value; }

// === PRESET MAPS ===
export const presetMaps = [
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

// === DOM ELEMENTS (cached references) ===
export const elements = {
    statusDot: null,
    statusText: null,
    sessionPanel: null,
    controlPanel: null,
    createSessionPanel: null,
    joinCodePanel: null,
    joinCode: null,
    tableConnected: null,
    settingsJoinCode: null,
};

// Initialize DOM element references (call after DOMContentLoaded)
export function initElements() {
    elements.statusDot = document.getElementById('status-dot');
    elements.statusText = document.getElementById('status-text');
    elements.sessionPanel = document.getElementById('session-panel');
    elements.controlPanel = document.getElementById('control-panel');
    elements.createSessionPanel = document.getElementById('create-session-panel');
    elements.joinCodePanel = document.getElementById('join-code-panel');
    elements.joinCode = document.getElementById('join-code');
    elements.tableConnected = document.getElementById('table-connected');
    elements.settingsJoinCode = document.getElementById('settings-join-code');
}
