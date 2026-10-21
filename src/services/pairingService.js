const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';

class PairingService {
  constructor() {
    this.ws = null;
    this.code = null;
    this.isPaired = false;
    this.onPaired = null;
    this.onSyncUpdate = null;
    this.onDisconnected = null;
    this.onCodeGenerated = null;
  }

  // Desktop: create session and get QR code
  createSession(token) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          type: 'create_session',
          token,
        }));
      };

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'session_created':
            this.code = msg.code;
            if (this.onCodeGenerated) this.onCodeGenerated(msg.code);
            resolve(msg.code);
            break;

          case 'paired':
            this.isPaired = true;
            if (this.onPaired) this.onPaired();
            break;

          case 'sync_update':
            if (this.onSyncUpdate) this.onSyncUpdate(msg.payload);
            break;

          case 'peer_disconnected':
          case 'session_ended':
            this.isPaired = false;
            if (this.onDisconnected) this.onDisconnected();
            break;
        }
      };

      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));
      this.ws.onclose = () => {
        this.isPaired = false;
        this.code = null;
      };
    });
  }

  // Mobile: join session with code
  joinSession(code) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          type: 'join_session',
          code,
        }));
      };

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'paired':
            this.isPaired = true;
            if (this.onPaired) this.onPaired();
            resolve(msg.token); // Receive auth token from desktop
            break;

          case 'sync_update':
            if (this.onSyncUpdate) this.onSyncUpdate(msg.payload);
            break;

          case 'error':
            reject(new Error(msg.message));
            break;

          case 'peer_disconnected':
          case 'session_ended':
            this.isPaired = false;
            if (this.onDisconnected) this.onDisconnected();
            break;
        }
      };

      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));
    });
  }

  // Send real-time update to paired device
  sendUpdate(payload) {
    if (this.ws?.readyState === 1 && this.isPaired) {
      this.ws.send(JSON.stringify({
        type: 'sync_update',
        payload,
      }));
    }
  }

  disconnect() {
    if (this.ws?.readyState === 1) {
      this.ws.send(JSON.stringify({ type: 'disconnect_session' }));
      this.ws.close();
    }
    this.ws = null;
    this.code = null;
    this.isPaired = false;
  }

  getQRData() {
    // Returns data to encode in QR code
    return JSON.stringify({
      type: 'bupocompass_pair',
      code: this.code,
      ws: WS_URL,
    });
  }
}

export const pairingService = new PairingService();
export default pairingService;
