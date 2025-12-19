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
        // Notify about peer connection if we haven't already
        // This ensures devices show up even if socket events didn't fire properly
        if (!notifiedPeersRef.current.has(peerId)) {
          console.log(`📢 Notifying about peer ${peerId} from WebRTC connect event`)
          notifiedPeersRef.current.add(peerId)
          // Get device name from stored peer info if available
          const storedDeviceName = peerDeviceNamesRef.current.get(peerId)
          callbacksRef.current.onPeerConnected?.(peerId, storedDeviceName)
        }
      })

      peer.on('data', (data) => {
        try {
          const senderName = peerDeviceNamesRef.current.get(peerId) || 'Unknown'
          
          const dataLength = data instanceof ArrayBuffer ? data.byteLength : 
                            data instanceof Uint8Array ? data.length :
                            (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) ? data.length :
                            typeof data === 'string' ? data.length : 'unknown'
          
          console.log(`📥 [RECEIVER] Data received from ${peerId}:`, {
            dataType: typeof data,
            isArrayBuffer: data instanceof ArrayBuffer,
            isUint8Array: data instanceof Uint8Array,
            isBuffer: typeof Buffer !== 'undefined' && Buffer.isBuffer(data),
            dataLength: dataLength,
            firstBytes: data instanceof ArrayBuffer 
              ? Array.from(new Uint8Array(data.slice(0, Math.min(50, data.byteLength)))).join(',')
              : data instanceof Uint8Array
              ? Array.from(data.slice(0, Math.min(50, data.length))).join(',')
              : data.toString().substring(0, 100)
          })
          
          // Check if data is binary - simple-peer may return Buffer, Uint8Array, or ArrayBuffer
          let arrayBuffer: ArrayBuffer | null = null
          
          if (data instanceof ArrayBuffer) {
            console.log(`📥 [RECEIVER] Detected ArrayBuffer (${data.byteLength} bytes)`)
            arrayBuffer = data
          } else if (data instanceof Uint8Array) {
            console.log(`📥 [RECEIVER] Detected Uint8Array (${data.length} bytes)`)
            // Convert Uint8Array to ArrayBuffer
            // Always create a new ArrayBuffer to avoid SharedArrayBuffer issues
            arrayBuffer = new ArrayBuffer(data.length)
            const view = new Uint8Array(arrayBuffer)
            view.set(data)
          } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
            console.log(`📥 [RECEIVER] Detected Buffer (${data.length} bytes)`)
            // Convert Node.js Buffer to ArrayBuffer
            arrayBuffer = new ArrayBuffer(data.length)
            const view = new Uint8Array(arrayBuffer)
            for (let i = 0; i < data.length; i++) {
              view[i] = data[i]
            }
          }
          
          // Check if the data looks like JSON (starts with { or [)
          // This handles the case where simple-peer sends JSON as Uint8Array/Buffer
          let isJson = false
          let jsonString: string | null = null
          
          if (arrayBuffer) {
            // Check first byte to see if it's JSON
            const firstByte = new Uint8Array(arrayBuffer)[0]
            if (firstByte === 123 || firstByte === 91) { // { or [
              // Looks like JSON - convert to string
              const uint8Array = new Uint8Array(arrayBuffer)
              jsonString = new TextDecoder().decode(uint8Array)
              isJson = true
              console.log(`📥 [RECEIVER] Uint8Array/Buffer contains JSON! Converting to string...`)
            }
          } else {
            // Already a string
            jsonString = data.toString()
            isJson = true
          }
          
          if (isJson && jsonString) {
            // String data - parse as JSON
            console.log(`📥 [RECEIVER] Detected JSON string (${jsonString.length} chars):`, jsonString.substring(0, 200))
            try {
              const parsed = JSON.parse(jsonString)
              console.log(`📥 [RECEIVER] ✅ Successfully parsed JSON:`, parsed)
              console.log(`📥 [RECEIVER] JSON type:`, parsed.type)
              if (parsed.type === 'file-metadata') {
                console.log(`📥 [RECEIVER] 🎯 THIS IS FILE METADATA!`)
              }
              callbacksRef.current.onDataReceived?.(parsed, senderName)
            } catch (parseError) {
              console.error(`❌ [RECEIVER] Failed to parse JSON from ${peerId}:`, parseError)
              console.error(`❌ [RECEIVER] Raw data string:`, jsonString)
            }
          } else if (arrayBuffer) {
            // Binary data - pass ArrayBuffer
            console.log(`📥 [RECEIVER] Passing as binary ArrayBuffer (${arrayBuffer.byteLength} bytes)`)
            callbacksRef.current.onDataReceived?.(arrayBuffer, senderName)
          } else {
            // Fallback - try to parse as string
            const dataString = data.toString()
            console.log(`📥 [RECEIVER] Fallback: treating as string (${dataString.length} chars):`, dataString.substring(0, 200))
            try {
              const parsed = JSON.parse(dataString)
              callbacksRef.current.onDataReceived?.(parsed, senderName)
            } catch (parseError) {
              console.error(`❌ [RECEIVER] Failed to parse as JSON:`, parseError)
            }
          }
        } catch (e) {
          console.error(`❌ [RECEIVER] Error processing data from peer ${peerId}:`, e)
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
          peerDeviceNamesRef.current.delete(peerId) // Remove device name when peer disconnects
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
      peerDeviceNamesRef.current.clear()
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

  // Send data to a peer (supports both JSON objects and ArrayBuffer for binary data)
  const sendData = useCallback((peerId: string, data: any) => {
    const peer = peersRef.current.get(peerId)
    const isConnected = connectedPeersRef.current.has(peerId)
    
    console.log(`📤 [sendData] Called for peer ${peerId}:`, {
      peerExists: !!peer,
      isConnected,
      dataType: data instanceof ArrayBuffer ? 'ArrayBuffer' : typeof data,
      dataSize: data instanceof ArrayBuffer ? data.byteLength : (typeof data === 'object' ? JSON.stringify(data).length : data.length),
      isArrayBuffer: data instanceof ArrayBuffer
    })
    
    // Check if peer exists and is connected
    if (peer && isConnected) {
      try {
        // If data is ArrayBuffer, send directly (for file chunks)
        if (data instanceof ArrayBuffer) {
          console.log(`📤 [sendData] Sending ArrayBuffer (${data.byteLength} bytes) to ${peerId}`)
          peer.send(data)
          return true
        }
        // Otherwise, stringify JSON data (for text messages and metadata)
        const dataString = JSON.stringify(data)
        console.log(`📤 [sendData] Sending JSON string (${dataString.length} chars) to ${peerId}:`, dataString.substring(0, 200))
        console.log(`📤 [sendData] Full JSON:`, data)
        peer.send(dataString)
        console.log(`📤 [sendData] ✅ Sent successfully to ${peerId}`)
        return true
      } catch (error) {
        console.error(`❌ [sendData] Error sending data to peer ${peerId}:`, error)
        return false
      }
    }
    
    console.warn(`⚠️ [sendData] Cannot send - peer: ${!!peer}, connected: ${isConnected}`)
    
    // If peer exists but not connected, log the issue
    if (peer && !isConnected) {
      console.warn(`⚠️ Peer ${peerId} exists but is not connected yet.`)
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
