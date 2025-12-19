# TransDrop 🚀

A beautiful, cross-platform file transfer service that works seamlessly across Windows, Android, and Mac - like AirDrop, but for everyone.

## ✨ Features

- **Peer-to-Peer Transfers**: Direct device-to-device file transfer via WebRTC (no server storage)
- **Modern UI/UX**: Glassmorphism + Neumorphism design with smooth animations
- **Progressive Web App**: Works everywhere, installable on all platforms
- **Zero Accounts**: No sign-up required, just share and transfer
- **Mobile-First**: Intuitive, gesture-friendly interface

## 🛠️ Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Radix UI + Framer Motion
- **Backend**: Node.js + Fastify + TypeScript + Socket.io (signaling only)
- **WebRTC**: Simple-peer for P2P connections
- **Design**: Glassmorphism + Neumorphism hybrid

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Development

```bash
# Install dependencies
npm install

# Start frontend (dev mode)
cd frontend && npm run dev

# Start backend (dev mode)
cd backend && npm run dev
```

Frontend runs on `http://localhost:5173`
Backend runs on `http://localhost:3000`

## 📁 Project Structure

```
transdrop/
├── frontend/          # React PWA application
├── backend/           # Node.js signaling server
└── README.md
```

## 🎨 Design Philosophy

- **Glassmorphism**: Frosted glass effects, blur, transparency
- **Neumorphism**: Soft shadows, subtle depth
- **Dark Mode First**: Vibrant gradients on dark backgrounds
- **Mobile-First**: Touch-friendly, gesture-based interactions

## 📝 License

MIT

