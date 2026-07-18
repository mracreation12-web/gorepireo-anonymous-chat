import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const ANIMALS = ['Fox', 'Panda', 'Koala', 'Tiger', 'Lion', 'Bear', 'Otter', 'Rabbit', 'Owl', 'Wolf', 'Deer', 'Falcon', 'Cheetah', 'Sloth', 'Penguin'];
const ADJECTIVES = ['Silent', 'Swift', 'Clever', 'Warm', 'Quiet', 'Active', 'Gentle', 'Proud', 'Bright', 'Wise', 'Bold', 'Quick', 'Kind', 'Calm', 'Vast'];

const generateMoniker = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
};

export const SocketProvider = ({ children }) => {
  // State definitions
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting, connected, reconnecting, disconnected
  const [currentRoom, setCurrentRoom] = useState('general');
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineCounts, setOnlineCounts] = useState({ global: 0, room: 0 });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toasts, setToasts] = useState([]);

  // Session ID & Moniker initialized synchronously from localStorage or generated
  const [sessionInfo] = useState(() => {
    let sessionId = localStorage.getItem('chat_session_id');
    let moniker = localStorage.getItem('chat_moniker');

    if (!sessionId) {
      sessionId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15);
      localStorage.setItem('chat_session_id', sessionId);
    }
    if (!moniker) {
      moniker = generateMoniker();
      localStorage.setItem('chat_moniker', moniker);
    }

    return { sessionId, moniker };
  });

  // Mutable References to avoid stale closures in Socket event listeners
  const socketRef = useRef(null);
  const currentRoomRef = useRef(currentRoom);
  const sessionInfoRef = useRef(sessionInfo);
  const typingTimeoutsRef = useRef(new Map());
  const isFirstConnectRef = useRef(true);

  // Sync refs with state
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  useEffect(() => {
    sessionInfoRef.current = sessionInfo;
  }, [sessionInfo]);

  // Toast dispatch action
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  // Clear typing timeouts helper
  const clearAllTypingTimeouts = useCallback(() => {
    typingTimeoutsRef.current.forEach((t) => clearTimeout(t));
    typingTimeoutsRef.current.clear();
    setTypingUsers([]);
  }, []);

  // Singleton Socket Initialization & Lifecycle Management
  useEffect(() => {
    let isSubscribed = true;

    if (socketRef.current) return;

    setConnectionStatus('connecting');

    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
      autoConnect: true,
      timeout: 20000,
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // Register ALL socket listeners EXACTLY ONCE
    socketInstance.on('connect', () => {
      if (!isSubscribed) return;
      setConnectionStatus('connected');
      if (!isFirstConnectRef.current) {
        addToast('Reconnected to chat server.', 'success');
      }
      isFirstConnectRef.current = false;

      // Auto-join current room using ref
      socketInstance.emit('join', {
        room: currentRoomRef.current,
        senderSessionId: sessionInfoRef.current.sessionId,
        moniker: sessionInfoRef.current.moniker,
      });
    });

    socketInstance.on('disconnect', (reason) => {
      if (!isSubscribed) return;
      setConnectionStatus('disconnected');
      if (reason === 'io server disconnect') {
        socketInstance.connect();
      }
      addToast('Connection lost. Reconnecting...', 'warning');
    });

    socketInstance.on('connect_error', () => {
      if (!isSubscribed) return;
      setConnectionStatus('reconnecting');
    });

    socketInstance.on('reconnect_attempt', () => {
      if (!isSubscribed) return;
      setConnectionStatus('reconnecting');
    });

    socketInstance.on('reconnect', () => {
      if (!isSubscribed) return;
      setConnectionStatus('connected');
      socketInstance.emit('join', {
        room: currentRoomRef.current,
        senderSessionId: sessionInfoRef.current.sessionId,
        moniker: sessionInfoRef.current.moniker,
      });
    });

    socketInstance.on('history', (data) => {
      if (!isSubscribed) return;
      if (data && data.room === currentRoomRef.current) {
        setMessages(data.messages || []);
      }
    });

    socketInstance.on('message', (incomingMsg) => {
      if (!isSubscribed) return;
      if (incomingMsg && incomingMsg.room === currentRoomRef.current) {
        setMessages((prev) => {
          const msgId = incomingMsg._id || incomingMsg.id;
          if (msgId && prev.some((m) => (m._id || m.id) === msgId)) {
            return prev;
          }
          return [...prev, incomingMsg];
        });
      }
    });

    socketInstance.on('room_count_update', (data) => {
      if (!isSubscribed) return;
      if (data && data.room === currentRoomRef.current) {
        setOnlineCounts((prev) => ({ ...prev, room: data.count }));
      }
    });

    socketInstance.on('global_count_update', (data) => {
      if (!isSubscribed) return;
      if (data) {
        setOnlineCounts((prev) => ({ ...prev, global: data.count }));
      }
    });

    socketInstance.on('typing:start', (data) => {
      if (!isSubscribed) return;
      if (data && data.room === currentRoomRef.current) {
        const { moniker } = data;
        setTypingUsers((prev) => {
          if (prev.includes(moniker)) return prev;
          return [...prev, moniker];
        });

        if (typingTimeoutsRef.current.has(moniker)) {
          clearTimeout(typingTimeoutsRef.current.get(moniker));
        }

        const timeout = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== moniker));
          typingTimeoutsRef.current.delete(moniker);
        }, 4000);

        typingTimeoutsRef.current.set(moniker, timeout);
      }
    });

    socketInstance.on('typing:stop', (data) => {
      if (!isSubscribed) return;
      if (!data || data.room === currentRoomRef.current) {
        clearAllTypingTimeouts();
      }
    });

    return () => {
      isSubscribed = false;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      clearAllTypingTimeouts();
    };
  }, [addToast, clearAllTypingTimeouts]);

  // Network Presence & Mobile Background Recovery Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast('Internet connection restored.', 'success');

      if (socketRef.current && !socketRef.current.connected) {
        setConnectionStatus('reconnecting');
        socketRef.current.connect();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('disconnected');
      addToast('You are currently offline. Check your network settings.', 'error');
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        if (socketRef.current) {
          if (!socketRef.current.connected && navigator.onLine) {
            setConnectionStatus('reconnecting');
            socketRef.current.connect();
          } else if (socketRef.current.connected) {
            socketRef.current.emit('join', {
              room: currentRoomRef.current,
              senderSessionId: sessionInfoRef.current.sessionId,
              moniker: sessionInfoRef.current.moniker,
            });
          }
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [addToast]);

  // Manual retry connection handler
  const retryConnection = useCallback(() => {
    if (!navigator.onLine) {
      addToast('Cannot connect: Internet is offline.', 'error');
      return;
    }
    addToast('Retrying server connection...', 'info');
    setConnectionStatus('connecting');

    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
  }, [addToast]);

  // Join/switch rooms handler
  const joinRoom = useCallback((roomName) => {
    if (!roomName || roomName.trim() === '') return;
    const sanitized = roomName.trim();
    if (sanitized === currentRoomRef.current) return;

    setCurrentRoom(sanitized);
    currentRoomRef.current = sanitized;
    setMessages([]);
    clearAllTypingTimeouts();

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('typing:stop');
      socketRef.current.emit('join', {
        room: sanitized,
        senderSessionId: sessionInfoRef.current.sessionId,
        moniker: sessionInfoRef.current.moniker,
      });
    }
  }, [clearAllTypingTimeouts]);

  // Typing status handlers
  const sendTypingStart = useCallback(() => {
    if (socketRef.current && socketRef.current.connected && navigator.onLine) {
      socketRef.current.emit('typing:start', { moniker: sessionInfoRef.current.moniker });
    }
  }, []);

  const sendTypingStop = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('typing:stop');
    }
  }, []);

  // Send message handler
  const sendMessage = useCallback((content) => {
    if (!content || content.trim() === '') return;

    if (!navigator.onLine) {
      addToast('Cannot send message: Internet is offline.', 'error');
      return;
    }

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('message', {
        content: content.trim(),
        senderSessionId: sessionInfoRef.current.sessionId,
        moniker: sessionInfoRef.current.moniker,
        room: currentRoomRef.current,
      });
    } else {
      addToast('Cannot send message: Reconnecting to server...', 'warning');
    }
  }, [addToast]);

  // Memoize context value to optimize child re-renders
  const contextValue = useMemo(() => ({
    socket,
    connectionStatus,
    currentRoom,
    messages,
    typingUsers,
    onlineCounts,
    sessionInfo,
    joinRoom,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    toasts,
    removeToast,
    addToast,
    isOnline,
    retryConnection,
  }), [
    socket,
    connectionStatus,
    currentRoom,
    messages,
    typingUsers,
    onlineCounts,
    sessionInfo,
    joinRoom,
    sendMessage,
    sendTypingStart,
    sendTypingStop,
    toasts,
    removeToast,
    addToast,
    isOnline,
    retryConnection,
  ]);

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
