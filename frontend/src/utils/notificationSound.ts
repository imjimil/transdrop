// Professional notification chime sound using Web Audio API
export function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    
    // Create a pleasant, professional chime using multiple oscillators
    const duration = 0.3
    const frequencies = [523.25, 659.25, 783.99] // C5, E5, G5 - a pleasant major chord
    
    frequencies.forEach((freq, index) => {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = freq
      oscillator.type = 'sine' // Smooth sine wave for a professional sound
      
      // Envelope: quick attack, gentle decay
      const now = audioContext.currentTime
      const delay = index * 0.05 // Slight stagger for a more musical sound
      
      gainNode.gain.setValueAtTime(0, now + delay)
      gainNode.gain.linearRampToValueAtTime(0.15, now + delay + 0.01) // Quick attack
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + delay + duration) // Gentle decay
      
      oscillator.start(now + delay)
      oscillator.stop(now + delay + duration)
    })
  } catch (error) {
    // Fallback: silently fail if audio context is not available
    // (e.g., user hasn't interacted with the page yet)
    console.debug('Could not play notification sound:', error)
  }
}

