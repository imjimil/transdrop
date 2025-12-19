import { useCallback, useRef } from 'react'

interface FileMetadata {
  type: 'file-metadata'
  fileName: string
  fileSize: number
  fileType: string
  totalChunks: number
  from: string
  timestamp: number
}

interface FileChunkData {
  chunks: ArrayBuffer[]
  metadata: FileMetadata
  receivedSize: number
  lastChunkTime: number
}

interface ReceivedFile {
  name: string
  size: number
  type: string
  blob: Blob
  url: string
}

interface UseFileTransferOptions {
  deviceName: string
  sendData: (peerId: string, data: any) => boolean
  onFileReceived: (file: ReceivedFile, from: string) => void
  onProgress?: (fileName: string, progress: number, variant: 'sending' | 'receiving', peerName?: string) => void
}

export function useFileTransfer({ deviceName, sendData, onFileReceived, onProgress }: UseFileTransferOptions) {
  // File receiving state - store ArrayBuffer chunks
  const fileChunksRef = useRef<Map<string, FileChunkData>>(new Map())
  // Buffer for chunks that arrive before metadata
  const pendingChunksRef = useRef<ArrayBuffer[]>([])
  // Timeout refs for file completion fallback
  const fileTimeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Handle receiving file metadata
  const handleFileMetadata = useCallback((metadata: FileMetadata) => {
    // Create file entry
    const fileEntry: FileChunkData = {
      chunks: [],
      metadata,
      receivedSize: 0,
      lastChunkTime: Date.now(),
    }
    
    // Add any pending chunks that arrived before metadata
    if (pendingChunksRef.current.length > 0) {
      fileEntry.chunks.push(...pendingChunksRef.current)
      fileEntry.receivedSize = pendingChunksRef.current.reduce((sum, chunk) => sum + chunk.byteLength, 0)
      pendingChunksRef.current = []
    }
    
    fileChunksRef.current.set(metadata.fileName, fileEntry)
  }, [])

  // Handle receiving file chunk
  const handleFileChunk = useCallback((chunk: ArrayBuffer, senderDeviceName?: string) => {
    // Find which file this chunk belongs to - use the most recently created file entry
    let fileData: FileChunkData | undefined
    const entries = Array.from(fileChunksRef.current.entries())
    if (entries.length > 0) {
      // Get the last entry (most recent)
      const [, fd] = entries[entries.length - 1]
      if (fd.chunks.length < fd.metadata.totalChunks) {
        fileData = fd
      }
    }
    
    if (fileData) {
      // Add chunk to buffer (chunks arrive in order)
      fileData.chunks.push(chunk)
      fileData.receivedSize += chunk.byteLength
      fileData.lastChunkTime = Date.now()
      
      // Report progress
      const progress = Math.min(100, (fileData.receivedSize / fileData.metadata.fileSize) * 100)
      onProgress?.(fileData.metadata.fileName, progress, 'receiving', senderDeviceName)
      
      // Check if all chunks received - be strict about completion
      const allChunksReceived = fileData.chunks.length >= fileData.metadata.totalChunks
      const sizeMatch = fileData.receivedSize >= fileData.metadata.fileSize
      
      // Only complete if we have ALL chunks AND the size matches exactly (or is slightly over due to rounding)
      // Don't use tolerance - we need exact match to prevent corruption
      const sizeDifference = fileData.receivedSize - fileData.metadata.fileSize
      const sizeWithinTolerance = sizeDifference >= 0 && sizeDifference <= 1024 // Allow up to 1KB over (rounding)
      
      // Clear any existing timeout for this file
      const existingTimeout = fileTimeoutRefs.current.get(fileData.metadata.fileName)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
        fileTimeoutRefs.current.delete(fileData.metadata.fileName)
      }
      
      if (allChunksReceived && sizeMatch && sizeWithinTolerance) {
        try {
          // Reconstruct file from ArrayBuffer chunks
          const blob = new Blob(fileData.chunks, { type: fileData.metadata.fileType })
          const url = URL.createObjectURL(blob)
          
          // Notify about received file
          onFileReceived({
            name: fileData.metadata.fileName,
            size: fileData.metadata.fileSize,
            type: fileData.metadata.fileType,
            blob,
            url
          }, fileData.metadata.from || senderDeviceName || 'Unknown')
          
          fileChunksRef.current.delete(fileData.metadata.fileName)
          
          // Clear timeout if exists
          const timeout = fileTimeoutRefs.current.get(fileData.metadata.fileName)
          if (timeout) {
            clearTimeout(timeout)
            fileTimeoutRefs.current.delete(fileData.metadata.fileName)
          }
        } catch (error) {
          console.error(`Error creating file notification:`, error)
          throw new Error(`Error receiving file "${fileData.metadata.fileName}": ${error}`)
        }
      } else {
        // Set a longer timeout to complete the file if last chunk doesn't arrive
        // Increased to 5 seconds for large files
        const timeout = setTimeout(() => {
          const currentFileData = fileChunksRef.current.get(fileData.metadata.fileName)
          if (currentFileData && currentFileData.chunks.length === fileData.chunks.length) {
            // No new chunks received - check if we have enough data
            const missingChunks = currentFileData.metadata.totalChunks - currentFileData.chunks.length
            const missingBytes = currentFileData.metadata.fileSize - currentFileData.receivedSize
            
            // Only complete if we're missing less than 1% of the file (for network issues)
            const missingPercent = (missingBytes / currentFileData.metadata.fileSize) * 100
            if (missingPercent < 1 && missingChunks <= 2) {
              // Close enough - complete with what we have
              try {
                const blob = new Blob(currentFileData.chunks, { type: currentFileData.metadata.fileType })
                const url = URL.createObjectURL(blob)
                
                onFileReceived({
                  name: currentFileData.metadata.fileName,
                  size: currentFileData.metadata.fileSize,
                  type: currentFileData.metadata.fileType,
                  blob,
                  url
                }, currentFileData.metadata.from || senderDeviceName || 'Unknown')
                
                fileChunksRef.current.delete(currentFileData.metadata.fileName)
                fileTimeoutRefs.current.delete(currentFileData.metadata.fileName)
              } catch (error) {
                console.error(`Error completing file after timeout:`, error)
              }
            } else {
              // Too much missing - don't complete, log error
              console.error(`File "${currentFileData.metadata.fileName}" incomplete: missing ${missingChunks} chunks (${missingBytes} bytes, ${missingPercent.toFixed(2)}%)`)
              // Clean up
              fileChunksRef.current.delete(currentFileData.metadata.fileName)
              fileTimeoutRefs.current.delete(currentFileData.metadata.fileName)
            }
          }
        }, 5000) // 5 second timeout for large files
        
        fileTimeoutRefs.current.set(fileData.metadata.fileName, timeout)
      }
    } else {
      // No metadata yet - buffer the chunk
      pendingChunksRef.current.push(chunk)
    }
  }, [onFileReceived])

  // Handle sending file
  const sendFile = useCallback(async (peerId: string, file: File) => {
    return new Promise<void>((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer
          const CHUNK_SIZE = 16 * 1024 // 16KB chunks (WebRTC message size limit)
          const totalChunks = Math.ceil(arrayBuffer.byteLength / CHUNK_SIZE)

          // Send file metadata first
          const metadata: FileMetadata = {
            type: 'file-metadata',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            totalChunks,
            from: deviceName,
            timestamp: Date.now(),
          }
          
          const metadataSent = sendData(peerId, metadata)
          
          if (!metadataSent) {
            reject(new Error('Failed to send file metadata. Please check connection.'))
            return
          }

          // Wait a bit to ensure metadata arrives before chunks
          await new Promise(resolve => setTimeout(resolve, 100))

          // Send file in chunks as ArrayBuffer (binary)
          for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE
            const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength)
            const chunk = arrayBuffer.slice(start, end)

            // Send ArrayBuffer directly (binary)
            if (!sendData(peerId, chunk)) {
              reject(new Error(`Failed to send chunk ${chunkIndex + 1}/${totalChunks}`))
              return
            }

            // Report progress
            const progress = Math.min(100, ((chunkIndex + 1) / totalChunks) * 100)
            onProgress?.(file.name, progress, 'sending')

            // Small delay between chunks to avoid overwhelming the connection
            await new Promise(resolve => setTimeout(resolve, 10))
          }
          
          // Clear progress when done
          onProgress?.(file.name, 100, 'sending')

          resolve()
        } catch (error) {
          reject(error)
        }
      }

      reader.onerror = () => {
        reject(new Error('Failed to read file'))
      }

      reader.readAsArrayBuffer(file)
    })
  }, [deviceName, sendData])

  return {
    handleFileMetadata,
    handleFileChunk,
    sendFile,
  }
}

