/**
 * WebSocket client wrapper with reconnection logic
 */
class WSClient {
  constructor(options = {}) {
    this.baseUrl = options.url || `ws://${window.location.host}/ws`;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 15;
    this.baseDelay = options.baseDelay || 500;
    this.socket = null;
    this.pendingSocket = null;  // Track socket that hasn't opened yet (Safari fix)
    this.heartbeatInterval = null;  // Keep Safari connection alive
    this.listeners = new Map();
    this.connected = false;
    this.sessionId = null;
    this.gmToken = null;
    this.reconnectTimer = null;
    this.countdownInterval = null;
    this.stuckCheckInterval = null;  // Safari "stuck connecting" fix
  }

  connect() {
    // Clear any pending reconnect
    this.clearReconnectTimers();

    // Close any pending socket that hasn't opened yet (Safari fix)
    if (this.pendingSocket) {
      this.pendingSocket.onopen = null;
      this.pendingSocket.onclose = null;
      this.pendingSocket.onerror = null;
      this.pendingSocket.onmessage = null;
      this.pendingSocket.close();
      this.pendingSocket = null;
    }

    // Close existing connection if any
    if (this.socket) {
      console.log('Closing existing socket before reconnecting');
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      this.socket.onopen = null;
      this.socket.close();
      this.socket = null;
    }

    // Clear heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // NO cache-busting timestamp - Safari has issues with it (learned from Remote Mouse)
    const url = this.baseUrl;

    return new Promise((resolve, reject) => {
      try {
        this.emit('connecting');
        const socket = new WebSocket(url);
        this.pendingSocket = socket;

        // Start Safari stuck connection check
        this.startStuckConnectionCheck();

        // Timeout for connection (10 seconds for slower networks)
        const timeout = setTimeout(() => {
          if (socket.readyState !== WebSocket.OPEN) {
            console.log('Connection timeout, closing pending socket');
            socket.onopen = null;
            socket.onclose = null;
            socket.onerror = null;
            socket.onmessage = null;
            socket.close();
            if (this.pendingSocket === socket) this.pendingSocket = null;
            this.scheduleReconnect();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

        socket.onopen = () => {
          console.log('WebSocket connected');
          clearTimeout(timeout);
          this.stopStuckConnectionCheck();  // No longer need stuck check
          this.pendingSocket = null;
          this.socket = socket;
          this.connected = true;
          this.reconnectAttempts = 0;

          // Start client-side heartbeat to keep Safari connection alive
          this.heartbeatInterval = setInterval(() => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
              console.log('Sending heartbeat ping');
              this.socket.send(JSON.stringify({ type: 'ping' }));
            }
          }, 20000);

          this.emit('connected');
          resolve();
        };

        socket.onclose = (event) => {
          console.log('WebSocket closed', event.code, event.reason);
          clearTimeout(timeout);
          if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
          }
          if (this.socket === socket) this.socket = null;
          if (this.pendingSocket === socket) this.pendingSocket = null;
          this.connected = false;
          this.emit('disconnected', { code: event.code, reason: event.reason });

          // Attempt reconnection
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          clearTimeout(timeout);
          this.emit('error', error);
          reject(error);
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (err) {
            console.error('Failed to parse message:', err);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  clearReconnectTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.stuckCheckInterval) {
      clearInterval(this.stuckCheckInterval);
      this.stuckCheckInterval = null;
    }
  }

  // Safari fix: Start checking for stuck "connecting" state
  startStuckConnectionCheck() {
    // Clear any existing interval
    if (this.stuckCheckInterval) {
      clearInterval(this.stuckCheckInterval);
    }

    // Check every 3 seconds if we're stuck on connecting
    this.stuckCheckInterval = setInterval(() => {
      if (!this.connected && this.pendingSocket && this.pendingSocket.readyState === WebSocket.CONNECTING) {
        console.log('[SAFARI FIX] Stuck on connecting for 3s, forcing reconnect');
        // Close the stuck socket
        this.pendingSocket.onopen = null;
        this.pendingSocket.onclose = null;
        this.pendingSocket.onerror = null;
        this.pendingSocket.onmessage = null;
        this.pendingSocket.close();
        this.pendingSocket = null;
        // Reconnect
        this.connect().catch(() => {});
      }
    }, 3000);
  }

  // Stop the stuck connection check
  stopStuckConnectionCheck() {
    if (this.stuckCheckInterval) {
      clearInterval(this.stuckCheckInterval);
      this.stuckCheckInterval = null;
    }
  }

  scheduleReconnect() {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      15000 // Reduced max from 30s to 15s
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    // Emit countdown updates every second
    let remainingMs = delay;
    this.emit('reconnecting', {
      attempt: this.reconnectAttempts + 1,
      maxAttempts: this.maxReconnectAttempts,
      delayMs: delay,
      remainingMs
    });

    this.countdownInterval = setInterval(() => {
      remainingMs -= 1000;
      if (remainingMs > 0) {
        this.emit('reconnecting', {
          attempt: this.reconnectAttempts + 1,
          maxAttempts: this.maxReconnectAttempts,
          delayMs: delay,
          remainingMs
        });
      }
    }, 1000);

    this.reconnectTimer = setTimeout(() => {
      this.clearReconnectTimers();
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Error handled in connect
      });
    }, delay);
  }

  // Force immediate retry
  retryNow() {
    console.log('Manual retry requested');
    this.clearReconnectTimers();
    this.connect().catch(() => {
      // Error handled in connect
    });
  }

  handleMessage(message) {
    const { type, payload } = message;

    // Emit specific event
    this.emit(type, payload);

    // Emit generic message event
    this.emit('message', message);
  }

  send(type, payload = {}) {
    if (!this.connected || !this.socket) {
      console.warn('Cannot send, not connected');
      return false;
    }

    const message = { type, payload };
    this.socket.send(JSON.stringify(message));
    return true;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;
    for (const callback of this.listeners.get(event)) {
      try {
        callback(data);
      } catch (err) {
        console.error('Event handler error:', err);
      }
    }
  }

  close() {
    if (this.socket) {
      this.maxReconnectAttempts = 0; // Prevent reconnection
      this.socket.close(1000, 'Client closing');
    }
  }

  // Session helpers
  createSession() {
    return this.send('session:create');
  }

  joinSession(code) {
    return this.send('session:join', { code: code.toUpperCase() });
  }

  reconnectSession(sessionId, gmToken) {
    this.sessionId = sessionId;
    this.gmToken = gmToken;
    return this.send('session:reconnect', { sessionId, gmToken });
  }

  autoJoinSession() {
    return this.send('session:auto-join');
  }
}

// Export for use in other scripts
window.WSClient = WSClient;

// Track when the page fully loaded to prevent premature cleanup
let pageFullyLoaded = false;
let pageLoadTime = Date.now();

window.addEventListener('load', () => {
  pageFullyLoaded = true;
  pageLoadTime = Date.now();
});

// Clean up WebSocket on page unload to prevent stale connections
// This helps with the alternating connection issue on mobile browsers
const cleanup = () => {
  // Don't cleanup if page just loaded (Safari fires events during load)
  if (!pageFullyLoaded || (Date.now() - pageLoadTime) < 1000) {
    console.log('Skipping cleanup - page not fully loaded yet');
    return;
  }
  if (window.wsClient) {
    console.log('Page unloading, closing WebSocket');
    window.wsClient.close();
  }
};

window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);

// Handle interaction/visibility to restore connection if needed
// Safari suspends WebSocket connections aggressively, so we need special handling
document.addEventListener('visibilitychange', () => {
  // Don't do anything during initial page load
  if (!pageFullyLoaded || (Date.now() - pageLoadTime) < 2000) {
    console.log('Skipping visibility handler - page not fully loaded yet');
    return;
  }

  if (document.visibilityState === 'visible' && window.wsClient) {
    console.log('Page became visible, checking connection...');

    // Safari-specific: Force reconnect if we suspect the connection is stale
    // Safari often leaves the socket in a broken state after page suspension
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isSafari || !window.wsClient.connected) {
      console.log('Forcing fresh connection (Safari detected or disconnected)');

      // Force close any existing connection
      if (window.wsClient.socket) {
        try {
          window.wsClient.socket.onclose = null;
          window.wsClient.socket.onerror = null;
          window.wsClient.socket.close();
        } catch (e) {
          console.log('Error closing stale socket:', e);
        }
        window.wsClient.socket = null;
      }

      // Reset state
      window.wsClient.connected = false;
      window.wsClient.reconnectAttempts = 0;
      window.wsClient.clearReconnectTimers();

      // Immediately reconnect
      setTimeout(() => {
        window.wsClient.connect().catch((err) => {
          console.log('Reconnection failed:', err);
        });
      }, 100);
    }
  }
});

// Safari pageshow event - fires when page is restored from bfcache
window.addEventListener('pageshow', (event) => {
  // Only handle bfcache restoration (event.persisted = true)
  // Don't run on initial page load
  if (event.persisted && window.wsClient) {
    console.log('Page restored from bfcache, forcing reconnect...');

    // Force close stale connection
    if (window.wsClient.socket) {
      try {
        window.wsClient.socket.onclose = null;
        window.wsClient.socket.onerror = null;
        window.wsClient.socket.close();
      } catch (e) {
        console.log('Error closing stale socket:', e);
      }
      window.wsClient.socket = null;
    }

    // Reset and reconnect
    window.wsClient.connected = false;
    window.wsClient.reconnectAttempts = 0;
    window.wsClient.clearReconnectTimers();

    setTimeout(() => {
      window.wsClient.connect().catch((err) => {
        console.log('Reconnection after bfcache failed:', err);
      });
    }, 100);
  }
});


