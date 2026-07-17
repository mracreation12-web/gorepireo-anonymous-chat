import React from 'react';
import styles from './Toast.module.css';

export const Toast = ({ message, type = 'info', onClose }) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  };

  return (
    <div className={`${styles.toast} ${styles[type]}`} role="alert">
      <span className={styles.icon}>{getIcon()}</span>
      <span className={styles.text}>{message}</span>
      <button onClick={onClose} className={styles.closeBtn} aria-label="Close notification">
        ✕
      </button>
    </div>
  );
};

export const ToastContainer = ({ toasts, removeToast }) => {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};
