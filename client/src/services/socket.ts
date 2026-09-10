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
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      auth: token ? { token } : undefined,
    });
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
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    auth: token ? { token } : undefined,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
