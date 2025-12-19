import { createServer } from 'http'
import { Server } from 'socket.io'

// Create HTTP server
const httpServer = createServer()

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
})

// Store active rooms
const rooms = new Map<string, Set<string>>()
// Store device info: socketId -> { name: string, roomId: string }
const deviceInfo = new Map<string, { name: string, roomId: string }>()
// Store which devices each socket is interested in (for auto-reconnect)
// deviceName -> Set of socketIds that have this device in recent connections
const deviceSubscriptions = new Map<string, Set<string>>()

// Socket.io connection handling
io.on('connection', (socket) => {
  // Join a room
  socket.on('join-room', (data: { roomId: string, deviceName?: string }) => {
    const roomId = typeof data === 'string' ? data : data.roomId
    const deviceName = typeof data === 'string' ? undefined : data.deviceName
    
    socket.join(roomId)
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set())
    }
    rooms.get(roomId)!.add(socket.id)
    
    // Store device info
    if (deviceName) {
      deviceInfo.set(socket.id, { name: deviceName, roomId })
    }
    
    // Notify others in the room with device info
    const deviceInfoForPeer = deviceInfo.get(socket.id)
    socket.to(roomId).emit('peer-joined', { 
      peerId: socket.id,
      deviceName: deviceInfoForPeer?.name
    })
    
    // Broadcast to only interested sockets (devices that have this device in recent connections)
    // This is much more efficient than broadcasting to all 10k+ users
    if (deviceName) {
      const interestedSockets = deviceSubscriptions.get(deviceName)
      if (interestedSockets && interestedSockets.size > 0) {
        // Only send to sockets that are interested in this device
        interestedSockets.forEach(socketId => {
          const targetSocket = io.sockets.sockets.get(socketId)
          if (targetSocket && targetSocket.id !== socket.id) {
            targetSocket.emit('room-join-request', {
              roomId,
              deviceName,
              requestingSocketId: socket.id
            })
          }
        })
      }
    }
    
    // Send list of existing peers with their device names
    const peers = Array.from(rooms.get(roomId)!).filter(id => id !== socket.id)
    const peersWithInfo = peers.map(peerId => ({
      peerId,
      deviceName: deviceInfo.get(peerId)?.name
    }))
    socket.emit('peers', peersWithInfo)
  })

  // WebRTC signaling: offer
  socket.on('offer', (data: { offer: RTCSessionDescriptionInit, target: string, roomId: string, deviceName?: string }) => {
    socket.to(data.target).emit('offer', {
      offer: data.offer,
      from: socket.id,
      deviceName: data.deviceName || deviceInfo.get(socket.id)?.name
    })
  })

  // WebRTC signaling: answer
  socket.on('answer', (data: { answer: RTCSessionDescriptionInit, target: string }) => {
    socket.to(data.target).emit('answer', {
      answer: data.answer,
      from: socket.id
    })
  })

  // WebRTC signaling: ICE candidate
  socket.on('ice-candidate', (data: { candidate: RTCIceCandidateInit, target: string }) => {
    socket.to(data.target).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    })
  })

  // Leave room
  socket.on('leave-room', (roomId: string) => {
    socket.leave(roomId)
    if (rooms.has(roomId)) {
      rooms.get(roomId)!.delete(socket.id)
      if (rooms.get(roomId)!.size === 0) {
        rooms.delete(roomId)
      }
    }
    socket.to(roomId).emit('peer-left', { peerId: socket.id })
  })

  // Subscribe to notifications for specific devices (for auto-reconnect)
  socket.on('subscribe-devices', (deviceNames: string[]) => {
    deviceNames.forEach(deviceName => {
      if (!deviceSubscriptions.has(deviceName)) {
        deviceSubscriptions.set(deviceName, new Set())
      }
      deviceSubscriptions.get(deviceName)!.add(socket.id)
    })
  })

  // Unsubscribe from device notifications
  socket.on('unsubscribe-devices', (deviceNames: string[]) => {
    deviceNames.forEach(deviceName => {
      const subscribers = deviceSubscriptions.get(deviceName)
      if (subscribers) {
        subscribers.delete(socket.id)
        if (subscribers.size === 0) {
          deviceSubscriptions.delete(deviceName)
        }
      }
    })
  })

  // Disconnect
  socket.on('disconnect', () => {
    // Clean up rooms and device info
    for (const [roomId, peers] of rooms.entries()) {
      if (peers.has(socket.id)) {
        peers.delete(socket.id)
        socket.to(roomId).emit('peer-left', { peerId: socket.id })
        if (peers.size === 0) {
          rooms.delete(roomId)
        }
      }
    }
    deviceInfo.delete(socket.id)
    
    // Clean up subscriptions
    for (const [deviceName, subscribers] of deviceSubscriptions.entries()) {
      subscribers.delete(socket.id)
      if (subscribers.size === 0) {
        deviceSubscriptions.delete(deviceName)
      }
    }
  })
})

// Health check endpoint
httpServer.on('request', (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }
})

// Start server
const port = process.env.PORT || 3000
httpServer.listen(port, () => {
  console.log(`🚀 Signaling server running on http://localhost:${port}`)
})

