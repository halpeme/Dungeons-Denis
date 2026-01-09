/**
 * GM Controller - Canvas Module
 * Handles canvas initialization and rendering
 */

import {
    mapCanvas, mapCtx, fogCanvas, fogCtx, figureCanvas, figureCtx,
    previewCanvas, previewCtx, fogDataCanvas, fogDataCtx,
    previewDataCanvas, previewDataCtx, mapImage, viewport, hasPreview,
    updateCanvases, updateDrawing, updateGrid,
    setMapImage, figures, activePing, gridCanvas, gridCtx, gridConfig
} from './state.js';
import { applyViewportTransform, updateCursor, setRenderAll, resetViewport } from './viewport.js';
import { renderFiguresLayer, drawFigure } from './figures.js';
import { hidePreviewActions } from './fog.js';

/**
 * Render all canvas layers with viewport transform
 */
export function renderAll() {
    if (!mapImage || !mapCanvas) return;

    // Render map
    mapCtx.setTransform(1, 0, 0, 1, 0, 0);
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    applyViewportTransform(mapCtx);
    mapCtx.drawImage(mapImage, 0, 0);

    // Render grid
    renderGridLayer();

    // Render fog
    renderFogLayer();

    // Render figures
    renderFiguresLayer();

    // Render preview
    renderPreviewLayer();

    // Render ping
    renderPingLayer();
}

let lastPingLog = 0;

/**
 * Render ping layer
 */
export function renderPingLayer() {
    if (!activePing || !previewCtx) return;

    if (activePing.timestamp !== lastPingLog) {
        console.log('[GM] Rendering ping at', activePing.x, activePing.y);
        lastPingLog = activePing.timestamp;
    }

    const age = Date.now() - activePing.timestamp;
    const duration = 2000; // 2 seconds animation

    if (age > duration) return;

    const progress = age / duration;
    const maxRadius = 100;
    const currentRadius = 10 + (maxRadius * (1 - Math.pow(1 - progress, 3))); // Ease out
    const opacity = 1 - progress;

    previewCtx.save();
    previewCtx.shadowBlur = 0;
    previewCtx.globalAlpha = 1;

    previewCtx.beginPath();
    previewCtx.arc(activePing.x, activePing.y, currentRadius, 0, Math.PI * 2);
    previewCtx.strokeStyle = `rgba(245, 158, 11, ${opacity})`;
    previewCtx.lineWidth = 4;
    previewCtx.stroke();

    // Inner dot
    previewCtx.beginPath();
    previewCtx.arc(activePing.x, activePing.y, 5, 0, Math.PI * 2);
    previewCtx.fillStyle = `rgba(245, 158, 11, ${opacity})`;
    previewCtx.fill();

    previewCtx.restore();

    // Continue animation loop if active
    if (age < duration) {
        requestAnimationFrame(renderAll);
    }
}

/**
 * Render fog layer with viewport transform
 */
export function renderFogLayer() {
    if (!fogCtx || !fogCanvas || !fogDataCanvas) return;

    // Clear display canvas
    fogCtx.setTransform(1, 0, 0, 1, 0, 0);
    fogCtx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);

    // Apply viewport transform and draw from fog data
    applyViewportTransform(fogCtx);
    fogCtx.drawImage(fogDataCanvas, 0, 0);
}

/**
 * Render grid layer with viewport transform
 */
export function renderGridLayer() {
    if (!gridCtx || !gridCanvas) return;

    // Always clear the canvas first
    gridCtx.setTransform(1, 0, 0, 1, 0, 0);
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

    // Only draw if enabled and map exists
    if (!gridConfig.enabled || !mapImage) return;

    // Apply viewport transform
    applyViewportTransform(gridCtx);

    // Draw grid lines
    gridCtx.save();
    gridCtx.strokeStyle = gridConfig.color;
    gridCtx.globalAlpha = gridConfig.opacity;
    gridCtx.lineWidth = 1;

    const gridSize = gridConfig.size;
    const offsetX = gridConfig.offsetX;
    const offsetY = gridConfig.offsetY;

    // Calculate visible area in canvas coordinates
    const canvasWidth = mapImage.width;
    const canvasHeight = mapImage.height;

    // Draw vertical lines
    for (let x = offsetX; x <= canvasWidth; x += gridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, canvasHeight);
        gridCtx.stroke();
    }

    // Draw horizontal lines
    for (let y = offsetY; y <= canvasHeight; y += gridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(canvasWidth, y);
        gridCtx.stroke();
    }

    gridCtx.restore();
}

/**
 * Render preview layer with viewport transform
 */
export function renderPreviewLayer() {
    if (!previewCtx || !previewCanvas || !previewDataCanvas) return;

    // Clear display canvas
    previewCtx.setTransform(1, 0, 0, 1, 0, 0);
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    // Apply viewport transform and draw from preview data
    applyViewportTransform(previewCtx);
    previewCtx.drawImage(previewDataCanvas, 0, 0);
}

/**
 * Initialize map canvas references
 */
