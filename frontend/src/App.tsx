import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Laptop, Smartphone, Tablet, Sun, Moon, Link2, User, Pencil } from 'lucide-react'
import './App.css'
import { useWebRTC } from './hooks/useWebRTC'
import { useFileTransfer } from './hooks/useFileTransfer'
import { PairingModal } from './components/PairingModal'
import { MessageNotification } from './components/MessageNotification'
import { FileProgressNotification } from './components/FileProgressNotification'
import { TextInputModal } from './components/TextInputModal'
import { getOrCreateDeviceName, setStoredDeviceName } from './utils/deviceName'
import { playNotificationSound } from './utils/notificationSound'

interface Device {
  id: string
  name: string
  type: 'phone' | 'laptop' | 'tablet'
}

function App() {
  // Initialize device name from sessionStorage or generate a new one
  const [deviceName, setDeviceName] = useState(() => getOrCreateDeviceName())
  const [isEditingName, setIsEditingName] = useState(false)
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([])
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [isPairingOpen, setIsPairingOpen] = useState(false)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null)
  const [receivedMessage, setReceivedMessage] = useState<{ text?: string; from: string; variant?: 'received' | 'sent'; file?: { name: string; size: number; type: string; blob: Blob; url: string } } | null>(null)
  const [fileProgress, setFileProgress] = useState<{ fileName: string; progress: number; variant: 'sending' | 'receiving'; to?: string; from?: string } | null>(null)
  const [textInputModal, setTextInputModal] = useState<{ isOpen: boolean; recipient: Device | null }>({ isOpen: false, recipient: null })
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768
  })

  // Track window size for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  
  // Track which peers we've processed to prevent duplicate calls
  const processedPeersRef = useRef<Set<string>>(new Set())

  // Callbacks for WebRTC - wrapped in useCallback to prevent hook order issues
  const handlePeerConnected = useCallback((peerId: string, peerDeviceName?: string) => {
    // FINAL GUARD: Skip if we've already processed this peer
    if (processedPeersRef.current.has(peerId)) {
      return // Already processed, skip
    }
    
    const deviceNameToShow = peerDeviceName || `Device ${peerId.slice(0, 6)}`
    
    // Mark as processed immediately
    processedPeersRef.current.add(peerId)
    
    setDiscoveredDevices(prev => {
      // Check if device already exists - this is the final guard against duplicates
      const existingDevice = prev.find(d => d.id === peerId)
      if (existingDevice) {
        // Update existing device name if we got one and it's different
        if (peerDeviceName && existingDevice.name !== peerDeviceName) {
          return prev.map(d => d.id === peerId ? { ...d, name: peerDeviceName } : d)
        }
        // Device already exists with same name, don't add again
        return prev
      }
      // Add new device - this should only happen once per peer
      const newDevices: Device[] = [...prev, {
        id: peerId,
        name: deviceNameToShow,
        type: 'laptop' as const
      }]
      return newDevices
    })
  }, [deviceName])

  const handlePeerDisconnected = useCallback((peerId: string) => {
    // Remove from processed set when disconnected
    processedPeersRef.current.delete(peerId)
    
    setDiscoveredDevices(prev => {
      return prev.filter(d => d.id !== peerId)
    })
  }, [deviceName])

  // File transfer hook - initialize first to get handlers
  const fileTransferRef = useRef<{ handleFileMetadata: (metadata: any) => void; handleFileChunk: (chunk: ArrayBuffer, sender?: string) => void; sendFile: (peerId: string, file: File) => Promise<void> } | null>(null)

  // Handle data received - will use file transfer handlers
  const handleDataReceived = useCallback((data: any, senderDeviceName?: string) => {
    // Check if data is binary (ArrayBuffer) - this is a file chunk
    if (data instanceof ArrayBuffer) {
      if (fileTransferRef.current) {
        fileTransferRef.current.handleFileChunk(data, senderDeviceName)
      }
      return
    }
    
    // Handle JSON data (text messages and file metadata)
    // Handle received text
    if (data.type === 'text') {
      // Play notification sound
      playNotificationSound()
      setReceivedMessage({
        text: data.text,
        from: data.from || senderDeviceName || 'Unknown',
        variant: 'received'
      })
    } 
    // Handle file metadata
    else if (data.type === 'file-metadata') {
      if (fileTransferRef.current) {
        fileTransferRef.current.handleFileMetadata(data)
      }
      // Don't play sound here - wait until file is fully received
    }
  }, [deviceName])

  // WebRTC connection
  const { joinRoom, sendData } = useWebRTC({
    roomId: currentRoomId || undefined,
    deviceName,
    onPeerConnected: handlePeerConnected,
    onPeerDisconnected: handlePeerDisconnected,
    onDataReceived: handleDataReceived,
  })

  // File transfer hook (needs sendData from useWebRTC)
  const { handleFileMetadata, handleFileChunk, sendFile } = useFileTransfer({
    deviceName,
    sendData,
    onFileReceived: (file, from) => {
      // Clear progress
      setFileProgress(null)
      
      // Play notification sound for file received
      playNotificationSound()
      
      // Show MessageNotification
      setReceivedMessage({
        from,
        variant: 'received',
        file
      })
    },
    onProgress: (fileName, progress, variant, peerName) => {
      setFileProgress({ fileName, progress, variant, ...(variant === 'sending' ? {} : { from: peerName }) })
    }
  })

  // Store file transfer handlers in ref for use in handleDataReceived
  useEffect(() => {
    fileTransferRef.current = { handleFileMetadata, handleFileChunk, sendFile }
  }, [handleFileMetadata, handleFileChunk, sendFile])

  // Don't auto-close modal - let PairingModal handle it when actively connecting
  

  // Toggle dark mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
    }
  }, [isDarkMode])

  // Handle room joining
  const handleRoomJoin = useCallback((roomId: string) => {
    // Allow joining the same room (for re-pairing) or a different room
    // Don't clear devices - we want to keep existing connections
    if (currentRoomId !== roomId) {
      setCurrentRoomId(roomId)
    }
    joinRoom(roomId)
  }, [currentRoomId, joinRoom])

  // Don't auto-add devices from peers list - let onPeerConnected handle it with device names

  // Handle opening text input modal
  const handleOpenTextInput = useCallback((device: Device) => {
    setTextInputModal({ isOpen: true, recipient: device })
  }, [])

  // Handle sending text
  const handleSendText = useCallback(async (text: string): Promise<boolean> => {
    const device = textInputModal.recipient
    if (!device || !text.trim()) {
      return false
    }
    
            const messageData = {
              type: 'text',
              text: text.trim(),
              from: deviceName,
              timestamp: Date.now(),
            }
            
            // Wait for connection to be ready (with timeout)
            let attempts = 0
            const maxAttempts = 20 // 10 seconds total
            while (attempts < maxAttempts) {
              const success = sendData(device.id, messageData)
              if (success) {
                return true
              }
              
              // Wait 500ms before retry
              await new Promise(resolve => setTimeout(resolve, 500))
              attempts++
            }
            
            console.error(`Failed to send text to ${device.name} after ${maxAttempts} attempts`)
            setReceivedMessage({
              text: `Failed to send text to ${device.name}. The connection may not be ready yet. Please try again in a moment.`,
              from: deviceName,
              variant: 'sent'
            })
            return false
  }, [sendData, deviceName, textInputModal.recipient])

  // Handle sending file
  const handleSendFile = useCallback((device: Device) => {
    // Create hidden file input
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = false
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        await sendFile(device.id, file)
        // Clear progress
        setFileProgress(null)
        setReceivedMessage({
          text: `File "${file.name}" sent to ${device.name}`,
          from: deviceName,
          variant: 'sent'
        })
      } catch (error) {
        // Clear progress on error
        setFileProgress(null)
        setReceivedMessage({
          text: error instanceof Error ? error.message : 'Failed to send file',
          from: deviceName,
          variant: 'sent'
        })
      }
    }

    input.click()
  }, [sendFile])

  // Handle device click - left click = send file, right click = send text (desktop)
  // On mobile: tap = send file, long press = send text
  const handleDeviceClick = useCallback((device: Device, event: React.MouseEvent) => {
    event.preventDefault()
    if (event.button === 2 || event.ctrlKey || event.metaKey) {
      // Right click or Ctrl/Cmd + click = send text (desktop only)
      handleOpenTextInput(device)
    } else {
      // Left click = send file
      handleSendFile(device)
    }
  }, [handleOpenTextInput, handleSendFile])

  // Track long press state
  const longPressTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  
  // Handle long press on mobile for sending text
  const handleLongPress = useCallback((device: Device) => {
    if (isMobile) {
      handleOpenTextInput(device)
    }
  }, [isMobile, handleOpenTextInput])

  const handleTouchStart = useCallback((device: Device) => {
    if (!isMobile) return
    
    const timer = setTimeout(() => {
      handleLongPress(device)
      longPressTimerRef.current.delete(device.id)
    }, 500) // 500ms for long press
    
    longPressTimerRef.current.set(device.id, timer)
  }, [isMobile, handleLongPress])

  const handleTouchEnd = useCallback((device: Device) => {
    if (!isMobile) return
    
    const timer = longPressTimerRef.current.get(device.id)
    if (timer) {
      clearTimeout(timer)
      longPressTimerRef.current.delete(device.id)
    }
  }, [isMobile])

  const handleTouchCancel = useCallback((device: Device) => {
    if (!isMobile) return
    
    const timer = longPressTimerRef.current.get(device.id)
    if (timer) {
      clearTimeout(timer)
      longPressTimerRef.current.delete(device.id)
    }
  }, [isMobile])


  return (
    <motion.div 
      className="h-screen flex flex-col relative w-full overflow-hidden bg-[var(--bg-primary)]" 
      style={{ maxWidth: '100vw' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Bar with Pair Icon */}
      <motion.div 
        className="flex items-center justify-between p-6"
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.h1
          className="text-4xl md:text-5xl text-[var(--text-primary)] font-normal font-['Bebas_Neue'] tracking-[0.05em] transition-all duration-300 uppercase drop-shadow-[0_2px_8px_rgba(11,46,51,0.1)]"
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          Trans<span className="text-[var(--accent-primary)] transition-all duration-300 inline-block">Drop</span>
        </motion.h1>
        
        <div className="flex items-center gap-4">
          <motion.button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="bg-[var(--bg-secondary)] border-[1.5px] border-[var(--border-primary)] rounded-xl p-2.5 text-[var(--text-primary)] cursor-pointer transition-all duration-300 flex items-center justify-center hover:border-[var(--accent-primary)] hover:bg-[var(--bg-elevated)] hover:shadow-[var(--shadow-md)] active:shadow-[var(--shadow-sm)]"
            aria-label="Toggle dark mode"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <AnimatePresence mode="wait">
              {isDarkMode ? (
                <motion.div
                  key="sun"
                  initial={{ opacity: 0, rotate: -90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Sun size={20} />
                </motion.div>
              ) : (
                <motion.div
                  key="moon"
                  initial={{ opacity: 0, rotate: 90 }}
                  animate={{ opacity: 1, rotate: 0 }}
                  exit={{ opacity: 0, rotate: -90 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Moon size={20} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Pair Icon with Tooltip */}
          <div className="relative group">
            <motion.button
              onClick={() => setIsPairingOpen(true)}
              className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--text-primary)] rounded-xl px-4 py-2 text-[var(--text-primary)] font-medium text-[0.9375rem] font-['Biryani'] transition-all duration-300 cursor-pointer shadow-[var(--shadow-sm)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--bg-primary)] hover:shadow-[var(--shadow-md)] active:shadow-[var(--shadow-sm)]"
              whileHover={{ y: -2 }}
              whileTap={{ y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link2 size={24} />
            </motion.button>
            {/* Tooltip */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-3 py-1.5 bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50">
              Pair devices
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-0">
                <div className="border-4 border-transparent border-b-[var(--text-primary)]"></div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        {/* Instruction Text at Top - Always Visible */}
        <motion.div 
          className="text-center mb-6 px-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="text-base sm:text-lg md:text-xl text-[var(--text-primary)] font-['Biryani'] font-medium mb-2">
            Open TransDrop on other devices to send files
          </p>
          <p className="text-xs sm:text-sm opacity-70 text-[var(--text-primary)] font-['Biryani']">
            {discoveredDevices.length > 0 ? (
              isMobile ? (
                <>Tap device to send file • Long press to send text</>
              ) : (
                <>Left click device to send file • Right click to send text</>
              )
            ) : (
              <>Click the pair icon above to connect with other devices</>
            )}
          </p>
        </motion.div>

        {/* Discovery Area - User in Center, Devices Around */}
        <motion.div
          className="relative w-full max-w-4xl h-64 sm:h-80 md:h-96 flex flex-col items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
        >
          {/* User Icon in Center with Concentric Circles */}
          <motion.div
            className="relative z-10 mb-8 sm:mb-10 md:mb-12"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Concentric Circles Background Animation - Originating from User Icon */}
            <div className="concentric-circles">
              <div className="circle-ring circle-ring-1"></div>
              <div className="circle-ring circle-ring-2"></div>
              <div className="circle-ring circle-ring-3"></div>
              <div className="circle-ring circle-ring-4"></div>
              <div className="circle-ring circle-ring-5"></div>
              <div className="circle-ring circle-ring-6"></div>
            </div>
            
            <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 flex items-center justify-center text-[var(--accent-primary)] bg-[var(--bg-elevated)] border-2 border-[var(--accent-primary)] rounded-full p-1.5 sm:p-1.75 md:p-2 shadow-[var(--shadow-md)] relative z-10">
              <User size={32} strokeWidth={2} />
            </div>
          </motion.div>

          {/* Devices Below User Icon - Clean Row Formation */}
          <AnimatePresence>
            {discoveredDevices.length > 0 ? (
              <motion.div
                className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-5 w-full max-w-[400px] sm:max-w-[500px] md:max-w-[600px]"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                {discoveredDevices.map((device, index) => {
                  // Get appropriate icon component
                  const DeviceIcon = device.type === 'phone' ? Smartphone : 
                                   device.type === 'tablet' ? Tablet : Laptop;
                  
                  return (
                    <motion.div
                      key={device.id}
                      className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--accent-primary)] rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-3.5 sm:py-3 md:px-4 md:py-3.5 text-center cursor-pointer flex flex-col items-center gap-1.5 sm:gap-2 shadow-[var(--shadow-sm)] w-[85px] sm:w-[105px] md:w-[125px] flex-shrink-0 hover:bg-[var(--accent-primary)] hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-lg)] group"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1
                      }}
                      exit={{ opacity: 0, scale: 0 }}
                      transition={{ 
                        delay: index * 0.08,
                        duration: 0.5,
                        ease: [0.16, 1, 0.3, 1]
                      }}
                      onClick={(e) => {
                        if (!isMobile) {
                          handleDeviceClick(device, e)
                        } else {
                          // On mobile, regular tap = send file
                          handleSendFile(device)
                        }
                      }}
                      onContextMenu={(e) => {
                        if (!isMobile) {
                          handleDeviceClick(device, e)
                        } else {
                          e.preventDefault() // Prevent context menu on mobile
                        }
                      }}
                      onTouchStart={() => handleTouchStart(device)}
                      onTouchEnd={() => handleTouchEnd(device)}
                      onTouchCancel={() => handleTouchCancel(device)}
                      whileHover={{ 
                        scale: 1.05,
                        transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] }
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-[var(--accent-primary)] transition-all duration-300 flex-shrink-0 group-hover:text-[var(--bg-primary)] flex items-center justify-center">
                        <DeviceIcon size={20} strokeWidth={2} className="sm:w-6 sm:h-6 md:w-7 md:h-7" />
      </div>
                      <p className="text-[0.65rem] sm:text-[0.75rem] md:text-xs font-medium text-[var(--text-primary)] transition-all duration-300 font-['Biryani'] tracking-[0.01em] break-words text-center leading-tight group-hover:text-[var(--bg-primary)] line-clamp-2">{device.name}</p>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : null}
          </AnimatePresence>

        </motion.div>
      </div>

      {/* Bottom Bar - Device Name */}
      <motion.div 
        className="flex items-center justify-center gap-2 p-6 relative z-10"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <p className="text-sm opacity-80 text-[var(--text-primary)] font-['Biryani']">You are known as:</p>
        <motion.div 
          className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-primary)] rounded-[0.625rem] px-3 py-2 inline-flex items-center gap-2 text-xs font-['Biryani'] text-[var(--text-primary)] transition-all duration-300 shadow-[var(--shadow-sm)] cursor-pointer hover:border-[var(--accent-primary)] hover:shadow-[var(--shadow-md)]"
          whileHover={{ y: -1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {isEditingName ? (
            <input
              type="text"
              value={deviceName}
              onChange={(e) => {
                const newName = e.target.value
                setDeviceName(newName)
                setStoredDeviceName(newName)
              }}
              onBlur={() => {
                setIsEditingName(false)
                setStoredDeviceName(deviceName)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingName(false)
                  setStoredDeviceName(deviceName)
                }
              }}
              className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-secondary)] rounded-xl px-5 py-3.5 text-[var(--text-primary)] font-['Biryani'] transition-all duration-300 w-full text-sm border-0 p-0 bg-transparent focus:ring-0 w-32 focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[var(--shadow-md)] focus:-translate-y-[1px]"
              autoFocus
              style={{ fontFamily: 'Biryani, sans-serif' }}
            />
          ) : (
            <>
              <span className="text-sm font-medium" style={{ fontFamily: 'Biryani, sans-serif' }}>{deviceName}</span>
                <motion.button
                  onClick={() => setIsEditingName(true)}
                  className="opacity-60 hover:opacity-100 transition-opacity ml-2"
                  aria-label="Edit device name"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Pencil size={12} strokeWidth={2} />
                </motion.button>
            </>
          )}
        </motion.div>
      </motion.div>

      {/* Pairing Modal */}
      <PairingModal
        isOpen={isPairingOpen}
        onClose={() => setIsPairingOpen(false)}
        onRoomJoin={handleRoomJoin}
        deviceName={deviceName}
        currentRoomId={currentRoomId}
        connectedDevicesCount={discoveredDevices.length}
      />

      {/* Message Notification - For both received and sent messages */}
      <AnimatePresence>
        {receivedMessage && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              if (receivedMessage.file?.url) {
                URL.revokeObjectURL(receivedMessage.file.url)
              }
              setReceivedMessage(null)
            }}
          >
            <MessageNotification
              message={receivedMessage.text}
              from={receivedMessage.from}
              onClose={() => {
                if (receivedMessage.file?.url) {
                  URL.revokeObjectURL(receivedMessage.file.url)
                }
                setReceivedMessage(null)
              }}
              variant={receivedMessage.variant || 'received'}
              file={receivedMessage.file}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Text Input Modal */}
      <TextInputModal
        isOpen={textInputModal.isOpen}
        onClose={() => setTextInputModal({ isOpen: false, recipient: null })}
        onSubmit={handleSendText}
        recipientName={textInputModal.recipient?.name || ''}
      />

      {/* File Progress Notification */}
      <AnimatePresence>
        {fileProgress && (
          <FileProgressNotification
            fileName={fileProgress.fileName}
            progress={fileProgress.progress}
            variant={fileProgress.variant}
            from={fileProgress.from}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default App
