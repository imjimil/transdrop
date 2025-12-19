// Generate a random device name
const adjectives = [
  'Swift', 'Bright', 'Calm', 'Bold', 'Clear', 'Cool', 'Fast', 'Fresh',
  'Gentle', 'Grand', 'Great', 'Happy', 'Kind', 'Light', 'Lucky', 'Mighty',
  'Noble', 'Proud', 'Quick', 'Quiet', 'Sharp', 'Smart', 'Smooth', 'Strong',
  'Sweet', 'Tough', 'Wise', 'Young', 'Zest', 'Brave', 'Daring', 'Fierce'
]

const nouns = [
  'Moth', 'Eagle', 'Tiger', 'Shark', 'Wolf', 'Bear', 'Fox', 'Lion',
  'Hawk', 'Falcon', 'Raven', 'Owl', 'Deer', 'Stag', 'Dove', 'Swan',
  'Phoenix', 'Dragon', 'Griffin', 'Unicorn', 'Pegasus', 'Kraken', 'Leviathan'
]

export function generateDeviceName(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj} ${noun}`
}

// Get or create a unique tab ID (unique per browser tab/window)
function getTabId(): string {
  if (typeof window === 'undefined') return 'default'
  
  let tabId = sessionStorage.getItem('transdrop-tab-id')
  if (!tabId) {
    // Generate a unique ID for this tab
    tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('transdrop-tab-id', tabId)
  }
  return tabId
}

// Get device name for this specific tab (stored per tab)
export function getStoredDeviceName(): string | null {
  if (typeof window === 'undefined') return null
  const tabId = getTabId()
  return sessionStorage.getItem(`transdrop-device-name-${tabId}`)
}

// Set device name for this specific tab
export function setStoredDeviceName(name: string): void {
  if (typeof window === 'undefined') return
  const tabId = getTabId()
  sessionStorage.setItem(`transdrop-device-name-${tabId}`, name)
}

// Get or create a unique device name for this tab
export function getOrCreateDeviceName(): string {
  const stored = getStoredDeviceName()
  if (stored) {
    return stored
  }
  
  const newName = generateDeviceName()
  setStoredDeviceName(newName)
  return newName
}

