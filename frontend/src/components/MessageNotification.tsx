import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

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
        <div className="premium-card p-6 shadow-lg">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 pr-4">
              <p className="text-xs opacity-70 theme-text mb-1">
                {isSent ? 'Message sent to' : 'Message from'}
              </p>
              <p className="text-lg font-semibold theme-text" style={{ fontFamily: 'Biryani, sans-serif' }}>
                {from}
              </p>
            </div>
            <button
              onClick={onClose}
              className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Message Content */}
          <div className="mb-4">
            <p className="text-sm theme-text leading-relaxed break-words" style={{ fontFamily: 'Biryani, sans-serif' }}>
              {messageParts}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center">
            <motion.button
              onClick={handleCopy}
              className="premium-btn premium-btn-secondary flex items-center gap-2 px-6 py-3 text-sm"
              whileHover={{ y: -1 }}
              whileTap={{ y: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {copied ? (
                <>
                  <span className="text-lg">✓</span>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <span className="text-lg">📋</span>
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

