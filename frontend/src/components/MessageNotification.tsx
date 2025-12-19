import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { X, Copy, Check, Clipboard } from 'lucide-react'

interface MessageNotificationProps {
  message: string
  from: string
  onClose: () => void
  variant?: 'received' | 'sent'
}

// Helper function to detect and convert URLs to clickable links
function linkify(text: string): (string | JSX.Element)[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts: (string | JSX.Element)[] = []
  let lastIndex = 0
  let match
  let key = 0

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index))
    }
    
    // Add clickable link
    const url = match[0]
    parts.push(
      <a
        key={key++}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    )
    
    lastIndex = match.index + url.length
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex))
  }
  
  return parts.length > 0 ? parts : [text]
}

export function MessageNotification({ message, from, onClose, variant = 'received' }: MessageNotificationProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const messageParts = linkify(message)
  const isSent = variant === 'sent'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 max-w-md w-full mx-auto sm:mx-0 p-4 sm:p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-primary)] rounded-[1.25rem] shadow-[var(--shadow-md)] transition-all duration-300 p-6 shadow-lg">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 pr-4">
              <p className="text-xs opacity-70 text-[var(--text-primary)] font-['Biryani'] mb-1">
                {isSent ? 'Message sent to' : 'Message from'}
              </p>
              <p className="text-lg font-semibold text-[var(--text-primary)] font-['Biryani']">
                {from}
              </p>
            </div>
            <button
              onClick={onClose}
              className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Message Content */}
          <div className="mb-4">
            <p className="text-sm text-[var(--text-primary)] font-['Biryani'] leading-relaxed break-words">
              {messageParts}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center">
            <motion.button
              onClick={handleCopy}
              className="bg-[var(--bg-secondary)] border-[1.5px] border-[var(--border-secondary)] rounded-xl px-6 py-3 text-[var(--text-primary)] font-medium text-sm font-['Biryani'] transition-all duration-300 cursor-pointer shadow-[var(--shadow-sm)] hover:bg-[var(--accent-secondary)] hover:border-[var(--accent-secondary)] hover:text-[var(--bg-primary)] hover:shadow-[var(--shadow-md)] active:shadow-[var(--shadow-sm)] flex items-center gap-2"
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {copied ? (
                <>
                  <Check size={18} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Clipboard size={18} />
                  <span>Copy</span>
                </>
              )}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

