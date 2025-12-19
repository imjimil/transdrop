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

// Get device name for this browser (persists across sessions)
// Using localStorage so the name persists even after browser closes
export function getStoredDeviceName(): string | null {
  if (typeof window === 'undefined') return null
  // Use localStorage instead of sessionStorage so name persists across browser sessions
  return localStorage.getItem('transdrop-device-name')
}

// Set device name for this browser (persists across sessions)
export function setStoredDeviceName(name: string): void {
  if (typeof window === 'undefined') return
  // Use localStorage instead of sessionStorage so name persists across browser sessions
  localStorage.setItem('transdrop-device-name', name)
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

