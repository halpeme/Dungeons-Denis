/**
 * GM Controller - Viewport Module
 * Handles pan, zoom, rotation transforms
 */

import {
    viewport, MIN_ZOOM, MAX_ZOOM, mapCanvas, mapImage, MODE, currentMode, isPanning,
    setIsPanning
} from './state.js';

// Forward declaration - will be set by canvas.js to avoid circular dependency
let renderAllFn = null;
export function setRenderAll(fn) { renderAllFn = fn; }

// === VIEWPORT TRANSFORM FUNCTIONS ===

/**
 * Convert screen coordinates to canvas coordinates
 * Handles CSS scaling + viewport transform (pan, zoom, rotation)
 */
export function screenToCanvas(clientX, clientY) {
    const rect = mapCanvas.getBoundingClientRect();

    // Get position relative to the canvas element (in CSS/display pixels)
    const displayX = clientX - rect.left;
    const displayY = clientY - rect.top;

    // Scale from display size to internal canvas size
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

/**
 * Apply viewport transform to a canvas context
 */
export function applyViewportTransform(ctx) {
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

/**
 * Zoom centered on a specific screen point
 */
export function zoomAtPoint(clientX, clientY, scaleFactor) {
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
    updateCursor();
    if (renderAllFn) renderAllFn();
}

/**
 * Set zoom level (for button/slider controls)
 */
export function setZoom(newZoom) {
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));

    const mapViewportEl = document.getElementById('map-viewport');
    const centerX = mapViewportEl.clientWidth / 2;
    const centerY = mapViewportEl.clientHeight / 2;

    zoomAtPoint(centerX, centerY, zoom / viewport.scale);
    updateZoomDisplay();
}

/**
 * Set rotation (0, 90, 180, 270)
 */
export function setRotation(newRotation) {
    viewport.rotation = newRotation;
    if (renderAllFn) renderAllFn();
}

/**
 * Reset viewport to default (centered, 100% zoom, no rotation)
 */
export function resetViewport() {
    if (!mapImage) return;

    const mapViewportEl = document.getElementById('map-viewport');
    const container = document.getElementById('map-canvas-container');

    viewport.scale = 1.0;
    viewport.rotation = 0;
    viewport.x = (mapViewportEl.clientWidth - container.clientWidth) / 2;
    viewport.y = (mapViewportEl.clientHeight - container.clientHeight) / 2;

    if (renderAllFn) renderAllFn();
    updateZoomDisplay();
}

/**
 * Update zoom level display and reset button visibility
 */
export function updateZoomDisplay() {
    const percent = Math.round(viewport.scale * 100);
    const zoomLevelStr = `${percent}%`;

    const display = document.getElementById('zoom-level');
    if (display) display.textContent = zoomLevelStr;

    const slider = document.getElementById('zoom-slider');
    if (slider) {
        if (document.activeElement !== slider) {
            slider.value = viewport.scale;
        }
    }

    // Show/hide reset zoom button based on whether view is modified
    const resetBtn = document.getElementById('reset-zoom-btn');
    if (resetBtn && mapImage) {
        const isZoomed = Math.abs(viewport.scale - 1.0) > 0.01;
        const isRotated = viewport.rotation !== 0;
        const isPanned = Math.abs(viewport.x) > 10 || Math.abs(viewport.y) > 10;

        if (isZoomed || isRotated || isPanned) {
            resetBtn.classList.remove('hidden');
        } else {
            resetBtn.classList.add('hidden');
        }
    }
}

/**
 * Update cursor based on current mode
 */
export function updateCursor() {
    const fogCanvas = document.getElementById('fog-canvas');
    if (!fogCanvas) return;

    if (currentMode === MODE.ZOOM) {
        fogCanvas.style.cursor = isPanning ? 'grabbing' : 'grab';
    } else {
        fogCanvas.style.cursor = 'crosshair';
    }
}
