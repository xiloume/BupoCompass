import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const PORT = process.env.WS_PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Active pairing sessions: code -> { desktopWs, mobileWs, token, createdAt }
const sessions = new Map();

// Cleanup expired sessions every 60s (sessions expire after 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of sessions) {
    if (now - session.createdAt > 5 * 60 * 1000) {
      sessions.delete(code);
    }
  }
}, 60000);

function generateCode() {
  // 6-digit numeric code for easy manual entry
  return String(Math.floor(100000 + Math.random() * 900000));
}

wss.on('connection', (ws) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    switch (msg.type) {
      case 'create_session': {
        // Desktop creates a pairing session
        const code = generateCode();
        sessions.set(code, {
          desktopWs: ws,
          mobileWs: null,
          token: msg.token || null, // JWT access token to share
          createdAt: Date.now(),
        });
        ws._pairCode = code;
        ws.send(JSON.stringify({ type: 'session_created', code }));
        break;
      }

      case 'join_session': {
        // Mobile joins with the code
        const code = msg.code;
        const session = sessions.get(code);

        if (!session) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid or expired code' }));
          return;
        }

        session.mobileWs = ws;
        ws._pairCode = code;

        // Notify desktop that mobile connected
        if (session.desktopWs?.readyState === 1) {
          session.desktopWs.send(JSON.stringify({ type: 'paired', device: 'mobile' }));
        }

        // Send token to mobile for auth
        ws.send(JSON.stringify({
          type: 'paired',
          token: session.token,
          device: 'desktop',
        }));

        break;
      }

      case 'sync_update': {
        // Forward real-time updates between paired devices
        const code = ws._pairCode;
        const session = sessions.get(code);
        if (!session) return;

        const target = ws === session.desktopWs ? session.mobileWs : session.desktopWs;
        if (target?.readyState === 1) {
          target.send(JSON.stringify({
            type: 'sync_update',
            payload: msg.payload,
          }));
        }
        break;
      }

      case 'disconnect_session': {
        const code = ws._pairCode;
        if (code) {
          const session = sessions.get(code);
          if (session) {
            const other = ws === session.desktopWs ? session.mobileWs : session.desktopWs;
            if (other?.readyState === 1) {
              other.send(JSON.stringify({ type: 'session_ended' }));
            }
            sessions.delete(code);
          }
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    const code = ws._pairCode;
    if (code) {
      const session = sessions.get(code);
      if (session) {
        const other = ws === session.desktopWs ? session.mobileWs : session.desktopWs;
        if (other?.readyState === 1) {
          other.send(JSON.stringify({ type: 'peer_disconnected' }));
        }
        sessions.delete(code);
      }
    }
  });
});

// Heartbeat to detect dead connections
const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(interval));

console.log(`[WS] BupoCompass pairing server running on port ${PORT}`);
