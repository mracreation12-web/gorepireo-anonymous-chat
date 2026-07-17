import React from 'react';
import { useSocket } from '../context/SocketContext';
import styles from './StatusBar.module.css';

export const StatusBar = () => {
  const { connectionStatus, onlineCounts } = useSocket();

  const getStatusLabel = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Connection Error';
      default: return 'Offline';
    }
  };

  return (
    <div className={styles.statusBar}>
      <div className={styles.left}>
        <div className={`${styles.indicator} ${styles[connectionStatus]}`} aria-hidden="true" />
        <span>{getStatusLabel()}</span>
      </div>
      <div className={styles.right}>
        <span>Room: {onlineCounts.room} online</span>
        <span>•</span>
        <span>Global: {onlineCounts.global} online</span>
      </div>
    </div>
  );
};

