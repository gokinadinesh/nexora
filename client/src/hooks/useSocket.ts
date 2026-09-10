import { useEffect, useState } from 'react';
import { getSocket } from '../services/socket';

export interface SocketState {
  isConnected: boolean;
  socketId: string | null;
}

export function useSocket(): SocketState {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [socketId, setSocketId] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id || null);
    }

    function onDisconnect() {
      setIsConnected(false);
      setSocketId(null);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return { isConnected, socketId };
}
