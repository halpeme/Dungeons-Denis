/**
 * WebSocket client wrapper with reconnection logic
 */
class WSClient {
  constructor(options = {}) {
    this.url = options.url || `ws://${window.location.host}/ws`;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.baseDelay = options.baseDelay || 1000;
    this.socket = null;
    this.listeners = new Map();
    this.connected = false;
    this.sessionId = null;
    this.gmToken = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.url);

        this.socket.onopen = () => {
          console.log('WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        };

        this.socket.onclose = (event) => {
          console.log('WebSocket closed', event.code, event.reason);
          this.connected = false;
          this.emit('disconnected');

          // Attempt reconnection
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        this.socket.onmessage = (event) => {
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

  scheduleReconnect() {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Error handled in connect
      });
    }, delay);
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
      this.socket.close();
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
}

// Export for use in other scripts
window.WSClient = WSClient;
