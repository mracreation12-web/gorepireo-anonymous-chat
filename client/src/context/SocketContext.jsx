import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
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
  // State definitions
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('waking'); // waking, connecting, connected, reconnecting, disconnected, error
  const [currentRoom, setCurrentRoom] = useState('general');
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineCounts, setOnlineCounts] = useState({ global: 0, room: 0 });
  const [sessionInfo, setSessionInfo] = useState({ sessionId: '', moniker: '' });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toasts, setToasts] = useState([]);

  // Mutable References to avoid stale closures in Socket event listeners
  const socketRef = useRef(null);
  const currentRoomRef = useRef(currentRoom);
  const sessionInfoRef = useRef(sessionInfo);
  const isOnlineRef = useRef(isOnline);
  const typingTimeoutsRef = useRef(new Map());
  const healthCheckTimerRef = useRef(null);
  const isHealthCheckedRef = useRef(false);
  const isFirstConnectRef = useRef(true);

  // Sync refs with state
  useEffect(() => {
    currentRoomRef.current = currentRoom;
  }, [currentRoom]);

  useEffect(() => {
    sessionInfoRef.current = sessionInfo;
  }, [sessionInfo]);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

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

  // 1. Initialize session ID and Moniker from localStorage or generate new ones
  useEffect(() => {
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

    setSessionInfo({ sessionId, moniker });
  }, []);

  // Clear typing timeouts helper
  const clearAllTypingTimeouts = useCallback(() => {
    typingTimeoutsRef.current.forEach((t) => clearTimeout(t));
    typingTimeoutsRef.current.clear();
    setTypingUsers([]);
  }, []);

  // 2. Pre-flight REST Health Polling & Socket Initialization Lifecycle
  useEffect(() => {
    if (!sessionInfo.sessionId) return;

    let isSubscribed = true;

    // Helper: Initialize Socket.IO connection ONCE backend health is confirmed
    const initSocketConnection = () => {
      if (socketRef.current) return; // Prevent duplicate socket creation

      setConnectionStatus('connecting');

      const socketInstance = io(SOCKET_URL, {
        transports: ['websocket', 'polling'], // WebSocket primary, polling fallback
        reconnection: true,
        reconnectionAttempts: Infinity,      // Unlimited retries
        reconnectionDelay: 1000,              // Initial backoff 1s
        reconnectionDelayMax: 10000,          // Max backoff 10s
        randomizationFactor: 0.5,             // Jitter to prevent reconnect storms
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
          // Reconnect manually if server initiated disconnect
          socketInstance.connect();
        }
        addToast('Connection lost. Reconnecting...', 'warning');
      });

      socketInstance.on('connect_error', () => {
        if (!isSubscribed) return;
        setConnectionStatus((prev) => (prev === 'waking' ? 'waking' : 'reconnecting'));
      });

      socketInstance.on('reconnect_attempt', () => {
        if (!isSubscribed) return;
        setConnectionStatus('reconnecting');
      });

      socketInstance.on('reconnect', () => {
        if (!isSubscribed) return;
        setConnectionStatus('connected');
        // Re-join active room on reconnection
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
            // Deduplicate incoming message by unique Database ID (_id) or client id
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

          // Reset timer if user continues typing
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
        if (data && data.room === currentRoomRef.current) {
          clearAllTypingTimeouts();
        }
      });
    };

    // Pre-flight health check to handle Render server cold start gracefully
    const checkHealthAndConnect = async () => {
      setConnectionStatus('waking');
      try {
        await apiService.checkHealth();
        if (isSubscribed) {
          isHealthCheckedRef.current = true;
          initSocketConnection();
        }
      } catch (err) {
        if (isSubscribed) {
          // Backend waking up / cold starting. Retry health check polling every 3s
          healthCheckTimerRef.current = setTimeout(checkHealthAndConnect, 3000);
        }
      }
    };

    checkHealthAndConnect();

    return () => {
      isSubscribed = false;
      if (healthCheckTimerRef.current) {
        clearTimeout(healthCheckTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      clearAllTypingTimeouts();
    };
  }, [sessionInfo.sessionId, addToast, clearAllTypingTimeouts]);

  // 3. Network Presence & Mobile Background Tab Recovery Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast('Internet connection restored.', 'success');

      // Immediate socket reconnection or health re-check
      if (socketRef.current) {
        if (!socketRef.current.connected) {
          socketRef.current.connect();
        }
      } else if (!isHealthCheckedRef.current) {
        // Retry initial health check if socket hasn't initialized yet
        apiService.checkHealth().then(() => {
          isHealthCheckedRef.current = true;
          if (socketRef.current && !socketRef.current.connected) {
            socketRef.current.connect();
          }
        }).catch(() => {});
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('disconnected');
      addToast('You are currently offline. Check your network settings.', 'error');
    };

    // Tab visibility recovery (Mobile lock screen / desktop tab switch)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (socketRef.current) {
          if (!socketRef.current.connected && navigator.onLine) {
            setConnectionStatus('reconnecting');
            socketRef.current.connect();
          } else if (socketRef.current.connected) {
            // Guarantee room re-join and count sync when returning to foreground
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
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [addToast]);

  // 4. REST API Fallback History Query Effect when socket is disconnected
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
        // Silence noise during cold-start
      }
    };

    fetchHistoryFallback();

    return () => {
      isActive = false;
    };
  }, [currentRoom, connectionStatus]);

  // Manual retry connection handler
  const retryConnection = useCallback(() => {
    if (!navigator.onLine) {
      addToast('Cannot connect: Internet is offline.', 'error');
      return;
    }
    addToast('Retrying server connection...', 'info');
    setConnectionStatus('connecting');

    if (socketRef.current) {
      socketRef.current.connect();
    } else {
      apiService.checkHealth().then(() => {
        isHealthCheckedRef.current = true;
        if (socketRef.current) socketRef.current.connect();
      }).catch(() => {
        setConnectionStatus('waking');
      });
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

    // Notify server of room change over existing socket connection
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



