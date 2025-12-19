import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { generateRoomCode, isValidRoomCode } from '../utils/roomCode'

interface PairingModalProps {
  isOpen: boolean
  onClose: () => void
  onRoomJoin: (roomId: string) => void
  deviceName: string
}

export function PairingModal({ isOpen, onClose, onRoomJoin, deviceName }: PairingModalProps) {
  const [myCode, setMyCode] = useState('')
  const [enteredCode, setEnteredCode] = useState('')
  const [error, setError] = useState('')
  const hasJoinedRef = useRef(false)
  const onRoomJoinRef = useRef(onRoomJoin)

  // Update ref when callback changes
  useEffect(() => {
    onRoomJoinRef.current = onRoomJoin
  }, [onRoomJoin])

  useEffect(() => {
    if (isOpen) {
      // Generate code when modal opens
      if (!myCode) {
        const code = generateRoomCode()
        setMyCode(code)
      }
      // Join with own code when generated
      if (myCode && !hasJoinedRef.current) {
        hasJoinedRef.current = true
        onRoomJoinRef.current(myCode)
      }
    } else {
      // Reset when modal closes
      setEnteredCode('')
      setError('')
      setMyCode('')
      hasJoinedRef.current = false
    }
  }, [isOpen, myCode])

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

    // Clear error and join - don't clear enteredCode yet, let it stay visible
    setError('')
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

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-500 text-center"
              >
                {error}
              </motion.p>
            )}

            <motion.button
              onClick={() => handleJoinRoom()}
              className="bg-[var(--accent-primary)] border-[1.5px] border-[var(--accent-primary)] rounded-xl px-7 py-3.5 text-[var(--bg-primary)] font-medium text-[0.9375rem] font-['Biryani'] transition-all duration-300 cursor-pointer w-full shadow-[var(--shadow-sm)] hover:bg-[var(--accent-dark)] hover:border-[var(--accent-dark)] hover:shadow-[var(--shadow-md)] active:shadow-[var(--shadow-sm)] disabled:opacity-50 disabled:cursor-not-allowed w-full"
              whileHover={{ y: -2 }}
              whileTap={{ y: 0 }}
              disabled={!enteredCode || enteredCode.length !== 6}
            >
              <span>Connect</span>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
