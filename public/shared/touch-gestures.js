/**
 * Shared Touch Gesture Handler
 * Provides pinch-to-zoom and pan gesture support for both GM and Table clients
 */

/**
 * Create a pinch-to-zoom and pan gesture handler
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.element - The element to attach listeners to
 * @param {HTMLCanvasElement} options.canvas - The canvas for coordinate calculations
 * @param {Object} options.viewport - Viewport state object {x, y, scale, rotation?}
 * @param {number} options.minZoom - Minimum zoom level
 * @param {number} options.maxZoom - Maximum zoom level
 * @param {function} options.onUpdate - Callback when viewport changes
 * @param {function} [options.onPanStart] - Callback when panning starts
 * @param {function} [options.onPanEnd] - Callback when panning ends
 * @param {boolean} [options.enablePan=true] - Enable single-finger panning
 * @param {boolean} [options.enablePinch=true] - Enable pinch-to-zoom
 * @param {boolean} [options.useStabilization=true] - Use stabilization for pinch (recommended for drawing apps)
 * @param {number} [options.stabilizeFrames=6] - Frames to wait before starting pinch
 * @param {number} [options.historySize=5] - Number of samples for smoothing
 * @param {number} [options.deadzone=0.10] - Zoom ratio deadzone before activation
 * @returns {Object} Handler object with cleanup method
 */
export function createTouchGestureHandler(options) {
  const {
    element,
    canvas,
    viewport,
    minZoom,
    maxZoom,
    onUpdate,
    onPanStart,
    onPanEnd,
    enablePan = true,
    enablePinch = true,
    useStabilization = true,
    stabilizeFrames = 6,
    historySize = 5,
    deadzone = 0.10
  } = options;

  // Pinch state
  let initialPinchDistance = null;
  let initialPinchZoom = null;
  let initialPinchCenter = null;
  let initialViewportX = null;
  let initialViewportY = null;
  let pinchStarted = false;
  let pinchStabilizeCount = 0;
  let pinchHistory = [];
  let pinchAnimationFrame = null;
  let pendingPinchUpdate = null;

  // Pan state
  let lastTouchX = 0;
  let lastTouchY = 0;
  let fingerCount = 0;
  let isPanning = false;

  function processPinchUpdate() {
    if (!pendingPinchUpdate) {
      pinchAnimationFrame = null;
      return;
    }
    const { newScale, newX, newY } = pendingPinchUpdate;
    viewport.scale = newScale;
    viewport.x = newX;
    viewport.y = newY;
    pendingPinchUpdate = null;
    pinchAnimationFrame = null;
    onUpdate();
  }

  function resetPinchState() {
    initialPinchDistance = null;
    initialPinchZoom = null;
    initialPinchCenter = null;
    initialViewportX = null;
    initialViewportY = null;
    pinchStarted = false;
    pinchStabilizeCount = 0;
    pendingPinchUpdate = null;
    pinchHistory = [];
    if (pinchAnimationFrame) {
      cancelAnimationFrame(pinchAnimationFrame);
      pinchAnimationFrame = null;
    }
  }

  function handleTouchStart(e) {
    fingerCount = e.touches.length;

    if (fingerCount === 1 && enablePan) {
      // Pan start
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      isPanning = true;
      if (onPanStart) onPanStart();
    } else if (fingerCount === 2 && enablePinch) {
      // Pinch start
      e.preventDefault();
      isPanning = false;

      if (useStabilization) {
        // Reset for stabilized start
        pinchStarted = false;
        pinchStabilizeCount = 0;
        initialPinchDistance = null;
        pendingPinchUpdate = null;
        pinchHistory = [];
      } else {
        // Immediate start (simpler behavior)
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
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length === 1 && fingerCount === 1 && enablePan && isPanning) {
      // Single finger pan
      e.preventDefault();
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
      onUpdate();

    } else if (e.touches.length === 2 && enablePinch) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const cx = (t1.clientX + t2.clientX) / 2;
      const cy = (t1.clientY + t2.clientY) / 2;
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

      if (useStabilization) {
        // Stabilized pinch (GM-style)
        if (initialPinchDistance === null) {
          pinchStabilizeCount++;
          // Wait longer for larger gestures
          const framesToWait = dist > 200 ? stabilizeFrames + 2 : stabilizeFrames;
          if (pinchStabilizeCount < framesToWait) return;

          initialPinchDistance = dist;
          initialPinchZoom = viewport.scale;
          initialPinchCenter = { x: cx, y: cy };
          initialViewportX = viewport.x;
          initialViewportY = viewport.y;
          pinchHistory = Array(historySize).fill({ distance: dist, centerX: cx, centerY: cy });
          return;
        }

        // Add to history for smoothing
        pinchHistory.push({ distance: dist, centerX: cx, centerY: cy });
        if (pinchHistory.length > historySize) pinchHistory.shift();

        // Calculate smoothed values
        const avgDist = pinchHistory.reduce((s, i) => s + i.distance, 0) / pinchHistory.length;
        const zoomRatio = avgDist / initialPinchDistance;

        // Deadzone check
        if (!pinchStarted && Math.abs(zoomRatio - 1) < deadzone) return;
        if (!pinchStarted) {
          // Reset baseline after exiting deadzone
          initialPinchDistance = dist;
          initialPinchCenter = { x: cx, y: cy };
          initialViewportX = viewport.x;
          initialViewportY = viewport.y;
          initialPinchZoom = viewport.scale;
          pinchStarted = true;
          return;
        }

        // Calculate new viewport
        const newZoomRatio = avgDist / initialPinchDistance;
        const newScale = Math.max(minZoom, Math.min(maxZoom, initialPinchZoom * newZoomRatio));

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const initInternalX = (initialPinchCenter.x - rect.left) * scaleX;
        const initInternalY = (initialPinchCenter.y - rect.top) * scaleY;
        const worldX = (initInternalX - initialViewportX) / initialPinchZoom;
        const worldY = (initInternalY - initialViewportY) / initialPinchZoom;
        const newX = initInternalX - worldX * newScale;
        const newY = initInternalY - worldY * newScale;

        // Batch update with requestAnimationFrame
        pendingPinchUpdate = { newScale, newX, newY };
        if (!pinchAnimationFrame) {
          pinchAnimationFrame = requestAnimationFrame(processPinchUpdate);
        }

      } else {
        // Simple pinch (table-style)
        if (!initialPinchDistance) return;

        const currentDistance = dist;
        const zoomRatio = currentDistance / initialPinchDistance;
        const newScale = Math.max(minZoom, Math.min(maxZoom, initialPinchZoom * zoomRatio));

        const currentCenter = { x: cx, y: cy };
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const initialCanvasX = (initialPinchCenter.x - rect.left) * scaleX;
        const initialCanvasY = (initialPinchCenter.y - rect.top) * scaleY;
        const worldX = (initialCanvasX - initialViewportX) / initialPinchZoom;
        const worldY = (initialCanvasY - initialViewportY) / initialPinchZoom;
        const currentCanvasX = (currentCenter.x - rect.left) * scaleX;
        const currentCanvasY = (currentCenter.y - rect.top) * scaleY;

        viewport.x = currentCanvasX - worldX * newScale;
        viewport.y = currentCanvasY - worldY * newScale;
        viewport.scale = newScale;

        onUpdate();
      }
    }
  }

  function handleTouchEnd(e) {
    const prevFingerCount = fingerCount;
    fingerCount = e.touches.length;

    if (fingerCount < 2) {
      resetPinchState();
    }

    // Update last touch pos if we go from 2->1 fingers to avoid jump
    if (fingerCount === 1 && prevFingerCount === 2) {
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      isPanning = true;
    }

    if (fingerCount === 0) {
      if (isPanning && onPanEnd) onPanEnd();
      isPanning = false;
    }
  }

  // Attach listeners
  element.addEventListener('touchstart', handleTouchStart, { passive: false });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });
  element.addEventListener('touchend', handleTouchEnd);
  element.addEventListener('touchcancel', handleTouchEnd);

  // Return handler object with cleanup
  return {
    /**
     * Check if currently panning
     */
    get isPanning() {
      return isPanning;
    },

    /**
     * Check if currently pinching
     */
    get isPinching() {
      return initialPinchDistance !== null || pinchStarted;
    },

    /**
     * Reset all gesture state
     */
    reset() {
      resetPinchState();
      isPanning = false;
      fingerCount = 0;
    },

    /**
     * Remove all event listeners
     */
    destroy() {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
      resetPinchState();
    }
  };
}

