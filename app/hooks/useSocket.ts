"use client";

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export function useSocket(serverUrl: string) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io(serverUrl);

    socketRef.current.on("connect", () => {
      console.log("Connected to server:", socketRef.current?.id);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [serverUrl]);

  return socketRef.current;
}
