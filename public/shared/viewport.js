/**
 * Shared Viewport Utilities
 * Common viewport transform functions for both GM and Table clients
 */

/**
 * Convert screen coordinates to internal canvas coordinates
 * Handles CSS scaling from display size to canvas buffer size
 * @param {number} clientX - Screen X coordinate
 * @param {number} clientY - Screen Y coordinate
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @returns {{x: number, y: number}} Internal canvas coordinates
 */
export function screenToCanvasRaw(clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

/**
 * Convert screen coordinates to world/map coordinates
 * Handles CSS scaling + viewport transform (pan, zoom, rotation)
 * @param {number} clientX - Screen X coordinate
 * @param {number} clientY - Screen Y coordinate
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {{x: number, y: number, scale: number, rotation?: number}} viewport - Viewport state
 * @returns {{x: number, y: number}} World coordinates
 */
export function screenToWorld(clientX, clientY, canvas, viewport) {
  const rect = canvas.getBoundingClientRect();

  // Get position relative to the canvas element (in CSS/display pixels)
  const displayX = clientX - rect.left;
  const displayY = clientY - rect.top;

  // Scale from display size to internal canvas size
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const internalX = displayX * scaleX;
  const internalY = displayY * scaleY;

  // Apply inverse viewport transform (undo pan and zoom)
  const x = (internalX - viewport.x) / viewport.scale;
  const y = (internalY - viewport.y) / viewport.scale;

  // Handle rotation (rotate point around canvas center)
  const rotation = viewport.rotation || 0;
  if (rotation !== 0) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radians = -rotation * Math.PI / 180;
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
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {{x: number, y: number, scale: number, rotation?: number}} viewport - Viewport state
 * @param {HTMLCanvasElement} [canvas] - Canvas element (required if rotation is used)
 */
export function applyViewportTransform(ctx, viewport, canvas = null) {
  ctx.translate(viewport.x, viewport.y);
  ctx.scale(viewport.scale, viewport.scale);

  const rotation = viewport.rotation || 0;
  if (rotation !== 0 && canvas) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    ctx.translate(cx, cy);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-cx, -cy);
  } else if (rotation !== 0) {
    // Simple rotation without center pivot (table.js style)
    ctx.rotate(rotation * Math.PI / 180);
  }
}

/**
 * Zoom viewport centered on a specific screen point
 * @param {number} clientX - Screen X coordinate
 * @param {number} clientY - Screen Y coordinate
 * @param {number} scaleFactor - Multiplier for current scale
 * @param {HTMLCanvasElement} canvas - The canvas element
 * @param {{x: number, y: number, scale: number, rotation?: number}} viewport - Viewport state (modified in place)
 * @param {number} minZoom - Minimum zoom level
 * @param {number} maxZoom - Maximum zoom level
 * @returns {{x: number, y: number, scale: number}} Updated viewport values
 */
export function zoomAtPoint(clientX, clientY, scaleFactor, canvas, viewport, minZoom, maxZoom) {
  // Get world point under cursor BEFORE zoom
  const worldPoint = screenToWorld(clientX, clientY, canvas, viewport);

  // Apply zoom with clamping
  const newScale = viewport.scale * scaleFactor;
  viewport.scale = Math.max(minZoom, Math.min(maxZoom, newScale));

  // Convert screen position to internal canvas coordinates
  const rect = canvas.getBoundingClientRect();
  const displayX = clientX - rect.left;
  const displayY = clientY - rect.top;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const internalX = displayX * scaleX;
  const internalY = displayY * scaleY;

  // Adjust pan so cursor stays on same world point
  viewport.x = internalX - worldPoint.x * viewport.scale;
  viewport.y = internalY - worldPoint.y * viewport.scale;

  return { x: viewport.x, y: viewport.y, scale: viewport.scale };
}

/**
 * Clamp zoom level to min/max bounds
 * @param {number} scale - Proposed scale value
 * @param {number} minZoom - Minimum zoom level
 * @param {number} maxZoom - Maximum zoom level
 * @returns {number} Clamped scale value
 */
export function clampZoom(scale, minZoom, maxZoom) {
  return Math.max(minZoom, Math.min(maxZoom, scale));
}
