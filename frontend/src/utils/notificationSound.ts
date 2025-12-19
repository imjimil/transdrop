// Professional notification chime sound using Web Audio API

// Singleton AudioContext that persists across calls
let audioContext: AudioContext | null = null
let isInitialized = false

// Initialize AudioContext (will be created on first user interaction)
function getAudioContext(): AudioContext | null {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      return null
    }
  }
  return audioContext
}

// Initialize AudioContext on first user interaction
export function initializeAudioContext() {
  if (isInitialized) return
  isInitialized = true
  
  const ctx = getAudioContext()
  if (!ctx) return
  
  // Resume if suspended (this will work after user interaction)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      // Silently fail if resume fails
    })
  }
}

// Resume AudioContext if suspended (required after user gesture)
async function resumeAudioContext(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
      return true
    } catch (error) {
      return false
    }
  }
  return ctx.state === 'running'
}

export async function playNotificationSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  
  // Resume if suspended (this will work after first user interaction)
  const resumed = await resumeAudioContext(ctx)
  if (!resumed) return
  
  try {
    // Create a pleasant, professional chime using multiple oscillators
    const duration = 0.3
    const frequencies = [523.25, 659.25, 783.99] // C5, E5, G5 - a pleasant major chord
    
    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      oscillator.frequency.value = freq
      oscillator.type = 'sine' // Smooth sine wave for a professional sound
      
      // Envelope: quick attack, gentle decay
      const now = ctx.currentTime
      const delay = index * 0.05 // Slight stagger for a more musical sound
      
      gainNode.gain.setValueAtTime(0, now + delay)
      gainNode.gain.linearRampToValueAtTime(0.15, now + delay + 0.01) // Quick attack
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + delay + duration) // Gentle decay
      
      oscillator.start(now + delay)
      oscillator.stop(now + delay + duration)
    })
  } catch (error) {
    // Silently fail if audio context is not available
  }
}

