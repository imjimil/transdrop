import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { generateRoomCode, isValidRoomCode } from '../utils/roomCode'

interface PairingModalProps {
  isOpen: boolean
  onClose: () => void
  onRoomJoin: (roomId: string) => void
  deviceName: string
  currentRoomId?: string | null
  connectedDevicesCount?: number
}

export function PairingModal({ isOpen, onClose, onRoomJoin, deviceName, currentRoomId, connectedDevicesCount = 0 }: PairingModalProps) {
  const [myCode, setMyCode] = useState('')
  const [enteredCode, setEnteredCode] = useState('')
  const [error, setError] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionSuccess, setConnectionSuccess] = useState(false)
  const [baselineDeviceCount, setBaselineDeviceCount] = useState(0)
  const hasJoinedRef = useRef(false)
  const onRoomJoinRef = useRef(onRoomJoin)
  const wasOpenRef = useRef(false) // Track if modal was previously open

  // Update ref when callback changes
  useEffect(() => {
    onRoomJoinRef.current = onRoomJoin
  }, [onRoomJoin])

  // Track connection success - close modal when a new device connects
  useEffect(() => {
    // If we're actively connecting (user entered a code), check against baseline
    if (isConnecting) {
      // Only trigger success if device count increased while connecting
      const hasNewConnection = connectedDevicesCount > baselineDeviceCount
      
      if (hasNewConnection) {
        setConnectionSuccess(true)
        setIsConnecting(false)
        setTimeout(() => {
          onClose()
          setConnectionSuccess(false)
          setEnteredCode('')
        }, 1500)
        return
      }
    } else {
      // If not actively connecting, but modal is open and a device connects,
      // close the modal (this handles the receiving side)
      // Only close if we have at least one device connected
      if (connectedDevicesCount > 0 && baselineDeviceCount === 0) {
        // This means a device connected while modal was open (receiving side)
        setConnectionSuccess(true)
        setTimeout(() => {
          onClose()
          setConnectionSuccess(false)
          setEnteredCode('')
        }, 1500)
        return
      }
    }
  }, [connectedDevicesCount, isConnecting, baselineDeviceCount, onClose])

  // Initialize room code only once when modal first opens
  useEffect(() => {
    if (isOpen) {
      // Only reset states when modal FIRST opens (wasn't open before)
      // This prevents resetting isConnecting if we're already in the middle of connecting
      if (!wasOpenRef.current) {
        setConnectionSuccess(false)
        setError('')
        // Set baseline to current count when modal opens (for receiving side detection)
        setBaselineDeviceCount(connectedDevicesCount)
        // Don't reset isConnecting here - let it stay as is
      }
      wasOpenRef.current = true
      
      // Only generate/set myCode if we don't have one yet
      if (!myCode) {
        // If we have a current room ID, use it; otherwise generate a new one
        if (currentRoomId) {
          setMyCode(currentRoomId)
          // Re-join the room if we're reopening the modal
          if (!hasJoinedRef.current) {
            hasJoinedRef.current = true
            onRoomJoinRef.current(currentRoomId)
          }
        } else {
          // Generate new code only if we don't have one
          const code = generateRoomCode()
          setMyCode(code)
          // Join with own code when first generated
          if (!hasJoinedRef.current) {
            hasJoinedRef.current = true
            onRoomJoinRef.current(code)
          }
        }
      }
    } else {
      // Reset when modal closes
      wasOpenRef.current = false
      setEnteredCode('')
      setError('')
      setIsConnecting(false)
      setConnectionSuccess(false)
      // Keep myCode and hasJoinedRef so we can reuse the same room
    }
  }, [isOpen, currentRoomId, myCode]) // Remove isConnecting from deps to prevent resetting it

  const handleJoinRoom = (codeToJoin?: string) => {
    const code = (codeToJoin || enteredCode).trim()
    
    if (!code) {
      setError('Please enter a room code')
      return
    }

    if (code.length !== 6) {
      setError('Code must be 6 digits')
      return
    }

    if (!isValidRoomCode(code)) {
      setError('Invalid room code format')
      return
    }

    // Don't join if it's our own code (we're already in that room)
    if (code === myCode) {
      setError('This is your own code. Enter a different device\'s code.')
      return
    }

    // Clear error and set connecting state
    setError('')
    setConnectionSuccess(false)
    // Set baseline count BEFORE setting isConnecting to true
    // This ensures we only detect NEW connections that happen after this point
    setBaselineDeviceCount(connectedDevicesCount)
    setIsConnecting(true)
    onRoomJoin(code)
    // Don't clear enteredCode immediately - let user see what they entered
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-primary)] rounded-[1.25rem] shadow-[var(--shadow-md)] transition-all duration-300 p-8 max-w-md w-full relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl text-[var(--text-primary)] font-normal font-['Bebas_Neue'] tracking-[0.05em] transition-all duration-300 uppercase drop-shadow-[0_2px_8px_rgba(11,46,51,0.1)]">
                      Pair Devices
                    </h2>
            <button
              onClick={onClose}
              className="opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Codes Side by Side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Your Code */}
              <div>
                <p className="text-xs opacity-70 text-[var(--text-primary)] font-['Biryani'] mb-2 text-center">Your code:</p>
                <div className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-secondary)] rounded-xl px-5 py-3.5 text-[var(--text-primary)] font-['Biryani'] transition-all duration-300 w-full text-center text-2xl font-mono tracking-[0.2em] py-3 px-4 font-bold shadow-[var(--shadow-sm)]">
                  {myCode || '...'}
                </div>
              </div>

              {/* Enter Other Code */}
              <div>
                <p className="text-xs opacity-70 text-[var(--text-primary)] font-['Biryani'] mb-2 text-center">Enter code:</p>
                <input
                  type="text"
                  value={enteredCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setEnteredCode(value)
                    // Clear error when user types
                    if (error) {
                      setError('')
                    }
                    // Auto-join when 6 digits are entered - pass value directly to avoid state timing issues
                    if (value.length === 6 && isValidRoomCode(value)) {
                      handleJoinRoom(value)
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                  placeholder="______"
                  className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-secondary)] rounded-xl px-5 py-3.5 text-[var(--text-primary)] font-['Biryani'] transition-all duration-300 w-full text-center text-2xl font-mono tracking-[0.2em] py-3 px-4 font-bold shadow-[var(--shadow-sm)] focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[var(--shadow-md)] focus:-translate-y-[1px]"
                  maxLength={6}
                  autoFocus
                />
              </div>
            </div>

            {connectionSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="text-4xl mb-2"
                >
                  ✓
                </motion.div>
                <p className="text-lg font-semibold text-[var(--accent-primary)] font-['Biryani']">
                  Connected!
                </p>
              </motion.div>
            ) : (
              <>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm text-red-500 text-center"
                  >
                    {error}
                  </motion.p>
                )}

                {isConnecting && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-[var(--accent-primary)] text-center font-['Biryani']"
                  >
                    Connecting...
                  </motion.p>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
