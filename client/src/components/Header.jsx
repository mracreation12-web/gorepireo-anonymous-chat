import React from 'react';
import { useSocket } from '../context/SocketContext';
import styles from './Header.module.css';

export const Header = ({ onToggleMenu }) => {
  const { currentRoom, sessionInfo } = useSocket();

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <button
          className={styles.menuBtn}
          onClick={onToggleMenu}
          aria-label="Open sidebar channels menu"
        >
          ☰
        </button>
        <div className={styles.titleGroup}>
          <span className={styles.hash} aria-hidden="true">#</span>
          <span className={styles.roomName}>{currentRoom}</span>
        </div>
      </div>
      
      <div className={styles.monikerBadge} title="Your anonymous identity for this session">
        <div className={styles.avatarDot} />
        <span>{sessionInfo.moniker || 'Connecting...'}</span>
      </div>
    </header>
  );
};
