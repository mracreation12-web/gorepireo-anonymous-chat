import React from 'react';
import { SocketProvider } from './context/SocketContext';
import { ChatLayout } from './components/ChatLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles/theme.css';

function App() {
  return (
    <ErrorBoundary>
      <SocketProvider>
        <ChatLayout />
      </SocketProvider>
    </ErrorBoundary>
  );
}

export default App;


