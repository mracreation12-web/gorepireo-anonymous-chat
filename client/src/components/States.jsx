import React, { memo } from 'react';
import { useSocket } from '../context/SocketContext';
import styles from './States.module.css';

export const LoadingState = memo(({ message = 'Connecting to server...' }) => (
  <div className={styles.container} role="status">
    <div className={styles.spinner}></div>
    <div className={styles.title}>Loading Chat</div>
    <p className={styles.message}>{message}</p>
  </div>
));
LoadingState.displayName = 'LoadingState';

export const ErrorState = memo(({ message = 'Failed to establish connection. Reconnecting...' }) => {
  const { retryConnection } = useSocket();
  return (
    <div className={styles.container} role="alert">
      <span className={styles.errorIcon} aria-hidden="true">⚠️</span>
      <div className={styles.title}>Connection Offline</div>
      <p className={styles.message}>{message}</p>
      <button onClick={retryConnection} className={styles.retryBtn}>
        Retry Connection
      </button>
    </div>
  );
});
ErrorState.displayName = 'ErrorState';

export const EmptyState = memo(({ title = 'No Messages Yet', message = 'Say hello to initiate the conversation!' }) => (
  <div className={styles.container}>
    <span className={styles.icon} aria-hidden="true">💬</span>
    <div className={styles.title}>{title}</div>
    <p className={styles.message}>{message}</p>
  </div>
));
EmptyState.displayName = 'EmptyState';

export const MessageAreaSkeleton = memo(() => (
  <div className={styles.skeletonContainer} aria-hidden="true">
    {[1, 2, 3, 4].map((n) => (
      <div key={n} className={styles.skeletonRow}>
        <div className={styles.skeletonAvatar} />
        <div className={styles.skeletonTextWrapper}>
          <div className={styles.skeletonLineShort} />
          <div className={styles.skeletonLineLong} />
        </div>
      </div>
    ))}
  </div>
));
MessageAreaSkeleton.displayName = 'MessageAreaSkeleton';


