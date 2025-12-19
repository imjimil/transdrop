import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'

interface TextInputModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (text: string) => Promise<boolean>
  recipientName: string
}

export function TextInputModal({ isOpen, onClose, onSubmit, recipientName }: TextInputModalProps) {
  const [text, setText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      // Reset states when modal opens
      setIsSending(false)
      setIsSent(false)
      setText('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (text.trim() && !isSending) {
      setIsSending(true)
      const success = await onSubmit(text.trim())
      if (success) {
        setIsSent(true)
        setIsSending(false)
        // Close after showing "Sent!" for a brief moment
        setTimeout(() => {
          setText('')
          setIsSent(false)
          onClose()
        }, 1500)
      } else {
        setIsSending(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSending && !isSent) {
      onClose()
      setText('')
    }
    // Allow Shift+Enter for new line, Enter alone submits
    if (e.key === 'Enter' && !e.shiftKey && !isSending && !isSent) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleClose = () => {
    if (!isSending && !isSent) {
      setText('')
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="premium-card p-6 max-w-md w-full relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <h2 className="text-xl premium-title mb-2">
                Send text to {recipientName}
              </h2>
              <p className="text-xs opacity-70 theme-text mb-4">
                Press Enter to send, Shift+Enter for new line, Esc to cancel
              </p>
            </div>

            {isSent ? (
              <div className="flex flex-col items-center justify-center py-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 200,
                    damping: 15
                  }}
                  className="text-4xl mb-4"
                >
                  ✓
                </motion.div>
                <p 
                  className="text-xl font-semibold theme-text"
                  style={{ fontFamily: 'Biryani, sans-serif' }}
                >
                  Sent!
                </p>
              </div>
            ) : (
              <>
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  className="premium-input w-full min-h-[120px] resize-none mb-4"
                  style={{ fontFamily: 'Biryani, sans-serif' }}
                  disabled={isSending}
                />

                <div className="flex items-center gap-3">
                  <motion.button
                    type="button"
                    onClick={handleClose}
                    className="premium-btn premium-btn-secondary flex-1"
                    whileHover={{ y: -1 }}
                    whileTap={{ y: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    disabled={isSending}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    type="submit"
                    disabled={!text.trim() || isSending}
                    className="premium-btn premium-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    whileHover={{ y: -1 }}
                    whileTap={{ y: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {isSending ? 'Sending...' : 'Send'}
                  </motion.button>
                </div>
              </>
            )}
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

