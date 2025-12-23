import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";

// Singleton socket instance
let socket = null;

function getSocket() {
    if (!socket) {
        // Connect to the same origin in production, localhost in dev
        const url = import.meta.env.DEV ? "http://localhost:3000" : undefined;
        socket = io(url, {
            transports: ["websocket", "polling"],
            autoConnect: true,
        });

        socket.on("connect", () => {
            console.log("WebSocket connected");
        });

        socket.on("disconnect", () => {
            console.log("WebSocket disconnected");
        });
    }
    return socket;
}

// Hook to listen for new events
export function useNewEvents(onNewEvents) {
    useEffect(() => {
        const s = getSocket();

        const handler = (events) => {
            if (onNewEvents) {
                onNewEvents(events);
            }
        };

        s.on("newEvents", handler);

        return () => {
            s.off("newEvents", handler);
        };
    }, [onNewEvents]);
}

// Hook to subscribe to a specific token's events
export function useTokenEvents(tokenId, onNewEvents) {
    useEffect(() => {
        if (!tokenId) return;

        const s = getSocket();
        s.emit("subscribe", tokenId);

        const handler = (events) => {
            // Filter events for this token
            const relevantEvents = events.filter((e) => e.tokenId === tokenId);
            if (relevantEvents.length > 0 && onNewEvents) {
                onNewEvents(relevantEvents);
            }
        };

        s.on("newEvents", handler);

        return () => {
            s.emit("unsubscribe", tokenId);
            s.off("newEvents", handler);
        };
    }, [tokenId, onNewEvents]);
}

// Hook to get connection status
export function useSocketStatus() {
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        const s = getSocket();

        setIsConnected(s.connected);

        const onConnect = () => setIsConnected(true);
        const onDisconnect = () => setIsConnected(false);

        s.on("connect", onConnect);
        s.on("disconnect", onDisconnect);

        return () => {
            s.off("connect", onConnect);
            s.off("disconnect", onDisconnect);
        };
    }, []);

    return isConnected;
}

export { getSocket };
