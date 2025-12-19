// Generate a 6-digit numeric room code
export function generateRoomCode(): string {
  // Generate a random 6-digit number (100000 to 999999)
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  return code
}

// Validate room code format (6 digits)
export function isValidRoomCode(code: string): boolean {
  // Format: 6 digits (e.g., "123456")
  return /^\d{6}$/.test(code.trim())
}

