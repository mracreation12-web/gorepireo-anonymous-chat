import React, { useState, useCallback, memo } from 'react';
import { useSocket } from '../context/SocketContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MessageArea } from './MessageArea';
import { MessageInput } from './MessageInput';
import { StatusBar } from './StatusBar';
import { ErrorState, MessageAreaSkeleton } from './States';
import { ToastContainer } from './Toast';
import styles from './ChatLayout.module.css';

export const ChatLayout = memo(() => {
  const { connectionStatus, messages, toasts, removeToast } = useSocket();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // Render skeletons / error states / or active chat layout based on connection
  const renderContent = () => {
    // If connecting/waking and we don't have messages yet, show pulsing skeletons inside the chat frame
    if ((connectionStatus === 'connecting' || connectionStatus === 'waking') && messages.length === 0) {
      return (
        <>
          <Header onToggleMenu={toggleMobileMenu} />
          <MessageAreaSkeleton />
          <MessageInput />
          <StatusBar />
        </>
      );
    }

    // If connection failed and we have no cached messages, show the offline page
    if (connectionStatus === 'error' && messages.length === 0) {
      return (
        <>
          <Header onToggleMenu={toggleMobileMenu} />
          <ErrorState />
          <MessageInput />
          <StatusBar />
        </>
      );
    }

    const showBanner = connectionStatus !== 'connected' && connectionStatus !== 'waking' && connectionStatus !== 'connecting';

    return (
      <>
        <Header onToggleMenu={toggleMobileMenu} />
        {/* Top reconnection banner to alert user of network drop without blocking message logs */}
        {showBanner && (
          <div className={styles.connectionBanner} role="alert">
            <div className={styles.pulseDot} />
            <span>Connection offline. Reconnecting...</span>
          </div>
        )}
        <MessageArea />
        <MessageInput />
        <StatusBar />
      </>
    );
  };

  return (
    <div className={styles.layout}>
      {/* Toast notifications container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Desktop Sidebar */}
      <div className={styles.desktopSidebar}>
        <Sidebar />
      </div>

      {/* Mobile Drawer Sidebar */}
      <div
        className={`${styles.sidebarOverlay} ${isMobileMenuOpen ? styles.sidebarOverlayActive : ''}`}
        onClick={closeMobileMenu}
        aria-hidden="true"
      />
      <div
        className={`${styles.mobileSidebarContainer} ${isMobileMenuOpen ? styles.mobileSidebarOpen : ''}`}
      >
        <Sidebar onClose={closeMobileMenu} />
      </div>

      {/* Main chat viewport area */}
      <main className={styles.mainArea}>
        {renderContent()}
      </main>
    </div>
  );
});

ChatLayout.displayName = 'ChatLayout';
export default ChatLayout;


