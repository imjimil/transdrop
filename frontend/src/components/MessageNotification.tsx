import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect } from 'react'
import { X, Check, Clipboard, Download } from 'lucide-react'
import React from 'react'
import { formatFileSize } from '../utils/fileSize'

interface MessageNotificationProps {
  message?: string
  from: string
  onClose: () => void
  variant?: 'received' | 'sent'
  file?: { name: string; size: number; type: string; blob: Blob; url: string }
}

// Helper function to detect and convert URLs to clickable links
function linkify(text: string): (string | React.ReactElement)[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts: (string | React.ReactElement)[] = []
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

export function MessageNotification({ message, from, onClose, variant = 'received', file }: MessageNotificationProps) {
  const [copied, setCopied] = useState(false)
  const isSent = variant === 'sent'

  // Cleanup blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (file?.url) {
        URL.revokeObjectURL(file.url)
      }
    }
  }, [file?.url])

  const handleCopy = async () => {
    if (!message) return
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleDownload = () => {
    if (!file) return
    
    try {
      // Verify blob is valid
      if (!file.blob || file.blob.size === 0) {
        console.error('Invalid blob for download:', file)
        // File data is invalid - this is handled by the parent component
        console.error('Error: File data is invalid or empty.')
        return
      }
      
      // Create a new blob URL if the existing one might be invalid
      const blobUrl = URL.createObjectURL(file.blob)
      
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = file.name
      a.style.display = 'none'
      document.body.appendChild(a)
      
      // Use setTimeout to ensure the click happens
      setTimeout(() => {
        a.click()
        // Clean up after a short delay
        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(blobUrl)
          onClose()
        }, 100)
      }, 0)
    } catch (error) {
      console.error(`Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }


  const messageParts = message ? linkify(message) : []
  const isFile = !!file

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-50 max-w-md w-[calc(100%-2rem)] sm:w-full mx-auto sm:mx-0 p-4 sm:p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-primary)] rounded-[1.25rem] shadow-[var(--shadow-md)] transition-all duration-300 p-6 shadow-lg">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 pr-4">
              <p className="text-xs opacity-70 text-[var(--text-primary)] font-['Biryani'] mb-1">
                {isSent ? (isFile ? 'File sent to' : 'Message sent to') : (isFile ? 'File from' : 'Message from')}
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
            {isFile ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[var(--bg-secondary)] border-[1.5px] border-[var(--border-secondary)] rounded-xl flex items-center justify-center">
                    <Download size={24} className="text-[var(--accent-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] font-['Biryani'] truncate">
                      {file.name}
                    </p>
                    <p className="text-xs opacity-70 text-[var(--text-primary)] font-['Biryani']">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-primary)] font-['Biryani'] leading-relaxed break-words">
                {messageParts}
              </p>
            )}
          </div>

          {/* Actions - Only show for received messages */}
          {!isSent && (
            <div className="flex items-center justify-center">
              {isFile ? (
                <motion.button
                  onClick={handleDownload}
                  className="bg-[var(--accent-primary)] border-[1.5px] border-[var(--accent-primary)] rounded-xl px-6 py-3 text-[var(--bg-primary)] font-medium text-sm font-['Biryani'] transition-all duration-300 cursor-pointer shadow-[var(--shadow-sm)] hover:bg-[var(--accent-dark)] hover:border-[var(--accent-dark)] hover:shadow-[var(--shadow-md)] active:shadow-[var(--shadow-sm)] flex items-center gap-2 w-full"
                  whileHover={{ y: -1 }}
                  whileTap={{ y: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Download size={18} />
                  <span>Download</span>
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleCopy}
                  className="bg-[var(--bg-secondary)] border-[1.5px] border-[var(--border-secondary)] rounded-xl px-6 py-3 text-[var(--text-primary)] font-medium text-sm font-['Biryani'] transition-all duration-300 cursor-pointer shadow-[var(--shadow-sm)] hover:bg-[var(--accent-secondary)] hover:border-[var(--accent-secondary)] hover:text-[var(--bg-primary)] hover:shadow-[var(--shadow-md)] active:shadow-[var(--shadow-sm)] flex items-center gap-2 w-full"
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
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

