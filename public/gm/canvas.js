/**
 * GM Controller - Canvas Module
 * Handles canvas initialization and rendering
 */

import {
    mapCanvas, mapCtx, fogCanvas, fogCtx, figureCanvas, figureCtx,
    previewCanvas, previewCtx, fogDataCanvas, fogDataCtx,
    previewDataCanvas, previewDataCtx, mapImage, viewport, hasPreview,
    setMapCanvas, setMapCtx, setFogCanvas, setFogCtx,
    setFigureCanvas, setFigureCtx, setPreviewCanvas, setPreviewCtx,
    setFogDataCanvas, setFogDataCtx, setPreviewDataCanvas, setPreviewDataCtx,
    setMapImage, setHasPreview, figures
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

    // Render fog
    renderFogLayer();

    // Render figures
    renderFiguresLayer();

    // Render preview
    renderPreviewLayer();
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
    setMapCanvas(document.getElementById('map-canvas'));
    setFigureCanvas(document.getElementById('figure-canvas'));
    setFogCanvas(document.getElementById('fog-canvas'));
    setPreviewCanvas(document.getElementById('preview-canvas'));

    if (!mapCanvas || !fogCanvas) return;

    setMapCtx(mapCanvas.getContext('2d', { alpha: false }));
    setFogCtx(fogCanvas.getContext('2d'));
    if (figureCanvas) {
        setFigureCtx(figureCanvas.getContext('2d'));
    }
    if (previewCanvas) {
        setPreviewCtx(previewCanvas.getContext('2d'));
    }

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

    // Create/resize offscreen fog data canvas
    const newFogDataCanvas = document.createElement('canvas');
    newFogDataCanvas.width = canvasWidth;
    newFogDataCanvas.height = canvasHeight;
    setFogDataCanvas(newFogDataCanvas);
    setFogDataCtx(newFogDataCanvas.getContext('2d', { willReadFrequently: true }));

    // Create/resize offscreen preview data canvas
    const newPreviewDataCanvas = document.createElement('canvas');
    newPreviewDataCanvas.width = canvasWidth;
    newPreviewDataCanvas.height = canvasHeight;
    setPreviewDataCanvas(newPreviewDataCanvas);
    setPreviewDataCtx(newPreviewDataCanvas.getContext('2d', { willReadFrequently: true }));

    // Clear any existing preview
    if (previewDataCtx) {
        previewDataCtx.clearRect(0, 0, previewDataCanvas.width, previewDataCanvas.height);
    }
    setHasPreview(false);
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
    document.getElementById('figure-palette-floating')?.classList.remove('hidden');

    updateCursor();
}
