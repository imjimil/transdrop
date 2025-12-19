import { motion } from 'framer-motion'
import { X, Upload, Download } from 'lucide-react'

interface FileProgressNotificationProps {
  fileName: string
  progress: number
  variant: 'sending' | 'receiving'
  from?: string
  onClose?: () => void
}

export function FileProgressNotification({ fileName, progress, variant, from, onClose }: FileProgressNotificationProps) {
  const isSending = variant === 'sending'
  const Icon = isSending ? Upload : Download

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-50 max-w-md w-[calc(100%-2rem)] sm:w-full mx-auto sm:mx-0 p-4 sm:p-0"
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-primary)] rounded-[1.25rem] shadow-[var(--shadow-md)] transition-all duration-300 p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-xs opacity-70 text-[var(--text-primary)] font-['Biryani'] mb-1">
              {isSending ? 'Sending file' : 'Receiving file'}
            </p>
            <p className="text-lg font-semibold text-[var(--text-primary)] font-['Biryani'] truncate break-words overflow-hidden" title={fileName}>
              {fileName}
            </p>
            {from && !isSending && (
              <p className="text-xs opacity-60 text-[var(--text-primary)] font-['Biryani'] mt-1 truncate">
                from {from}
              </p>
            )}
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon size={16} className="text-[var(--accent-primary)]" />
              <span className="text-sm font-medium text-[var(--text-primary)] font-['Biryani']">
                {Math.round(progress)}%
              </span>
            </div>
          </div>
          <div className="w-full h-2 bg-[var(--bg-secondary)] border-[1px] border-[var(--border-secondary)] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[var(--accent-primary)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

