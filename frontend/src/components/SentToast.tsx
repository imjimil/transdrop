import { motion, AnimatePresence } from 'framer-motion'

interface SentToastProps {
  isVisible: boolean
}

export function SentToast({ isVisible }: SentToastProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          transition={{ 
            duration: 0.4, 
            ease: [0.16, 1, 0.3, 1],
            delay: 0.1
          }}
          className="fixed top-6 right-6 z-50"
        >
          <div className="premium-card px-6 py-4 flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ 
                delay: 0.2,
                type: "spring",
                stiffness: 200,
                damping: 15
              }}
              className="text-2xl"
            >
              ✓
            </motion.div>
            <span 
              className="text-lg font-semibold theme-text"
              style={{ fontFamily: 'Biryani, sans-serif' }}
            >
              Sent!
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

