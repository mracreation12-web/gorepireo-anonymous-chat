import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import styles from './Sidebar.module.css';

const DEFAULT_ROOMS = ['general', 'development', 'random', 'gaming', 'memes'];
const ROOM_NAME_REGEX = /^[a-zA-Z0-9\-_]+$/;

export const Sidebar = ({ onClose }) => {
  const { currentRoom, joinRoom } = useSocket();
  const [customRoom, setCustomRoom] = useState('');
  const [error, setError] = useState('');

  const handleRoomClick = (roomName) => {
    joinRoom(roomName);
    if (onClose) onClose(); // For mobile sidebars
  };

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    const sanitized = customRoom.trim();

    if (!sanitized) {
      setError('Room name cannot be empty.');
      return;
    }
    if (sanitized.length > 50) {
      setError('Limit room name to 50 chars.');
      return;
    }
    if (!ROOM_NAME_REGEX.test(sanitized)) {
      setError('Alphanumeric, - and _ only.');
      return;
    }

    setError('');
    joinRoom(sanitized);
    setCustomRoom('');
    if (onClose) onClose();
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoArea}>
        <span className={styles.logoIcon} aria-hidden="true">🔑</span>
        <h1 className={styles.appName}> GoRepireo </h1>
      </div>

      <nav className={styles.section} aria-label="Chat Rooms">
        <h2 className={styles.sectionTitle}>Channels</h2>
        <ul className={styles.roomList}>
          {DEFAULT_ROOMS.map((room) => (
            <li key={room}>
              <button
                className={`${styles.roomBtn} ${currentRoom === room ? styles.activeRoom : ''}`}
                onClick={() => handleRoomClick(room)}
                aria-current={currentRoom === room ? 'page' : undefined}
              >
                <span>
                  <span className={styles.hash} aria-hidden="true">#</span>
                  {room}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Custom Room Join form */}
        <form className={styles.form} onSubmit={handleJoinSubmit}>
          <h2 className={styles.sectionTitle}>Join Custom Room</h2>
          <div className={styles.inputGroup}>
            <span className={styles.inputHash} aria-hidden="true">#</span>
            <input
              type="text"
              value={customRoom}
              onChange={(e) => {
                setCustomRoom(e.target.value);
                setError('');
              }}
              className={styles.input}
              placeholder="room-name"
              aria-label="Custom room name"
            />
          </div>
          {error && <p className={styles.errorText} role="alert">{error}</p>}
          <button type="submit" className={styles.joinBtn} disabled={!customRoom.trim()}>
            Join Room
          </button>
        </form>
      </nav>
    </aside>
  );
};