/**
 * Create a mouse drag pan handler
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.element - The element to attach listeners to
 * @param {HTMLCanvasElement} options.canvas - The canvas for coordinate calculations
 * @param {Object} options.viewport - Viewport state object {x, y, scale}
 * @param {function} options.onUpdate - Callback when viewport changes
 * @param {function} [options.onDragStart] - Callback when drag starts
 * @param {function} [options.onDragEnd] - Callback when drag ends
 * @returns {Object} Handler object with cleanup method
 */
export function createMousePanHandler(options) {
  const {
    element,
    canvas,
    viewport,
    onUpdate,
    onDragStart,
    onDragEnd
  } = options;

  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  function handleMouseDown(e) {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    element.style.cursor = 'grabbing';
    if (onDragStart) onDragStart();
  }

  function handleMouseMove(e) {
    if (!isDragging) return;

    const deltaX = e.clientX - lastX;
    const deltaY = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    viewport.x += deltaX * scaleX;
    viewport.y += deltaY * scaleY;
    onUpdate();
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false;
      element.style.cursor = 'default';
      if (onDragEnd) onDragEnd();
    }
  }

  // Attach listeners
  element.addEventListener('mousedown', handleMouseDown);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);

  return {
    get isDragging() {
      return isDragging;
    },

    destroy() {
      element.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
  };
}

/**
 * Create a mouse wheel zoom handler
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.element - The element to attach listeners to
 * @param {function} options.onZoom - Callback with (clientX, clientY, scaleFactor)
 * @param {number} [options.zoomInFactor=1.1] - Scale factor for zoom in
 * @param {number} [options.zoomOutFactor=0.9] - Scale factor for zoom out
 * @returns {Object} Handler object with cleanup method
 */
export function createWheelZoomHandler(options) {
  const {
    element,
    onZoom,
    zoomInFactor = 1.1,
    zoomOutFactor = 0.9
  } = options;

  function handleWheel(e) {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? zoomOutFactor : zoomInFactor;
    onZoom(e.clientX, e.clientY, scaleFactor);
  }

  element.addEventListener('wheel', handleWheel, { passive: false });

  return {
    destroy() {
      element.removeEventListener('wheel', handleWheel);
    }
  };
}