export function initMapCanvas() {
    const map = document.getElementById('map-canvas');
    const figure = document.getElementById('figure-canvas');
    const fog = document.getElementById('fog-canvas');
    const preview = document.getElementById('preview-canvas');
    const grid = document.getElementById('grid-canvas');

    updateCanvases({
        mapCanvas: map,
        figureCanvas: figure,
        fogCanvas: fog,
        previewCanvas: preview
    });

    updateGrid({
        gridCanvas: grid
    });

    if (!map || !fog) return;

    updateCanvases({
        mapCtx: map.getContext('2d', { alpha: false }),
        fogCtx: fog.getContext('2d'),
        figureCtx: figure?.getContext('2d'),
        previewCtx: preview?.getContext('2d')
    });

    updateGrid({
        gridCtx: grid?.getContext('2d')
    });

    // Register renderAll with viewport module
    setRenderAll(renderAll);
}

/**
 * Setup all canvases for a loaded image
 */
export function setupMapCanvases(img) {
    const container = document.getElementById('map-canvas-container');
    const mapViewportEl = document.getElementById('map-viewport');

    // Get parent width - use full width
    const parentWidth = mapViewportEl.parentElement.clientWidth;

    // Calculate max height
    const maxHeight = window.innerHeight - 110;

    // Calculate dimensions that fit within constraints
    const aspectRatio = img.height / img.width;
    let displayWidth = parentWidth;
    let displayHeight = parentWidth * aspectRatio;

    if (displayHeight > maxHeight) {
        displayHeight = maxHeight;
        displayWidth = displayHeight / aspectRatio;
    }

    // Update container and viewport size
    container.style.width = `${displayWidth}px`;
    container.style.height = `${displayHeight}px`;
    mapViewportEl.style.width = `${displayWidth}px`;
    mapViewportEl.style.height = `${displayHeight}px`;

    // Performance optimization - limit canvas size
    const MAX_CANVAS_SIZE = 2048;
    let canvasWidth = img.width;
    let canvasHeight = img.height;

    if (canvasWidth > MAX_CANVAS_SIZE || canvasHeight > MAX_CANVAS_SIZE) {
        const scale = Math.min(MAX_CANVAS_SIZE / canvasWidth, MAX_CANVAS_SIZE / canvasHeight);
        canvasWidth = Math.round(canvasWidth * scale);
        canvasHeight = Math.round(canvasHeight * scale);

        // Create downscaled version
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = canvasWidth;
        scaledCanvas.height = canvasHeight;
        const scaledCtx = scaledCanvas.getContext('2d');
        scaledCtx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

        const scaledImg = new Image();
        scaledImg.src = scaledCanvas.toDataURL('image/jpeg', 0.9);
        setMapImage(scaledImg);

        console.log(`Image downscaled from ${img.width}x${img.height} to ${canvasWidth}x${canvasHeight}`);
    }

    // Set canvas dimensions
    mapCanvas.width = canvasWidth;
    mapCanvas.height = canvasHeight;
    if (gridCanvas) {
        gridCanvas.width = canvasWidth;
        gridCanvas.height = canvasHeight;
    }
    if (figureCanvas) {
        figureCanvas.width = canvasWidth;
        figureCanvas.height = canvasHeight;
    }
    fogCanvas.width = canvasWidth;
    fogCanvas.height = canvasHeight;
    if (previewCanvas) {
        previewCanvas.width = canvasWidth;
        previewCanvas.height = canvasHeight;
    }

    // Create/resize offscreen data canvases
    const newFogDataCanvas = document.createElement('canvas');
    newFogDataCanvas.width = canvasWidth;
    newFogDataCanvas.height = canvasHeight;

    const newPreviewDataCanvas = document.createElement('canvas');
    newPreviewDataCanvas.width = canvasWidth;
    newPreviewDataCanvas.height = canvasHeight;

    updateCanvases({
        fogDataCanvas: newFogDataCanvas,
        fogDataCtx: newFogDataCanvas.getContext('2d', { willReadFrequently: true }),
        previewDataCanvas: newPreviewDataCanvas,
        previewDataCtx: newPreviewDataCanvas.getContext('2d', { willReadFrequently: true })
    });

    // Clear any existing preview
    if (previewDataCtx) {
        previewDataCtx.clearRect(0, 0, previewDataCanvas.width, previewDataCanvas.height);
    }
    updateDrawing({ hasPreview: false });
    hidePreviewActions();

    // Make fog visible but semi-transparent for GM
    fogCanvas.style.opacity = '0.4';

    // Reset viewport with delay for DOM layout
    setTimeout(() => {
        resetViewport();
    }, 50);
}

/**
 * Show the map canvas section
 */
export function showMapCanvas() {
    document.getElementById('map-upload-section').classList.add('hidden');
    document.getElementById('map-canvas-section').classList.remove('hidden');
    document.getElementById('mode-toggle')?.classList.remove('hidden');
    document.getElementById('settings-toggle-btn')?.classList.remove('hidden');
    updateCursor();
}
