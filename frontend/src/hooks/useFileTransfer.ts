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
}

export function useFileTransfer({ deviceName, sendData, onFileReceived }: UseFileTransferOptions) {
  // File receiving state - store ArrayBuffer chunks
  const fileChunksRef = useRef<Map<string, FileChunkData>>(new Map())
  // Buffer for chunks that arrive before metadata
  const pendingChunksRef = useRef<ArrayBuffer[]>([])
  // Timeout refs for file completion fallback
  const fileTimeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Handle receiving file metadata
  const handleFileMetadata = useCallback((metadata: FileMetadata) => {
    console.log(`📋 ✅ RECEIVED FILE METADATA for "${metadata.fileName}" (${metadata.totalChunks} chunks, ${metadata.fileSize} bytes)`)
    
    // Create file entry
    const fileEntry: FileChunkData = {
      chunks: [],
      metadata,
      receivedSize: 0,
      lastChunkTime: Date.now(),
    }
    
    // Add any pending chunks that arrived before metadata
    if (pendingChunksRef.current.length > 0) {
      console.log(`📦 Adding ${pendingChunksRef.current.length} pending chunks to "${metadata.fileName}"`)
      fileEntry.chunks.push(...pendingChunksRef.current)
      fileEntry.receivedSize = pendingChunksRef.current.reduce((sum, chunk) => sum + chunk.byteLength, 0)
      pendingChunksRef.current = []
    }
    
    fileChunksRef.current.set(metadata.fileName, fileEntry)
    console.log(`📋 File entry created for "${metadata.fileName}". Current chunks: ${fileEntry.chunks.length}/${metadata.totalChunks}`)
  }, [])

  // Handle receiving file chunk
  const handleFileChunk = useCallback((chunk: ArrayBuffer, senderDeviceName?: string) => {
    console.log(`📦 Received binary chunk: ${chunk.byteLength} bytes`)
    
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
      const chunkNumber = fileData.chunks.length + 1
      console.log(`📥 Adding chunk ${chunkNumber}/${fileData.metadata.totalChunks} for "${fileData.metadata.fileName}"`)
      console.log(`📥 Current state: chunks=${fileData.chunks.length}, receivedSize=${fileData.receivedSize}, expectedSize=${fileData.metadata.fileSize}`)
      
      // Add chunk to buffer (chunks arrive in order)
      fileData.chunks.push(chunk)
      fileData.receivedSize += chunk.byteLength
      fileData.lastChunkTime = Date.now()
      
      console.log(`📥 After adding: chunks=${fileData.chunks.length}, receivedSize=${fileData.receivedSize}`)
      console.log(`📥 Check: chunks >= totalChunks? ${fileData.chunks.length >= fileData.metadata.totalChunks}, receivedSize >= fileSize? ${fileData.receivedSize >= fileData.metadata.fileSize}`)
      
      // Check if all chunks received
      const sizeDifference = Math.abs(fileData.receivedSize - fileData.metadata.fileSize)
      const sizeTolerance = 1024 // 1KB tolerance
      const allChunksReceived = fileData.chunks.length >= fileData.metadata.totalChunks
      const sizeMatch = fileData.receivedSize >= fileData.metadata.fileSize || sizeDifference <= sizeTolerance
      
      console.log(`📊 Completion check:`, {
        chunksReceived: fileData.chunks.length,
        totalChunks: fileData.metadata.totalChunks,
        allChunksReceived,
        receivedSize: fileData.receivedSize,
        expectedSize: fileData.metadata.fileSize,
        sizeDifference,
        sizeMatch
      })
      
      // Clear any existing timeout for this file
      const existingTimeout = fileTimeoutRefs.current.get(fileData.metadata.fileName)
      if (existingTimeout) {
        clearTimeout(existingTimeout)
        fileTimeoutRefs.current.delete(fileData.metadata.fileName)
      }
      
      if (allChunksReceived || sizeMatch) {
        console.log(`✅ All chunks received for "${fileData.metadata.fileName}" (${fileData.chunks.length} chunks, ${fileData.receivedSize} bytes, expected ${fileData.metadata.fileSize} bytes)`)
        
        try {
          // Reconstruct file from ArrayBuffer chunks
          console.log(`🔧 Creating Blob with ${fileData.chunks.length} chunks, type: ${fileData.metadata.fileType}`)
          const blob = new Blob(fileData.chunks, { type: fileData.metadata.fileType })
          console.log(`🔧 Blob created: ${blob.size} bytes, type: ${blob.type}`)
          
          const url = URL.createObjectURL(blob)
          console.log(`🔧 Blob URL created: ${url}`)
          
          // Notify about received file
          onFileReceived({
            name: fileData.metadata.fileName,
            size: fileData.metadata.fileSize,
            type: fileData.metadata.fileType,
            blob,
            url
          }, fileData.metadata.from || senderDeviceName || 'Unknown')
          
          console.log(`✅ File notification triggered!`)
          fileChunksRef.current.delete(fileData.metadata.fileName)
          
          // Clear timeout if exists
          const timeout = fileTimeoutRefs.current.get(fileData.metadata.fileName)
          if (timeout) {
            clearTimeout(timeout)
            fileTimeoutRefs.current.delete(fileData.metadata.fileName)
          }
        } catch (error) {
          console.error(`❌ Error creating file notification:`, error)
          throw new Error(`Error receiving file "${fileData.metadata.fileName}": ${error}`)
        }
      } else {
        console.log(`⏳ Still waiting for more chunks: ${fileData.chunks.length}/${fileData.metadata.totalChunks} (received ${fileData.receivedSize}/${fileData.metadata.fileSize} bytes)`)
        
        // Set a timeout to complete the file if last chunk doesn't arrive within 2 seconds
        const timeout = setTimeout(() => {
          const currentFileData = fileChunksRef.current.get(fileData.metadata.fileName)
          if (currentFileData && currentFileData.chunks.length === fileData.chunks.length) {
            // No new chunks received, complete with what we have
            const remainingBytes = fileData.metadata.fileSize - currentFileData.receivedSize
            console.warn(`⚠️ Timeout: Last chunk not received for "${fileData.metadata.fileName}". Completing with ${currentFileData.chunks.length}/${fileData.metadata.totalChunks} chunks (missing ~${remainingBytes} bytes)`)
            
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
              console.error(`❌ Error completing file after timeout:`, error)
            }
          }
        }, 2000) // 2 second timeout
        
        fileTimeoutRefs.current.set(fileData.metadata.fileName, timeout)
      }
    } else {
      // No metadata yet - buffer the chunk
      console.warn(`⚠️ Received binary chunk but no matching file metadata found. Buffering chunk.`)
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

          console.log(`📤 ===== SENDING FILE METADATA =====`)
          console.log(`📤 File: "${file.name}"`)
          console.log(`📤 Size: ${file.size} bytes`)
          console.log(`📤 Type: ${file.type}`)
          console.log(`📤 Total Chunks: ${totalChunks}`)
          console.log(`📤 From: ${deviceName}`)
          console.log(`📤 Metadata object:`, metadata)
          console.log(`📤 Metadata JSON string:`, JSON.stringify(metadata))
          console.log(`📤 Sending to peer: ${peerId}`)
          
          const metadataSent = sendData(peerId, metadata)
          console.log(`📤 Send result: ${metadataSent ? '✅ SUCCESS' : '❌ FAILED'}`)
          
          if (!metadataSent) {
            reject(new Error('Failed to send file metadata. Please check connection.'))
            return
          }

          // Wait a bit to ensure metadata arrives before chunks
          await new Promise(resolve => setTimeout(resolve, 100))

          // Send file in chunks as ArrayBuffer (binary)
          console.log(`📤 Starting to send ${totalChunks} chunks for "${file.name}"`)
          for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
            const start = chunkIndex * CHUNK_SIZE
            const end = Math.min(start + CHUNK_SIZE, arrayBuffer.byteLength)
            const chunk = arrayBuffer.slice(start, end)

            // Send ArrayBuffer directly (binary)
            if (!sendData(peerId, chunk)) {
              reject(new Error(`Failed to send chunk ${chunkIndex + 1}/${totalChunks}`))
              return
            }

            // Small delay between chunks to avoid overwhelming the connection
            await new Promise(resolve => setTimeout(resolve, 10))
          }

          console.log(`✅ File "${file.name}" sent successfully`)
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

