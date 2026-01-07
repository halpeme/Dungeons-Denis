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
 * Clear all preview canvases and reset preview state
 * Extracted common pattern used by confirmPreview, cancelPreview, clearFog, revealAll
 */
function clearPreviewCanvases() {
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
 * Confirm the fog preview - apply to actual fog
 */
export function confirmPreview() {
    if (!hasPreview || !previewDataCanvas || !fogDataCanvas) return;

    // Apply fog preview to fog data canvas (cut out the revealed areas)
    fogDataCtx.globalCompositeOperation = 'destination-out';
    fogDataCtx.drawImage(previewDataCanvas, 0, 0);
    fogDataCtx.globalCompositeOperation = 'source-over';

    // Clear preview
    clearPreviewCanvases();

    // Update display and sync to table
    if (renderAllFn) renderAllFn();
    sendFogUpdate();
}

/**
 * Cancel the fog preview
 */
export function cancelPreview() {
    clearPreviewCanvases();
}

/**
 * Clear fog - hide everything
 */
export function clearFog() {
    if (!fogDataCanvas) return;

    // Clear any preview first
    clearPreviewCanvases();

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
    clearPreviewCanvases();

    // Clear the fog data canvas (all revealed)
    fogDataCtx.clearRect(0, 0, fogDataCanvas.width, fogDataCanvas.height);

    if (renderAllFn) renderAllFn();
    sendFogUpdate();
}

/**
 * Upload a blob to the server and return the URL
 */
async function uploadImage(blob) {
    const formData = new FormData();
    formData.append('file', blob);
    const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url;
}

/**
 * Send fog update to server
 */
export async function sendFogUpdate() {
    if (!fogDataCanvas || !ws) return;

    try {
        const blob = await new Promise(resolve => fogDataCanvas.toBlob(resolve, 'image/png'));
        if (!blob) return;

        const url = await uploadImage(blob);
        ws.send('map:fogUpdate', {
            fogMask: url,
        });
    } catch (err) {
        console.error('Failed to send fog update:', err);
    }
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
export async function sendMapState(mapImage) {
    if (!mapImage || !fogDataCanvas || !ws) return;

    try {
        let mapUrl;
        if (mapImage.dataset && mapImage.dataset.originalPath) {
            // Use the relative path for presets
            mapUrl = mapImage.dataset.originalPath;
        } else {
            // Create a temp canvas to draw the untransformed map
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = mapImage.width;
            tempCanvas.height = mapImage.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(mapImage, 0, 0);

            const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/jpeg', 0.8));
            mapUrl = await uploadImage(blob);
        }

        const fogBlob = await new Promise(resolve => fogDataCanvas.toBlob(resolve, 'image/png'));
        const fogUrl = await uploadImage(fogBlob);

        ws.send('map:state', {
            mapImage: mapUrl,
            fogMask: fogUrl,
        });
    } catch (err) {
        console.error('Failed to send map state:', err);
    }
}
