import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import styles from './MessageInput.module.css';

export const MessageInput = () => {
  const { sendMessage, sendTypingStart, sendTypingStop, connectionStatus, typingUsers, sessionInfo } = useSocket();
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isTypingRef = useRef(false);
  const stopTimeoutRef = useRef(null);

  const isDisconnected = connectionStatus !== 'connected';

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    };
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    if (val.length <= 1000) {
      setText(val);
    }

    // Stop typing status immediately if input is cleared
    if (val.trim().length === 0 && isTypingRef.current) {
      isTypingRef.current = false;
      sendTypingStop();
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
      return;
    }

    // Handle typing status triggers
    if (!isTypingRef.current && val.trim().length > 0) {
      isTypingRef.current = true;
      sendTypingStart();
    }

    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
    }

    stopTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTypingStop();
    }, 1500);
  };

  // Stop typing immediately when input loses focus
  const handleBlur = () => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTypingStop();
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
    }
  };

  const handleFormSubmit = useCallback((e) => {
    if (e) e.preventDefault();
    
    const sanitized = text.trim();
    if (!sanitized || isDisconnected || isSubmitting) return;

    try {
      setIsSubmitting(true);
      sendMessage(sanitized);
      setText('');

      // Clear typing timeout and stop typing status immediately
      isTypingRef.current = false;
      sendTypingStop();
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
      }
    } finally {
      // Small debounce before enabling next send to prevent rapid keyboard flooding
      setTimeout(() => {
        setIsSubmitting(false);
      }, 100);
    }
  }, [text, isDisconnected, isSubmitting, sendMessage, sendTypingStop]);

  const handleKeyDown = (e) => {
    // Send message on Enter without Shift
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFormSubmit();
    }
  };

  const getTypingText = () => {
    if (!typingUsers || typingUsers.length === 0) return '';
    // Exclude current user's moniker from the typing indicator list
    const otherTypers = typingUsers.filter((u) => u !== sessionInfo.moniker);
    if (otherTypers.length === 0) return '';
    if (otherTypers.length === 1) return `${otherTypers[0]} is typing...`;
    if (otherTypers.length === 2) return `${otherTypers[0]} and ${otherTypers[1]} are typing...`;
    return `${otherTypers.length} people are typing...`;
  };

  const typingText = getTypingText();

  return (
    <div className={styles.container}>
      <div className={styles.typingIndicator} aria-live="polite">
        {typingText ? typingText : '\u00A0'}
      </div>
      <form onSubmit={handleFormSubmit} className={styles.form}>
        <div className={styles.inputWrapper}>
          <textarea
            value={text}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={styles.input}
            placeholder={isDisconnected ? "Connecting to chat room..." : "Type your anonymous message..."}
            rows={1}
            maxLength={1000}
            aria-label="Write a message"
            autoFocus
            disabled={isDisconnected || isSubmitting}
          />
          <div className={`${styles.charCounter} ${text.length > 900 ? styles.charWarning : ''}`}>
            {text.length}/1000
          </div>
        </div>
        <button
          type="submit"
          disabled={isDisconnected || isSubmitting || !text.trim()}
          className={styles.sendBtn}
          aria-label="Send message"
        >
          <span className={styles.sendIcon} aria-hidden="true">➤</span>
        </button>
      </form>
    </div>
  );
};

export default MessageInput;

