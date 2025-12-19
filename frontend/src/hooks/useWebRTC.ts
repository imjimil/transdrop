import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import Peer from 'simple-peer'

interface UseWebRTCOptions {
  roomId?: string
  deviceName: string
  onPeerConnected?: (peerId: string, deviceName?: string) => void
  onPeerDisconnected?: (peerId: string) => void
  onDataReceived?: (data: any, senderDeviceName?: string) => void
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
  const peerDeviceNamesRef = useRef<Map<string, string>>(new Map()) // Store device names for peers
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
      const existingPeer = peersRef.current.get(peerId)
      // If existing peer is destroyed, remove it and create a new one
      if (existingPeer && existingPeer.destroyed) {
        peersRef.current.delete(peerId)
      } else {
        return
      }
    }

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
        setConnectedPeers(prev => {
          const next = new Set([...prev, peerId])
          connectedPeersRef.current = next
          return next
        })
        // Notify about peer connection if we haven't already
        // This ensures devices show up even if socket events didn't fire properly
        if (!notifiedPeersRef.current.has(peerId)) {
          notifiedPeersRef.current.add(peerId)
          // Get device name from stored peer info if available
          const storedDeviceName = peerDeviceNamesRef.current.get(peerId)
          callbacksRef.current.onPeerConnected?.(peerId, storedDeviceName)
        }
      })

      peer.on('data', (data) => {
        try {
          const senderName = peerDeviceNamesRef.current.get(peerId) || 'Unknown'
          
          // Check if data is binary - simple-peer may return Buffer, Uint8Array, or ArrayBuffer
          let arrayBuffer: ArrayBuffer | null = null
          
          if (data instanceof ArrayBuffer) {
            arrayBuffer = data
          } else if (data instanceof Uint8Array) {
            // Convert Uint8Array to ArrayBuffer
            // Always create a new ArrayBuffer to avoid SharedArrayBuffer issues
            arrayBuffer = new ArrayBuffer(data.length)
            const view = new Uint8Array(arrayBuffer)
            view.set(data)
          } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
            // Convert Node.js Buffer to ArrayBuffer
            arrayBuffer = new ArrayBuffer(data.length)
            const view = new Uint8Array(arrayBuffer)
            for (let i = 0; i < data.length; i++) {
              view[i] = data[i]
            }
          }
          
          // Check if the data looks like JSON
          // This handles the case where simple-peer sends JSON as Uint8Array/Buffer
          let isJson = false
          let jsonString: string | null = null
          
          if (arrayBuffer) {
            // For binary data, check if it's actually JSON by:
            // 1. Checking if size is reasonable for JSON (< 1MB)
            // 2. Checking first few bytes for JSON structure
            // 3. Attempting to decode and validate
            const uint8Array = new Uint8Array(arrayBuffer)
            const firstByte = uint8Array[0]
            
            // Only treat as JSON if it starts with { or [ AND is small enough to be JSON
            if ((firstByte === 123 || firstByte === 91) && arrayBuffer.byteLength < 1024 * 1024) {
              // Try to decode and validate
              try {
                jsonString = new TextDecoder().decode(uint8Array)
                // Validate it's actually JSON by checking it parses
                JSON.parse(jsonString)
                isJson = true
              } catch {
                // Not valid JSON, treat as binary
                isJson = false
              }
            }
          } else {
            // Already a string - check if it's JSON
            const dataString = data.toString()
            const trimmed = dataString.trim()
            if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length < 1024 * 1024) {
              try {
                JSON.parse(trimmed)
                jsonString = trimmed
                isJson = true
              } catch {
                // Not valid JSON
                isJson = false
              }
            }
          }
          
          if (isJson && jsonString) {
            // String data - parse as JSON
            try {
              const parsed = JSON.parse(jsonString)
              callbacksRef.current.onDataReceived?.(parsed, senderName)
            } catch (parseError) {
              console.error(`Failed to parse JSON from peer ${peerId}:`, parseError)
            }
          } else if (arrayBuffer) {
            // Binary data - pass ArrayBuffer
            callbacksRef.current.onDataReceived?.(arrayBuffer, senderName)
          }
        } catch (e) {
          console.error(`Error processing data from peer ${peerId}:`, e)
        }
      })

      peer.on('error', (error) => {
        console.error(`❌ WebRTC peer ${peerId} error:`, error)
      })

      peer.on('close', () => {
          setConnectedPeers(prev => {
            const next = new Set(prev)
            next.delete(peerId)
            connectedPeersRef.current = next
            return next
          })
          peersRef.current.delete(peerId)
          notifiedPeersRef.current.delete(peerId) // Remove from notified set when peer disconnects
          peerDeviceNamesRef.current.delete(peerId) // Remove device name when peer disconnects
          callbacksRef.current.onPeerDisconnected?.(peerId)
      })
    } catch (error) {
      console.error(`❌ Error creating peer ${peerId}:`, error)
    }
  }, [])

  // Initialize Socket.io connection - always connect to listen for room-join-request
  useEffect(() => {
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
          if (!mounted || !socketInstance) return
          setIsConnected(true)
          setSocket(socketInstance)
          socketRef.current = socketInstance

          // Subscribe to device notifications for auto-reconnect
          // Get recent devices from localStorage and subscribe to them
          try {
            const { getPairingHistory } = require('../utils/pairingHistory')
            const recentDevices = getPairingHistory()
            const deviceNames = recentDevices
              .map((device: { deviceName: string }) => device.deviceName)
              .filter((name: string) => name !== deviceNameRef.current)
            
            if (deviceNames.length > 0 && socketInstance) {
              socketInstance.emit('subscribe-devices', deviceNames)
            }
          } catch (error) {
            // Silently handle if pairingHistory is not available
          }

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

        // Listen for room-join-request events (for auto-reconnect from recent devices)
        // This event is handled in App.tsx, we just need the socket connected to receive it
        socketInstance.on('room-join-request', () => {
          // Event is handled in App.tsx
        })

        socketInstance.on('connect_error', () => {
          // Silently handle connection errors - socket.io will retry automatically
          // Don't log to avoid console spam
        })

        socketInstance.on('disconnect', () => {
          if (!mounted) return
          setIsConnected(false)
        })

        // Handle peer list - only called when we first join a room
        socketInstance.on('peers', (peersData: Array<{ peerId: string, deviceName?: string }> | string[]) => {
          if (!mounted) return
          
          // Handle both old format (string[]) and new format (Array<{peerId, deviceName}>)
          const peerIds = Array.isArray(peersData) && peersData.length > 0 && typeof peersData[0] === 'string'
            ? peersData as string[]
            : (peersData as Array<{ peerId: string, deviceName?: string }>).map(p => p.peerId)
          
          setPeers(peerIds)
          
          // Create WebRTC connections to existing peers and notify with device names
          if (Array.isArray(peersData) && peersData.length > 0 && typeof peersData[0] !== 'string') {
            const peersWithInfo = peersData as Array<{ peerId: string, deviceName?: string }>
            peersWithInfo.forEach(({ peerId, deviceName }) => {
              // Create peer connection if needed
              if (!peersRef.current.has(peerId)) {
                createPeer(peerId, true)
              }
              
              // Store device name for later use
              if (deviceName) {
                peerDeviceNamesRef.current.set(peerId, deviceName)
              }
              
              // Notify with device name - STRICT: check and add atomically, then notify synchronously
              if (deviceName && !notifiedPeersRef.current.has(peerId)) {
                notifiedPeersRef.current.add(peerId)
                // Call immediately - the callback itself has duplicate protection
                callbacksRef.current.onPeerConnected?.(peerId, deviceName)
              } else if (!deviceName && !notifiedPeersRef.current.has(peerId)) {
                // Even without device name, notify about the peer so it shows up
                notifiedPeersRef.current.add(peerId)
                callbacksRef.current.onPeerConnected?.(peerId)
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
          
          // STRICT: Skip if we've already notified about this peer (prevents duplicates)
          if (notifiedPeersRef.current.has(peerId)) {
            return // Already processed this peer, skip completely
          }
          
          setPeers(prev => {
            if (prev.includes(peerId)) return prev
            return [...prev, peerId]
          })
          
          if (!peersRef.current.has(peerId)) {
            createPeer(peerId, false)
          }
          
          // Store device name for later use
          if (deviceName) {
            peerDeviceNamesRef.current.set(peerId, deviceName)
          }
          
          // Notify with device name if provided - only if we haven't notified about this peer yet
          if (deviceName && !notifiedPeersRef.current.has(peerId)) {
            // Check and add atomically
            notifiedPeersRef.current.add(peerId)
            // Call immediately - the callback itself has duplicate protection
            callbacksRef.current.onPeerConnected?.(peerId, deviceName)
          } else if (!deviceName && !notifiedPeersRef.current.has(peerId)) {
            // Even without device name, notify about the peer so it shows up
            notifiedPeersRef.current.add(peerId)
            callbacksRef.current.onPeerConnected?.(peerId)
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
        socketInstance.on('offer', async ({ offer, from, deviceName: peerDeviceName }: { offer: RTCSessionDescriptionInit; from: string; deviceName?: string }) => {
          if (!mounted) return
          const peer = peersRef.current.get(from)
          if (peer) {
            try {
              await peer.signal(offer)
              // Store device name for later use
              if (peerDeviceName) {
                peerDeviceNamesRef.current.set(from, peerDeviceName)
              }
              // If we receive an offer, it means a new peer is trying to connect,
              // so we should also notify about them if we haven't already
              if (peerDeviceName && !notifiedPeersRef.current.has(from)) {
                notifiedPeersRef.current.add(from)
                callbacksRef.current.onPeerConnected?.(from, peerDeviceName)
              }
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

    // Connect with a small delay to ensure React has finished rendering
    // This prevents WebSocket connection errors on initial load
    const timer = setTimeout(() => {
      initSocket()
    }, 100)
    
    return () => {
      mounted = false
      clearTimeout(timer)
      listenersRegisteredRef.current = false // Reset flag on cleanup
      
      // Clean up peers gracefully
      peersRef.current.forEach((peer, peerId) => {
        try {
          // Only destroy if not already destroyed
          if (!peer.destroyed) {
            peer.destroy()
          }
        } catch (error) {
          // Silently handle errors during cleanup
        }
        peersRef.current.delete(peerId)
      })
      
      if (socketInstance) {
        // Remove all event listeners before closing to prevent duplicate handlers
        socketInstance.removeAllListeners()
        socketInstance.close()
      }
      
      peersRef.current.clear()
      notifiedPeersRef.current.clear()
      peerDeviceNamesRef.current.clear()
      setConnectedPeers(new Set())
      connectedPeersRef.current = new Set()
    }
  }, [createPeer]) // Always connect, not just when roomId is provided

  // Join room when roomId changes - with cleanup of old peers
  useEffect(() => {
    if (!roomId) {
      // Clean up all peers when leaving a room
      peersRef.current.forEach((peer, peerId) => {
        try {
          if (!peer.destroyed) {
            peer.destroy()
          }
        } catch (error) {
          // Silently handle errors
        }
        peersRef.current.delete(peerId)
      })
      notifiedPeersRef.current.clear()
      peerDeviceNamesRef.current.clear()
      setConnectedPeers(new Set())
      connectedPeersRef.current = new Set()
      setPeers([])
      return
    }
    
    if (socketRef.current?.connected && roomId) {
      // Clear old peers before joining new room
      peersRef.current.forEach((peer, peerId) => {
        try {
          if (!peer.destroyed) {
            peer.destroy()
          }
        } catch (error) {
          // Silently handle errors
        }
        peersRef.current.delete(peerId)
      })
      notifiedPeersRef.current.clear()
      peerDeviceNamesRef.current.clear()
      setConnectedPeers(new Set())
      connectedPeersRef.current = new Set()
      
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

  // Send data to a peer (supports both JSON objects and ArrayBuffer for binary data)
  const sendData = useCallback((peerId: string, data: any) => {
    const peer = peersRef.current.get(peerId)
    const isConnected = connectedPeersRef.current.has(peerId)
    
    // Check if peer exists and is connected
    if (peer && isConnected) {
      try {
        // If data is ArrayBuffer, send directly (for file chunks)
        if (data instanceof ArrayBuffer) {
          peer.send(data)
          return true
        }
        // Otherwise, stringify JSON data (for text messages and metadata)
        const dataString = JSON.stringify(data)
        peer.send(dataString)
        return true
      } catch (error) {
        console.error(`Error sending data to peer ${peerId}:`, error)
        return false
      }
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
