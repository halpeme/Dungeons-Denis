/**
 * Shared Connection Status UI
 * Common connection status display for both GM and Table clients
 */

/** Status dot CSS classes */
const STATUS_CLASSES = {
  connected: 'w-2 h-2 rounded-full bg-green-500',
  connecting: 'w-2 h-2 rounded-full bg-yellow-500 animate-pulse',
  reconnecting: 'w-2 h-2 rounded-full bg-yellow-500 animate-pulse',
  disconnected: 'w-2 h-2 rounded-full bg-red-500'
};

/** Status text labels */
const STATUS_TEXT = {
  connected: 'Connected',
  connecting: 'Connecting...',
  disconnected: 'Disconnected'
};

/**
 * Update connection status indicator
 * @param {{statusDot?: HTMLElement, statusText?: HTMLElement}} elements - DOM elements
 * @param {string|boolean} status - Connection status ('connected'|'connecting'|'reconnecting'|'disconnected' or boolean)
 * @param {Object} [data] - Additional status data
 * @param {number} [data.remainingMs] - Remaining time until retry (for reconnecting)
 * @param {number} [data.code] - Disconnect code
 * @param {Object} [options] - Display options
 * @param {HTMLElement} [options.retryBtn] - Optional retry button to show/hide
 */
export function updateConnectionStatus(elements, status, data = {}, options = {}) {
  const { statusDot, statusText } = elements;
  const { retryBtn } = options;

  // Legacy boolean support
  if (typeof status === 'boolean') {
    const state = status ? 'connected' : 'disconnected';
    if (statusDot) {
      statusDot.className = STATUS_CLASSES[state];
    }
    if (statusText) {
      statusText.textContent = STATUS_TEXT[state];
    }
    if (retryBtn) {
      retryBtn.classList.toggle('hidden', status);
    }
    return;
  }

  // Apply status dot styling
  if (statusDot) {
    statusDot.className = STATUS_CLASSES[status] || STATUS_CLASSES.disconnected;
  }

  // Apply status text
  if (statusText) {
    switch (status) {
      case 'connected':
        statusText.textContent = STATUS_TEXT.connected;
        break;
      case 'connecting':
        statusText.textContent = STATUS_TEXT.connecting;
        break;
      case 'reconnecting':
        const seconds = Math.ceil((data.remainingMs || 0) / 1000);
        statusText.textContent = `Retry in ${seconds}s`;
        break;
      case 'disconnected':
      default:
        const reason = data && data.code ? ` (${data.code})` : '';
        statusText.textContent = `${STATUS_TEXT.disconnected}${reason}`;
        break;
    }
  }

  // Handle retry button visibility
  if (retryBtn) {
    const showRetry = status === 'reconnecting' || status === 'disconnected';
    retryBtn.classList.toggle('hidden', !showRetry);
  }
}

/**
 * Create a simple status update function bound to specific elements
 * @param {{statusDot?: HTMLElement, statusText?: HTMLElement}} elements - DOM elements
 * @param {Object} [options] - Options including retryBtn
 * @returns {function(status: string|boolean, data?: Object): void} Bound update function
 */
export function createStatusUpdater(elements, options = {}) {
  return (status, data = {}) => updateConnectionStatus(elements, status, data, options);
}
