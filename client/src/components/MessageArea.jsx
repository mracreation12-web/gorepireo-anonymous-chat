import React, { useEffect, useRef, memo } from 'react';
import { useSocket } from '../context/SocketContext';
import { EmptyState } from './States';
import styles from './MessageArea.module.css';

// Memoized message item to prevent unnecessary list re-renders during high traffic
const MessageItem = memo(({ msg, isSelf, formatTime }) => {
  return (
    <div className={`${styles.messageRow} ${isSelf ? styles.selfRow : styles.otherRow}`}>
      <div className={`${styles.metaInfo} ${isSelf ? styles.selfMeta : styles.otherMeta}`}>
        <span className={`${styles.senderName} ${isSelf ? styles.selfSenderName : ''}`}>
          {isSelf ? 'You' : msg.moniker}
        </span>
        <span className={styles.timestamp}>{formatTime(msg.createdAt)}</span>
      </div>
      <div className={`${styles.bubble} ${isSelf ? styles.selfBubble : styles.otherBubble}`}>
        {msg.content}
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export const MessageArea = () => {
  const { messages, sessionInfo } = useSocket();
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const prevRoomRef = useRef(null);

  // Auto-scroll logic: Snaps to bottom on load/room-change, scrolls smoothly on new messages if near bottom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const currentRoom = messages[0]?.room;
    const isRoomChanged = prevRoomRef.current !== currentRoom;
    const isInitialLoad = messages.length > 0 && prevRoomRef.current === null;

    // Detect if client is already scrolled close to the bottom (within 150px)
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;

    if (isRoomChanged || isInitialLoad) {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'auto' });
      }
    } else if (isNearBottom) {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }

    if (messages.length > 0) {
      prevRoomRef.current = currentRoom;
    }
  }, [messages]);

  // Clean time formatting helper
  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  if (messages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div
      className={styles.messageArea}
      ref={containerRef}
      role="log"
      aria-label="Chat messages history"
    >
      {messages.map((msg, index) => {
        const isSelf = msg.senderSessionId === sessionInfo.sessionId;
        return (
          <MessageItem
            key={msg._id || msg.id || index}
            msg={msg}
            isSelf={isSelf}
            formatTime={formatTime}
          />
        );
      })}
      <div className={styles.scrollAnchor} ref={bottomRef} aria-hidden="true" />
    </div>
  );
};


