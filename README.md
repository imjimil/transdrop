## TransDrop

Cross-platform, AirDrop-style file and text sharing that works between browsers on Windows, Android, and macOS. Files are sent directly between devices using WebRTC; the server is used only for signaling and never stores file contents.

### Features

- **Peer-to-peer transfers**: Files and text are sent over WebRTC data channels directly between browsers (no file storage on the server).
- **Automatic pairing and recents**: Remember previously paired devices and auto-reconnect when both sides come back online.
- **Code-based pairing**: Six-digit codes plus a “Recent devices” list to connect quickly and safely.
- **Modern UI/UX**: Minimal, radar-style layout with device bubbles, clear progress indicators, and custom notifications.
- **Mobile and desktop**: Click/right-click on desktop, tap/long-press on mobile, with responsive layout and icons for device type.

### Tech Stack

- **Frontend**
  - React + TypeScript + Vite
  - Tailwind CSS for styling
  - Framer Motion for animations
  - Lucide React icons

- **Backend**
  - Node.js (TypeScript)
  - Socket.io for WebSocket signaling

- **Realtime / Transport**
  - WebRTC DataChannel via `simple-peer` for peer-to-peer connections and file transfer

### How It Works

- **Signaling (server side)**
  - The backend keeps three in-memory maps:
    - `rooms`: `roomId -> Set<socketId>`
    - `deviceInfo`: `socketId -> { name, roomId }`
    - `deviceSubscriptions`: `deviceName -> Set<socketId>` for “recent devices” auto-reconnect.
  - When a client joins a room, the server:
    - Adds the socket to the room.
    - Notifies existing peers in that room via `peer-joined`.
    - Sends the new client a `peers` list so it can initiate WebRTC connections.
    - Emits a targeted `room-join-request` only to clients that have that device in their recent history.
  - WebRTC signaling messages (`offer`, `answer`, `ice-candidate`) are just forwarded between peers; the server never sees file content.

- **WebRTC / P2P (frontend)**
  - Each peer connection is created and managed by a custom `useWebRTC` hook.
  - File transfer is handled by `useFileTransfer`, which:
    - Chunks files into small pieces.
    - Sends metadata first (name, size, type, total chunks).
    - Streams binary chunks over the data channel with progress updates.
    - Reassembles the file on the receiver and exposes it to the UI.

- **Pairing and recents**
  - `pairingHistory` stores recent pairings in `localStorage` as:
    - `{ deviceName, roomId, lastConnected, connectionCount }`.
  - Room IDs for a pair of devices are deterministic using `generatePairingRoomId(deviceName1, deviceName2)` so both sides derive the same six-digit code without coordination.
  - On mount, the app:
    - Looks up the most recent pairing.
    - Auto-joins that room if possible (auto-reconnect).
  - The “Recent devices” list lets you:
    - Click a device to reconnect.
    - Remove entries from history.

### Security Model

- **Transport encryption**
  - All file and text data between browsers is sent over WebRTC DataChannels.
  - WebRTC in browsers uses DTLS/SRTP, so the connection between peers is encrypted by default.

- **Server visibility**
  - The server only sees:
    - Signaling metadata (room IDs, device names, socket IDs).
    - Which sockets are in which rooms.
  - The server does **not**:
    - Store files.
    - See file contents or text sent over the data channel.

- **Persistence**
  - On the server: `rooms`, `deviceInfo`, and `deviceSubscriptions` are kept **in memory only** and are lost on restart.
  - On the client: device name and pairing history are stored in `localStorage` per browser.


### Getting Started

#### Prerequisites

- Node.js 18+
- npm (or another Node package manager)

#### Install dependencies

From the project root:

```bash
cd backend
npm install

cd ../frontend
npm install
```

#### Run in development

Backend (signaling server):

```bash
cd backend
npm run dev
```

Frontend (React app):

```bash
cd frontend
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

### Project Structure

```text
transdrop/
  backend/        Node.js + Socket.io signaling server
  frontend/       React + Vite frontend (TransDrop UI)
  README.md       This file
  SETUP.md        Additional setup notes
  TECHNICAL_DISCUSSION.md   Deeper technical design notes
```

### Notes for Production

- Run the signaling server behind HTTPS/WSS (for encrypted signaling).
- Consider horizontal scaling with a shared Socket.io adapter (Redis) if you outgrow a single node.
- Monitor memory use; the current in-memory structures are sized for active sessions only and are cleaned up on disconnect.

### License

MIT

