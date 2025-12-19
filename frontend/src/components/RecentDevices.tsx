import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Clock, X, Link2 } from 'lucide-react'
import { getPairingHistory, removePairing, generatePairingRoomId } from '../utils/pairingHistory'

interface RecentDevicesProps {
  currentDeviceName: string
  onConnect: (roomId: string) => void
  onRemove?: (deviceName: string) => void
}

export function RecentDevices({ currentDeviceName, onConnect, onRemove }: RecentDevicesProps) {
  const [recentDevices, setRecentDevices] = useState(() => {
    const allDevices = getPairingHistory()
    // Filter out the current device name - a device shouldn't show itself in recent connections
    return allDevices.filter(device => device.deviceName !== currentDeviceName)
  })

  // Update when currentDeviceName changes
  useEffect(() => {
    const allDevices = getPairingHistory()
    setRecentDevices(allDevices.filter(device => device.deviceName !== currentDeviceName))
  }, [currentDeviceName])

  if (recentDevices.length === 0) {
    return null
  }

  const handleConnect = (deviceName: string) => {
    const roomId = generatePairingRoomId(currentDeviceName, deviceName)
    onConnect(roomId)
  }

  const handleRemove = (deviceName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    removePairing(deviceName)
    // Update state immediately to reflect the removal
    setRecentDevices(prev => prev.filter(device => device.deviceName !== deviceName))
    onRemove?.(deviceName)
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <div className="flex items-center gap-2 mb-3">
        <Clock size={16} className="text-[var(--text-primary)] opacity-70" />
        <p className="text-sm font-medium text-[var(--text-primary)] font-['Biryani'] opacity-70">
          Recent Devices
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {recentDevices.map((device) => (
          <motion.button
            key={device.deviceName}
            onClick={() => handleConnect(device.deviceName)}
            className="group relative bg-[var(--bg-elevated)] border-[1.5px] border-[var(--border-primary)] rounded-xl px-3 py-2 text-[var(--text-primary)] font-medium text-xs font-['Biryani'] transition-all duration-300 cursor-pointer shadow-[var(--shadow-sm)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--bg-primary)] hover:shadow-[var(--shadow-md)] active:shadow-[var(--shadow-sm)] flex items-center gap-2"
            whileHover={{ y: -1 }}
            whileTap={{ y: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link2 size={14} />
            <span>{device.deviceName}</span>
            <span className="opacity-60 text-[0.65rem]">({formatTime(device.lastConnected)})</span>
            <div
              onClick={(e) => handleRemove(device.deviceName, e)}
              className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100 cursor-pointer p-0.5 rounded"
              role="button"
              tabIndex={0}
              aria-label="Remove from history"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleRemove(device.deviceName, e as any)
                }
              }}
            >
              <X size={12} />
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

