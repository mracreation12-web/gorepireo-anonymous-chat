import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import apiService from '../services/api.js';

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
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting, connected, disconnected, error
  const [currentRoom, setCurrentRoom] = useState('general');
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineCounts, setOnlineCounts] = useState({ global: 0, room: 0 });
  const [sessionInfo, setSessionInfo] = useState({ sessionId: '', moniker: '' });
  
  // Hardened state: browser network presence and native notification toasts
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toasts, setToasts] = useState([]);

  const typingTimeouts = useRef(new Map());
  const isFirstConnectRef = useRef(true);

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

  // Track browser offline/online transitions
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast('Internet connection restored.', 'success');
      // If socket is disconnected, try to re-establish connection immediately
      if (socket) {
        socket.connect();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('disconnected');
      addToast('You are currently offline. Check your network settings.', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [socket, addToast]);

  // Initialize session ID and Moniker from localStorage or generate new ones
  useEffect(() => {
    let sessionId = localStorage.getItem('chat_session_id');
    let moniker = localStorage.getItem('chat_moniker');

    if (!sessionId) {
      sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
      localStorage.setItem('chat_session_id', sessionId);
    }
    if (!moniker) {
      moniker = generateMoniker();
      localStorage.setItem('chat_moniker', moniker);
    }

    setSessionInfo({ sessionId, moniker });
  }, []);

  // 1. WebSocket Connection Lifecycle Effect
  // Runs ONLY once when sessionInfo is initialized. Prevents connection tearing on room switches.
  useEffect(() => {
    if (!sessionInfo.sessionId) return;

    const socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      autoConnect: true,
      timeout: 10000,
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [sessionInfo.sessionId]);

  // 2. Connection Status & Auto-rejoin Event Bindings Effect
  // Listens to connect/disconnect states and ensures client automatically joins targetRoom on reconnect.
  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      setConnectionStatus('connected');
      if (!isFirstConnectRef.current) {
        addToast('Reconnected to chat server.', 'success');
      }
      isFirstConnectRef.current = false;
      // Automatically join the current room upon connection or reconnection
      socket.emit('join', {
        room: currentRoom,
        senderSessionId: sessionInfo.sessionId,
        moniker: sessionInfo.moniker,
      });
    };

    const onDisconnect = (reason) => {
      setConnectionStatus('disconnected');
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, need to reconnect manually
        socket.connect();
      }
      addToast('Connection lost. Attempting to reconnect...', 'warning');
    };

    const onConnectError = () => {
      setConnectionStatus('error');
      addToast('Server connection failed.', 'error');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    // If socket is already connected when this effect runs, invoke onConnect immediately
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [socket, currentRoom, sessionInfo, addToast]);

  // 3. Room-Specific Messaging & Typing Event Bindings Effect
  // Re-binds event listeners when active room switches, without disrupting connection.
  useEffect(() => {
    if (!socket || connectionStatus !== 'connected') return;

    // Join room immediately when currentRoom changes
    socket.emit('join', {
      room: currentRoom,
      senderSessionId: sessionInfo.sessionId,
      moniker: sessionInfo.moniker,
    });

    const onHistory = (data) => {
      if (data && data.room === currentRoom) {
        setMessages(data.messages || []);
      }
    };

    const onMessage = (message) => {
      if (message && message.room === currentRoom) {
        setMessages((prev) => {
          // De-duplicate incoming messages by checking database IDs
          const exists = prev.some((m) => m._id && m._id === message._id);
          if (exists) return prev;
          return [...prev, message];
        });
      }
    };

    const onRoomCount = (data) => {
      if (data && data.room === currentRoom) {
        setOnlineCounts((prev) => ({ ...prev, room: data.count }));
      }
    };

    const onGlobalCount = (data) => {
      if (data) {
        setOnlineCounts((prev) => ({ ...prev, global: data.count }));
      }
    };

    const onTypingStart = (data) => {
      if (data && data.room === currentRoom) {
        const { moniker } = data;
        setTypingUsers((prev) => {
          if (prev.includes(moniker)) return prev;
          return [...prev, moniker];
        });

        // Reset timer if user continues typing
        if (typingTimeouts.current.has(moniker)) {
          clearTimeout(typingTimeouts.current.get(moniker));
        }

        const timeout = setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== moniker));
          typingTimeouts.current.delete(moniker);
        }, 4000);

        typingTimeouts.current.set(moniker, timeout);
      }
    };

    const onTypingStop = (data) => {
      if (data && data.room === currentRoom) {
        setTypingUsers([]);
        // Clear all active typing timers
        typingTimeouts.current.forEach((t) => clearTimeout(t));
        typingTimeouts.current.clear();
      }
    };

    socket.on('history', onHistory);
    socket.on('message', onMessage);
    socket.on('room_count_update', onRoomCount);
    socket.on('global_count_update', onGlobalCount);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);

    return () => {
      // Notify the server immediately that typing has stopped for this room
      socket.emit('typing:stop');

      socket.off('history', onHistory);
      socket.off('message', onMessage);
      socket.off('room_count_update', onRoomCount);
      socket.off('global_count_update', onGlobalCount);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);

      // Clean up typing indicators on room change
      setTypingUsers([]);
      typingTimeouts.current.forEach((t) => clearTimeout(t));
      typingTimeouts.current.clear();
    };
  }, [socket, connectionStatus, currentRoom, sessionInfo]);

  // 4. REST API Fallback History Query Effect
  // If socket connection is offline/disconnected or errors out, fetch history via REST API
  useEffect(() => {
    if (connectionStatus === 'connected') return;

    let isActive = true;
    const fetchHistoryFallback = async () => {
      try {
        const res = await apiService.getMessages(currentRoom, 100);
        if (isActive && res && res.success) {
          setMessages(res.data || []);
        }
      } catch (err) {
        console.error('[SocketContext] REST fallback history query failed:', err);
        addToast('Failed to load history from REST API.', 'error');
      }
    };

    fetchHistoryFallback();

    return () => {
      isActive = false;
    };
  }, [currentRoom, connectionStatus, addToast]);

  // Method to manual retry reconnection
  const retryConnection = useCallback(() => {
    if (!navigator.onLine) {
      addToast('Cannot connect: Internet is offline.', 'error');
      return;
    }
    addToast('Retrying server connection...', 'info');
    if (socket) {
      socket.connect();
    }
  }, [socket, addToast]);

  // Method to join/switch rooms
  const joinRoom = useCallback((roomName) => {
    if (!roomName || roomName.trim() === '') return;
    const sanitized = roomName.trim();
    setCurrentRoom(sanitized);
    setMessages([]);
    setTypingUsers([]);
  }, []);

  // Method to emit typing status
  const sendTypingStart = useCallback(() => {
    if (socket && connectionStatus === 'connected' && navigator.onLine) {
      socket.emit('typing:start', { moniker: sessionInfo.moniker });
    }
  }, [socket, connectionStatus, sessionInfo.moniker]);

  const sendTypingStop = useCallback(() => {
    if (socket && connectionStatus === 'connected') {
      socket.emit('typing:stop');
    }
  }, [socket, connectionStatus]);

  // Method to emit new message
  const sendMessage = useCallback((content) => {
    if (!content || content.trim() === '') return;
    
    // Offline protection
    if (!navigator.onLine) {
      addToast('Cannot send message: Internet is offline.', 'error');
      return;
    }

    if (connectionStatus !== 'connected') {
      addToast('Cannot send message: Disconnected from server.', 'error');
      return;
    }

    if (socket && connectionStatus === 'connected') {
      socket.emit('message', {
        content: content.trim(),
        senderSessionId: sessionInfo.sessionId,
        moniker: sessionInfo.moniker,
        room: currentRoom,
      });
    }
  }, [socket, connectionStatus, sessionInfo, currentRoom, addToast]);

  return (
    <SocketContext.Provider
      value={{
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
      }}
    >
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


