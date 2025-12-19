// Pairing history management for automatic reconnection

interface PairingRecord {
  deviceName: string // The other device's name
  roomId: string // The room ID used for pairing
  lastConnected: number // Timestamp of last successful connection
  connectionCount: number // How many times we've connected
}

const STORAGE_KEY = 'transdrop-pairing-history'

// Generate a deterministic room ID from two device names
// This ensures both devices generate the same room ID
export function generatePairingRoomId(deviceName1: string, deviceName2: string): string {
  // Sort device names alphabetically to ensure consistent room ID
  const sorted = [deviceName1, deviceName2].sort()
  // Create a simple hash from the combined names
  const combined = `${sorted[0]}-${sorted[1]}`
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  // Convert to 6-digit code (same format as current room codes)
  const code = Math.abs(hash).toString().padStart(6, '0').slice(0, 6)
  return code
}

// Get all pairing records
export function getPairingHistory(): PairingRecord[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    
    const records: PairingRecord[] = JSON.parse(stored)
    // Sort by last connected (most recent first)
    return records.sort((a, b) => b.lastConnected - a.lastConnected)
  } catch (error) {
    console.error('Error reading pairing history:', error)
    return []
  }
}

// Save a pairing record
export function savePairing(deviceName: string, roomId: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const history = getPairingHistory()
    
    // Find existing record for this device
    const existingIndex = history.findIndex(record => record.deviceName === deviceName)
    
    const record: PairingRecord = {
      deviceName,
      roomId,
      lastConnected: Date.now(),
      connectionCount: existingIndex >= 0 ? history[existingIndex].connectionCount + 1 : 1
    }
    
    if (existingIndex >= 0) {
      // Update existing record
      history[existingIndex] = record
    } else {
      // Add new record
      history.push(record)
    }
    
    // Keep only last 10 pairings
    const limitedHistory = history.slice(0, 10)
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedHistory))
  } catch (error) {
    console.error('Error saving pairing:', error)
  }
}

// Get pairing record for a specific device
export function getPairingForDevice(deviceName: string): PairingRecord | null {
  const history = getPairingHistory()
  return history.find(record => record.deviceName === deviceName) || null
}

// Remove a pairing record
export function removePairing(deviceName: string): void {
  if (typeof window === 'undefined') return
  
  try {
    const history = getPairingHistory()
    const filtered = history.filter(record => record.deviceName !== deviceName)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Error removing pairing:', error)
  }
}

// Clear all pairing history
export function clearPairingHistory(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

// Get the most recent pairing (for auto-reconnect)
export function getMostRecentPairing(): PairingRecord | null {
  const history = getPairingHistory()
  return history.length > 0 ? history[0] : null
}

