/**
 * GM Controller - Fog Module
 * Handles fog reveal/hide logic and preview
 */

import {
    fogDataCanvas, fogDataCtx, previewDataCanvas, previewDataCtx,
    previewCanvas, previewCtx, hasPreview, setHasPreview, ws
} from './state.js';

// Forward declaration - will be set to avoid circular dependency
let renderAllFn = null;
export function setRenderAllForFog(fn) { renderAllFn = fn; }

/**
 * Show preview action buttons
 */
export function showPreviewActions() {
    document.getElementById('preview-actions')?.classList.remove('hidden');
}

/**
 * Hide preview action buttons
 */
export function hidePreviewActions() {
    document.getElementById('preview-actions')?.classList.add('hidden');
}

/**
 * Confirm the fog preview - apply to actual fog
 */
export function confirmPreview() {
    if (!hasPreview || !previewDataCanvas || !fogDataCanvas) return;

    // Apply fog preview to fog data canvas (cut out the revealed areas)
    fogDataCtx.globalCompositeOperation = 'destination-out';
    fogDataCtx.drawImage(previewDataCanvas, 0, 0);
    fogDataCtx.globalCompositeOperation = 'source-over';

    // Clear preview data and display
    previewDataCtx.clearRect(0, 0, previewDataCanvas.width, previewDataCanvas.height);
    if (previewCtx) {
        previewCtx.setTransform(1, 0, 0, 1, 0, 0);
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    setHasPreview(false);
    hidePreviewActions();

    // Update display and sync to table
    if (renderAllFn) renderAllFn();
    sendFogUpdate();
}

/**
 * Cancel the fog preview
 */
export function cancelPreview() {
    // Clear the preview data and display canvases
    if (previewDataCtx && previewDataCanvas) {
        previewDataCtx.clearRect(0, 0, previewDataCanvas.width, previewDataCanvas.height);
    }
    if (previewCtx && previewCanvas) {
        previewCtx.setTransform(1, 0, 0, 1, 0, 0);
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    setHasPreview(false);
    hidePreviewActions();
}

/**
 * Clear fog - hide everything
 */
export function clearFog() {
    if (!fogDataCanvas) return;

    // Clear any preview first
    if (previewDataCtx && previewDataCanvas) {
        previewDataCtx.clearRect(0, 0, previewDataCanvas.width, previewDataCanvas.height);
    }
    if (previewCtx && previewCanvas) {
        previewCtx.setTransform(1, 0, 0, 1, 0, 0);
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    setHasPreview(false);
    hidePreviewActions();

    // Fill fog data with black (all hidden)
    fogDataCtx.globalCompositeOperation = 'source-over';
    fogDataCtx.fillStyle = '#000000';
    fogDataCtx.fillRect(0, 0, fogDataCanvas.width, fogDataCanvas.height);

    if (renderAllFn) renderAllFn();
    sendFogUpdate();
}

/**
 * Reveal all fog - show everything
 */
export function revealAll() {
    if (!fogDataCanvas) return;

    // Clear any preview first
    if (previewDataCtx && previewDataCanvas) {
        previewDataCtx.clearRect(0, 0, previewDataCanvas.width, previewDataCanvas.height);
    }
    if (previewCtx && previewCanvas) {
        previewCtx.setTransform(1, 0, 0, 1, 0, 0);
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
    setHasPreview(false);
    hidePreviewActions();

    // Clear the fog data canvas (all revealed)
    fogDataCtx.clearRect(0, 0, fogDataCanvas.width, fogDataCanvas.height);

    if (renderAllFn) renderAllFn();
    sendFogUpdate();
}

/**
 * Send fog update to server
 */
export function sendFogUpdate() {
    if (!fogDataCanvas || !ws) return;

    const fogData = fogDataCanvas.toDataURL('image/png');
    ws.send('map:fogUpdate', {
        fogMask: fogData,
    });
}

/**
 * Send partial fog update (dirty rectangle)
 */
export function sendFogPartial(x, y, w, h) {
    if (!fogDataCanvas || !ws) return;

    // Create temp canvas for the chunk
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const ctx = tempCanvas.getContext('2d');

    // Draw just the dirty rectangle
    ctx.drawImage(fogDataCanvas, x, y, w, h, 0, 0, w, h);

    const chunk = tempCanvas.toDataURL('image/png');
    ws.send('map:fogPartial', {
        x, y, w, h, chunk
    });
}

/**
 * Send full map state to server
 */
export function sendMapState(mapImage) {
    if (!mapImage || !fogDataCanvas || !ws) return;

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
