# Implementation Plan - Modern Anonymous Group Chat App

This plan outlines the architecture, components, and implementation details for a real-time, responsive anonymous group chat web application. The application will consist of a React frontend built with Vite and Tailwind CSS, and a Node.js/Express backend integrated with Socket.IO and MongoDB.

## User Review Required

> [!IMPORTANT]
> **Tailwind CSS Version Selection**
> We propose using **Tailwind CSS v4.0** as it is the latest major release, features zero-config setup, native CSS variables, and faster compile times. If you prefer the classic Tailwind CSS v3, please let us know.

> [!NOTE]
> **Self vs. Others Styling (Sender Identity)**
> To visually distinguish "You" (your own messages) from "Others" without storing or revealing any user identity, we will generate a random, non-identifiable session UUID on the client (stored in `localStorage`). This UUID will be sent with each message. 
> - The server will store this temporary session UUID in MongoDB to allow broadcasting.
> - The frontend will use it *only* to color your messages differently (e.g., green/indigo bubble vs. gray bubble).
> - No IP addresses, usernames, or email addresses will be logged, stored, or exposed.

## Open Questions

1. **History Limit**: How many historical messages should load when a user first enters the chat room? We propose loading the last 50 messages, which keeps loading times fast and matches free-tier MongoDB resource constraints.
2. **Fun Monikers**: Should we display randomly generated animal monikers (e.g., "Anonymous Fox", "Anonymous Panda") to help users track different participants in the chat, or keep everyone labeled purely as "Anonymous"? (We recommend fun monikers as it makes anonymous group discussions much easier to follow).

---

## Proposed Changes

We will split the workspace into two clean subdirectories:
- `client/` for the React (Vite) frontend.
- `server/` for the Node.js/Express/Socket.IO backend.

### Backend (Express & Socket.IO)

We will initialize a clean Node.js backend. The server will handle MongoDB connections, host the Socket.IO server, serve a REST endpoint for message history, and broadcast new messages.

#### [NEW] [package.json](file:///c:/Users/LENOVO/OneDrive/Desktop/anonymas/server/package.json)
Contains server dependencies: `express`, `mongoose`, `socket.io`, `cors`, `dotenv`, and `nodemon` (dev dependency).

#### [NEW] [db.js](file:///c:/Users/LENOVO/OneDrive/Desktop/anonymas/server/db.js)
MongoDB connection setup using Mongoose, with auto-reconnect and connection health checks.

#### [NEW] [Message.js](file:///c:/Users/LENOVO/OneDrive/Desktop/anonymas/server/models/Message.js)
Mongoose Schema defining the message structure:
- `content`: String (required, trimmed)
- `senderSessionId`: String (required, client-generated temporary session UUID)
- `moniker`: String (optional, fun generated session moniker)
- `timestamp`: Date (default: `Date.now`)

#### [NEW] [server.js](file:///c:/Users/LENOVO/OneDrive/Desktop/anonymas/server/server.js)
The entry point of our backend.
- Sets up Express with CORS and JSON parsing.
- Initializes Socket.IO and attaches it to the HTTP server.
- Connects to MongoDB Atlas using standard environment variables.
- Exposes a `GET /api/messages` endpoint to fetch historical messages.
- Implements Socket.IO handlers:
  - `join`: Broadcasts current online user counts.
  - `message`: Validates, saves message to MongoDB, and broadcasts to all clients.
  - `disconnect`: Updates and broadcasts the online user counts.

#### [NEW] [render.yaml](file:///c:/Users/LENOVO/OneDrive/Desktop/anonymas/server/render.yaml) or deployment configs
Configuration file for seamless hosting on Render.

---

### Frontend (React & Tailwind CSS)

We will initialize the frontend using Vite. We will use modern UI practices, glassmorphism, responsive design, dark mode support (saved to `localStorage`), and animations.

#### [NEW] [tailwind.config.js](file:///c:/Users/LENOVO/OneDrive/Desktop/anonymas/client/tailwind.config.js) or CSS rules (depending on Tailwind version)
Configures custom animations, fonts, and dark mode triggers.

#### [NEW] [App.jsx](file:///c:/Users/LENOVO/OneDrive/Desktop/anonymas/client/src/App.jsx)
Main container component. Manages application state:
- WebSocket connection state.
- Chat history.
- Local user session info (session ID, animal moniker, theme preferences).
- Settings (sound on/off, auto-scroll toggle).

#### [NEW] [ChatArea.jsx](file:///c:/Users/LENOVO/OneDrive/Desktop/anonymas/client/src/components/ChatArea.jsx)
Displays the scrollable list of messages. Includes:
- Auto-scroll to bottom on new message.
- Grouping messages by date/time.
- Visual status indicators (sending, sent).
- Smooth entry animations using Framer Motion.

#### [NEW] [MessageInput.jsx](file:///c:/Users/LENOVO/OneDrive/Desktop/anonymas/client/src/components/MessageInput.jsx)
Message composer. Includes:
- Text input field.
- Emoji picker popover (built with premium look or standard emojis).
- Quick emoji reaction shortcuts.
- Character count validation (e.g., max 1000 characters to prevent spam).

#### [NEW] [Header.jsx](file:///c:/Users/LENOVO/OneDrive/Desktop/anonymas/client/src/components/Header.jsx)
Top bar containing the application title, dark/light mode toggle, online user count indicator, and details about the user's temporary moniker.

---

## Verification Plan

### Automated Tests
We will build the frontend and run validation checks using:
- `npm run build` inside `client/` to verify Vite bundle compilation.
- Node.js runtime script sanity checks to ensure the backend starts.

### Manual Verification
1. **Multi-client Synchronization**: Open two browser windows (one in normal mode, one in incognito) and verify messages appear instantly in both.
2. **Database Persistence**: Restart the backend server, refresh the client, and verify that the message history is correctly reloaded from MongoDB.
3. **Responsive Design**: Test layout responsiveness using Chrome DevTools device simulation (Mobile, Tablet, Desktop).
4. **Dark Mode Toggle**: Toggle theme, reload the page, and ensure user theme choice is persisted in `localStorage`.
5. **Auto-scrolling**: Verify that receiving a new message automatically scrolls the viewport to the bottom if the user is already near the bottom.
