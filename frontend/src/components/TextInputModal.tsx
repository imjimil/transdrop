import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'

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
          className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-primary)] rounded-[1.25rem] shadow-[var(--shadow-md)] transition-all duration-300 p-6 max-w-md w-full relative z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <h2 className="text-xl text-[var(--text-primary)] font-normal font-['Bebas_Neue'] tracking-[0.05em] transition-all duration-300 uppercase drop-shadow-[0_2px_8px_rgba(11,46,51,0.1)] mb-2">
                Send text to {recipientName}
              </h2>
              <p className="text-xs opacity-70 text-[var(--text-primary)] font-['Biryani'] mb-4">
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
                  className="mb-4"
                >
                  <Check size={48} className="text-[var(--accent-primary)]" strokeWidth={3} />
                </motion.div>
                <p 
                  className="text-xl font-semibold text-[var(--text-primary)] font-['Biryani']"
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
                  className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-secondary)] rounded-xl px-5 py-3.5 text-[var(--text-primary)] font-['Biryani'] transition-all duration-300 w-full min-h-[120px] resize-none mb-4 shadow-[var(--shadow-sm)] focus:outline-none focus:border-[var(--accent-primary)] focus:shadow-[var(--shadow-md)] focus:-translate-y-[1px] disabled:opacity-50"
                  disabled={isSending}
                />

                <div className="flex items-center gap-3">
                  <motion.button
                    type="button"
                    onClick={handleClose}
                    className="bg-[var(--bg-secondary)] border-[1.5px] border-[var(--border-secondary)] rounded-xl px-7 py-3.5 text-[var(--text-primary)] font-medium text-[0.9375rem] font-['Biryani'] transition-all duration-300 cursor-pointer shadow-[var(--shadow-sm)] hover:bg-[var(--accent-secondary)] hover:border-[var(--accent-secondary)] hover:text-[var(--bg-primary)] hover:shadow-[var(--shadow-md)] active:shadow-[var(--shadow-sm)] flex-1"
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
                    className="bg-[var(--accent-primary)] border-[1.5px] border-[var(--accent-primary)] rounded-xl px-7 py-3.5 text-[var(--bg-primary)] font-medium text-[0.9375rem] font-['Biryani'] transition-all duration-300 cursor-pointer shadow-[var(--shadow-sm)] hover:bg-[var(--accent-dark)] hover:border-[var(--accent-dark)] hover:shadow-[var(--shadow-md)] active:shadow-[var(--shadow-sm)] flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
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

