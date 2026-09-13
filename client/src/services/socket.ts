import { io, Socket } from 'socket.io-client';
import { getStoredToken } from './api';

const SOCKET_SERVER_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || undefined;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = getStoredToken();
    socket = io(SOCKET_SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      auth: token ? { token } : undefined,
    });
    
    setupHeartbeat(socket);
  }

  return socket;
}

export function reconnectSocketWithAuth(token?: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_SERVER_URL, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    randomizationFactor: 0.5,
    auth: token ? { token } : undefined,
  });

  setupHeartbeat(socket);

  return socket;
}

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let pingTimeout: ReturnType<typeof setTimeout> | null = null;

function setupHeartbeat(s: Socket) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (pingTimeout) clearTimeout(pingTimeout);

  heartbeatInterval = setInterval(() => {
    if (s.connected) {
      s.emit('APP_PING', { timestamp: Date.now() });
      
      // Expect a pong within 5 seconds, otherwise assume stale
      if (pingTimeout) clearTimeout(pingTimeout);
      pingTimeout = setTimeout(() => {
        console.warn('Socket heartbeat timeout. Forcing reconnect...');
        s.disconnect();
        s.connect();
      }, 5000);
    }
  }, 10000);

  s.on('APP_PONG', () => {
    if (pingTimeout) {
      clearTimeout(pingTimeout);
      pingTimeout = null;
    }
  });
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (pingTimeout) {
    clearTimeout(pingTimeout);
    pingTimeout = null;
  }
}
