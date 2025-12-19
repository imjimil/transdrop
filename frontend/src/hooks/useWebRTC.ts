import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import Peer from 'simple-peer'

interface UseWebRTCOptions {
  roomId?: string
  deviceName: string
  onPeerConnected?: (peerId: string, deviceName?: string) => void
  onPeerDisconnected?: (peerId: string) => void
  onDataReceived?: (data: any) => void
}

export function useWebRTC({
  roomId,
  deviceName,
  onPeerConnected,
  onPeerDisconnected,
  onDataReceived,
}: UseWebRTCOptions) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [peers, setPeers] = useState<string[]>([])
  const [connectedPeers, setConnectedPeers] = useState<Set<string>>(new Set())
  const peersRef = useRef<Map<string, Peer.Instance>>(new Map())
  const connectedPeersRef = useRef<Set<string>>(new Set())
  const notifiedPeersRef = useRef<Set<string>>(new Set()) // Track peers we've already notified about
  const socketRef = useRef<Socket | null>(null)
  const listenersRegisteredRef = useRef(false) // Track if socket listeners have been registered
  const callbacksRef = useRef({ onPeerConnected, onPeerDisconnected, onDataReceived })
  const roomIdRef = useRef(roomId)
  const deviceNameRef = useRef(deviceName)

  // Update refs when props change
  useEffect(() => {
    callbacksRef.current = { onPeerConnected, onPeerDisconnected, onDataReceived }
    roomIdRef.current = roomId
    deviceNameRef.current = deviceName
  }, [onPeerConnected, onPeerDisconnected, onDataReceived, roomId, deviceName])

  // Create WebRTC peer connection - defined early so it can be used in socket handlers
  const createPeer = useCallback((peerId: string, initiator: boolean) => {
    // Don't create duplicate peers
    if (peersRef.current.has(peerId)) {
      console.log(`⚠️ Peer ${peerId} already exists, skipping creation`)
      return
    }

    console.log(`🔧 Creating WebRTC peer connection for ${peerId} (initiator: ${initiator})`)

    try {
      const peer = new Peer({
        initiator,
        trickle: false,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      })

      peersRef.current.set(peerId, peer)
      console.log(`✅ Peer ${peerId} added to peers map. Total peers: ${peersRef.current.size}`)

      peer.on('signal', (data: any) => {
        if (!socketRef.current?.connected) return

        if (data.type === 'offer') {
          socketRef.current.emit('offer', {
            offer: data,
            target: peerId,
            roomId: roomIdRef.current || '',
            deviceName: deviceNameRef.current,
          })
        } else if (data.type === 'answer') {
          socketRef.current.emit('answer', {
            answer: data,
            target: peerId,
          })
        } else {
          // ICE candidate
          socketRef.current.emit('ice-candidate', {
            candidate: data,
            target: peerId,
          })
        }
      })

      peer.on('connect', () => {
        console.log(`🔗 WebRTC peer ${peerId} connected! Data channel ready.`)
        setConnectedPeers(prev => {
          const next = new Set([...prev, peerId])
          connectedPeersRef.current = next
          return next
        })
        // Don't call onPeerConnected here - it's already called when we receive peer info from server
        // This prevents duplicate device entries
      })

      peer.on('data', (data) => {
        try {
          const parsed = JSON.parse(data.toString())
          console.log(`📨 Raw data received from peer ${peerId}:`, parsed)
          callbacksRef.current.onDataReceived?.(parsed)
        } catch (e) {
          console.error(`❌ Error parsing data from peer ${peerId}:`, e)
        }
      })

      peer.on('error', (error) => {
        console.error(`❌ WebRTC peer ${peerId} error:`, error)
      })

      peer.on('close', () => {
          console.log(`🔌 WebRTC peer ${peerId} closed`)
          setConnectedPeers(prev => {
            const next = new Set(prev)
            next.delete(peerId)
            connectedPeersRef.current = next
            return next
          })
          peersRef.current.delete(peerId)
          notifiedPeersRef.current.delete(peerId) // Remove from notified set when peer disconnects
          callbacksRef.current.onPeerDisconnected?.(peerId)
      })
    } catch (error) {
      console.error(`❌ Error creating peer ${peerId}:`, error)
    }
  }, [])

  // Initialize Socket.io connection - only when roomId is provided
  useEffect(() => {
    if (!roomId) {
      // Reset listeners flag when roomId is cleared
      listenersRegisteredRef.current = false
      return
    }
    
    let mounted = true
    let socketInstance: Socket | null = null

    // Only connect when needed - delay to not block render
    const initSocket = () => {
      if (!mounted || socketRef.current?.connected || listenersRegisteredRef.current) {
        return
      }
      
      listenersRegisteredRef.current = true

      try {
        const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000'
        socketInstance = io(serverUrl, {
          transports: ['websocket', 'polling'],
          timeout: 5000,
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 1000,
        })

        socketInstance.on('connect', () => {
          if (!mounted) return
          setIsConnected(true)
          setSocket(socketInstance)
          socketRef.current = socketInstance

          // Join room if roomId is provided
          if (roomIdRef.current && socketInstance) {
            // Clear notified peers when joining a new room
            notifiedPeersRef.current.clear()
            socketInstance.emit('join-room', {
              roomId: roomIdRef.current,
              deviceName: deviceNameRef.current
            })
          }
        })

        socketInstance.on('connect_error', () => {
          // Silently handle connection errors
        })

        socketInstance.on('disconnect', () => {
          if (!mounted) return
          setIsConnected(false)
        })

        // Handle peer list - only called when we first join a room
        socketInstance.on('peers', (peersData: Array<{ peerId: string, deviceName?: string }> | string[]) => {
          if (!mounted) return
          
          console.log(`📋 Received 'peers' event:`, peersData)
          
          // Handle both old format (string[]) and new format (Array<{peerId, deviceName}>)
          const peerIds = Array.isArray(peersData) && peersData.length > 0 && typeof peersData[0] === 'string'
            ? peersData as string[]
            : (peersData as Array<{ peerId: string, deviceName?: string }>).map(p => p.peerId)
          
          console.log(`📋 Processed peer IDs:`, peerIds)
          setPeers(peerIds)
          
          // Create WebRTC connections to existing peers and notify with device names
          if (Array.isArray(peersData) && peersData.length > 0 && typeof peersData[0] !== 'string') {
            const peersWithInfo = peersData as Array<{ peerId: string, deviceName?: string }>
            peersWithInfo.forEach(({ peerId, deviceName }) => {
              // Create peer connection if needed
              if (!peersRef.current.has(peerId)) {
                console.log(`📡 Creating peer connection for ${peerId} from 'peers' event`)
                createPeer(peerId, true)
              } else {
                console.log(`ℹ️ Peer ${peerId} already exists in map`)
              }
              
              // Notify with device name - STRICT: check and add atomically, then notify synchronously
              if (deviceName && !notifiedPeersRef.current.has(peerId)) {
                notifiedPeersRef.current.add(peerId)
                // Call immediately - the callback itself has duplicate protection
                callbacksRef.current.onPeerConnected?.(peerId, deviceName)
              }
            })
          } else {
            // Fallback: create peers without device names
            peerIds.forEach(peerId => {
              if (!peersRef.current.has(peerId)) {
                createPeer(peerId, true)
              }
            })
          }
        })

        // Handle new peer joining - only called when someone else joins after we're already in the room
        socketInstance.on('peer-joined', ({ peerId, deviceName }: { peerId: string, deviceName?: string }) => {
          if (!mounted) return
          
          console.log(`👋 Received 'peer-joined' event for ${peerId} (${deviceName || 'no name'})`)
          
          // STRICT: Skip if we've already notified about this peer (prevents duplicates)
          if (notifiedPeersRef.current.has(peerId)) {
            console.log(`⚠️ Peer ${peerId} already notified, skipping`)
            return // Already processed this peer, skip completely
          }
          
          setPeers(prev => {
            if (prev.includes(peerId)) return prev
            return [...prev, peerId]
          })
          
          if (!peersRef.current.has(peerId)) {
            console.log(`📡 Creating peer connection for ${peerId} from 'peer-joined' event`)
            createPeer(peerId, false)
          } else {
            console.log(`ℹ️ Peer ${peerId} already exists in map`)
          }
          
          // Notify with device name if provided - only if we haven't notified about this peer yet
          if (deviceName) {
            // Check and add atomically
            if (!notifiedPeersRef.current.has(peerId)) {
              notifiedPeersRef.current.add(peerId)
              // Call immediately - the callback itself has duplicate protection
              callbacksRef.current.onPeerConnected?.(peerId, deviceName)
            }
          }
        })

        // Handle peer leaving
        socketInstance.on('peer-left', ({ peerId }: { peerId: string }) => {
          if (!mounted) return
          setPeers(prev => prev.filter(id => id !== peerId))
          
          const peer = peersRef.current.get(peerId)
          if (peer) {
            peer.destroy()
            peersRef.current.delete(peerId)
          }
          
          setConnectedPeers(prev => {
            const next = new Set(prev)
            next.delete(peerId)
            return next
          })
          
          callbacksRef.current.onPeerDisconnected?.(peerId)
        })

        // Handle WebRTC offer
        socketInstance.on('offer', async ({ offer, from }: { offer: RTCSessionDescriptionInit; from: string }) => {
          if (!mounted) return
          const peer = peersRef.current.get(from)
          if (peer) {
            try {
              await peer.signal(offer)
            } catch (error) {
              // Silently handle signaling errors
            }
          }
        })

        // Handle WebRTC answer
        socketInstance.on('answer', async ({ answer, from }: { answer: RTCSessionDescriptionInit; from: string }) => {
          if (!mounted) return
          const peer = peersRef.current.get(from)
          if (peer) {
            try {
              await peer.signal(answer)
            } catch (error) {
              // Silently handle signaling errors
            }
          }
        })

        // Handle ICE candidate
        socketInstance.on('ice-candidate', ({ candidate, from }: { candidate: any; from: string }) => {
          if (!mounted) return
          const peer = peersRef.current.get(from)
          if (peer && candidate) {
            try {
              peer.signal(candidate)
            } catch (error) {
              // Silently handle signaling errors
            }
          }
        })

        socketRef.current = socketInstance
        setSocket(socketInstance)
      } catch (error) {
        // Silently handle initialization errors
      }
    }

    // Delay connection to not block initial render
    const timer = setTimeout(initSocket, 200)
    
    return () => {
      mounted = false
      clearTimeout(timer)
      listenersRegisteredRef.current = false // Reset flag on cleanup
      if (socketInstance) {
        // Remove all event listeners before closing to prevent duplicate handlers
        socketInstance.removeAllListeners()
        socketInstance.close()
      }
      peersRef.current.forEach(peer => peer.destroy())
      peersRef.current.clear()
      notifiedPeersRef.current.clear()
      setConnectedPeers(new Set())
      connectedPeersRef.current = new Set()
    }
  }, [roomId, createPeer])

  // Join room when roomId changes
  useEffect(() => {
    if (socketRef.current?.connected && roomId) {
      socketRef.current.emit('join-room', { 
        roomId, 
        deviceName: deviceName 
      })
    }
  }, [roomId, isConnected, deviceName])

  // Join a room function
  const joinRoom = useCallback((newRoomId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-room', { 
        roomId: newRoomId, 
        deviceName: deviceName 
      })
    } else {
      // If not connected yet, store the roomId and join when connected
      roomIdRef.current = newRoomId
      // Try to connect if not already connecting
      if (!socketRef.current) {
        // Socket will be initialized by the useEffect
      }
    }
  }, [deviceName])

  // Leave a room function
  const leaveRoom = useCallback((roomIdToLeave: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-room', roomIdToLeave)
    }
  }, [])

  // Send data to a peer
  const sendData = useCallback((peerId: string, data: any) => {
    const peer = peersRef.current.get(peerId)
    const isConnected = connectedPeersRef.current.has(peerId)
    
    console.log(`🔍 Attempting to send data to peer ${peerId}:`, {
      peerExists: !!peer,
      isConnected,
      dataType: data.type,
      hasPeerInMap: peersRef.current.has(peerId),
      connectedPeers: Array.from(connectedPeersRef.current),
    })
    
    // Check if peer exists and is connected
    if (peer && isConnected) {
      try {
        const dataString = JSON.stringify(data)
        peer.send(dataString)
        console.log(`✅ Data sent successfully to peer ${peerId} (${data.type})`)
        return true
      } catch (error) {
        console.error(`❌ Error sending data to peer ${peerId}:`, error)
        return false
      }
    }
    
    // If peer exists but not connected, log the issue
    if (peer && !isConnected) {
      console.warn(`⚠️ Peer ${peerId} exists but is not connected yet. Connection status:`, {
        inConnectedPeers: connectedPeersRef.current.has(peerId),
        peerState: peer.destroyed ? 'destroyed' : 'active',
      })
    } else if (!peer) {
      console.warn(`⚠️ Peer ${peerId} does not exist in peers map. Available peers:`, Array.from(peersRef.current.keys()))
    }
    
    return false
  }, [])

  return {
    socket,
    isConnected,
    peers,
    connectedPeers: Array.from(connectedPeers),
    joinRoom,
    leaveRoom,
    sendData,
  }
}
