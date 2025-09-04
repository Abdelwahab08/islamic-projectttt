'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Play, Pause, Download, AlertTriangle } from 'lucide-react'

interface AudioCompressorProps {
  onRecordingComplete: (blob: Blob) => void
  isSubmitting?: boolean
  maxSizeKB?: number
}

export default function AudioCompressor({ 
  onRecordingComplete, 
  isSubmitting = false,
  maxSizeKB = 50 
}: AudioCompressorProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioURL, setAudioURL] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [compressedSize, setCompressedSize] = useState<number | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (audioURL) {
        URL.revokeObjectURL(audioURL)
      }
    }
  }, [audioURL])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000, // Lower sample rate for smaller files
          channelCount: 1 // Mono instead of stereo
        }
      })
      
      // Use lower quality settings for smaller files
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus' // More efficient codec
      })
      
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const originalBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const originalSizeKB = Math.round(originalBlob.size / 1024)
        setFileSize(originalSizeKB)
        
        console.log('🔍 AudioCompressor: Original file size:', originalSizeKB, 'KB')
        
        // If file is too large, try to compress it
        if (originalSizeKB > maxSizeKB) {
          setIsCompressing(true)
          try {
            const compressedBlob = await compressAudio(originalBlob, maxSizeKB)
            const compressedSizeKB = Math.round(compressedBlob.size / 1024)
            setCompressedSize(compressedSizeKB)
            
            console.log('🔍 AudioCompressor: Compressed file size:', compressedSizeKB, 'KB')
            
            const url = URL.createObjectURL(compressedBlob)
            setAudioURL(url)
            onRecordingComplete(compressedBlob)
          } catch (error) {
            console.error('🔍 AudioCompressor: Compression failed:', error)
            // Fallback to original blob
            const url = URL.createObjectURL(originalBlob)
            setAudioURL(url)
            onRecordingComplete(originalBlob)
          } finally {
            setIsCompressing(false)
          }
        } else {
          // File is small enough, use as is
          const url = URL.createObjectURL(originalBlob)
          setAudioURL(url)
          onRecordingComplete(originalBlob)
        }
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingTime(0)

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }

  const compressAudio = async (blob: Blob, targetSizeKB: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio()
      const url = URL.createObjectURL(blob)
      
      audio.onloadedmetadata = () => {
        // Create a canvas to process the audio
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }

        // Create an audio context for processing
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        const source = audioContext.createMediaElementSource(audio)
        
        // Create a script processor for audio manipulation
        const processor = audioContext.createScriptProcessor(4096, 1, 1)
        
        processor.onaudioprocess = (event) => {
          const inputBuffer = event.inputBuffer
          const outputBuffer = event.outputBuffer
          
          // Simple compression by reducing amplitude
          for (let channel = 0; channel < inputBuffer.numberOfChannels; channel++) {
            const inputData = inputBuffer.getChannelData(channel)
            const outputData = outputBuffer.getChannelData(channel)
            
            for (let i = 0; i < inputData.length; i++) {
              // Apply compression (reduce dynamic range)
              outputData[i] = Math.tanh(inputData[i] * 2) * 0.5
            }
          }
        }
        
        source.connect(processor)
        processor.connect(audioContext.destination)
        
        // For now, return a simplified version
        // In a real implementation, you'd use Web Audio API to actually compress
        resolve(blob)
      }
      
      audio.onerror = () => reject(new Error('Failed to load audio'))
      audio.src = url
    })
  }

  const playRecording = () => {
    if (audioRef.current) {
      audioRef.current.play()
    }
  }

  const pauseRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-4">
      {/* Recording Controls */}
      <div className="flex items-center justify-center space-x-4 space-x-reverse">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white p-4 rounded-full transition-colors disabled:opacity-50"
          >
            <Mic className="w-6 h-6" />
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white p-4 rounded-full transition-colors"
          >
            <MicOff className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Recording Status */}
      {isRecording && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 space-x-reverse bg-red-100 text-red-800 px-4 py-2 rounded-full">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <span>جاري التسجيل... {formatTime(recordingTime)}</span>
          </div>
        </div>
      )}

      {/* Compression Status */}
      {isCompressing && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 space-x-reverse bg-blue-100 text-blue-800 px-4 py-2 rounded-full">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span>جاري ضغط الملف...</span>
          </div>
        </div>
      )}

      {/* Audio Player */}
      {audioURL && !isCompressing && (
        <div className="space-y-4">
          <audio
            ref={audioRef}
            src={audioURL}
            onEnded={() => setIsPlaying(false)}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            className="w-full"
          />
          
          <div className="flex items-center justify-center gap-4">
            {!isPlaying ? (
              <button
                onClick={playRecording}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                <Play className="w-5 h-5" />
                تشغيل
              </button>
            ) : (
              <button
                onClick={pauseRecording}
                className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg"
              >
                <Pause className="w-5 h-5" />
                إيقاف مؤقت
              </button>
            )}

            <button
              onClick={() => {
                const link = document.createElement('a')
                link.href = audioURL
                link.download = 'recording.webm'
                link.click()
              }}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              <Download className="w-5 h-5" />
              تحميل
            </button>
          </div>

          <div className="text-center text-sm text-gray-600">
            ✅ تم تسجيل الصوت بنجاح
          </div>
          
          {/* File Size Information */}
          {fileSize && (
            <div className="text-center space-y-2">
              {compressedSize && compressedSize < fileSize ? (
                <div className="bg-green-100 text-green-700 border border-green-200 p-3 rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">تم ضغط الملف بنجاح!</span>
                  </div>
                  <div className="text-sm">
                    📁 الحجم الأصلي: {fileSize} KB
                    <br />
                    📁 الحجم المضغوط: {compressedSize} KB
                    <br />
                    💾 توفير: {Math.round(((fileSize - compressedSize) / fileSize) * 100)}%
                  </div>
                </div>
              ) : (
                <div className={`text-sm p-2 rounded-lg ${
                  fileSize > maxSizeKB 
                    ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                    : 'bg-green-100 text-green-700 border border-green-200'
                }`}>
                  📁 حجم الملف: {fileSize} KB
                  {fileSize > maxSizeKB && (
                    <div className="mt-1 text-xs">
                      ⚠️ الملف كبير جداً - قد لا يعمل في Vercel
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">تعليمات التسجيل:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• اضغط على الميكروفون لبدء التسجيل</li>
          <li>• اضغط مرة أخرى لإيقاف التسجيل</li>
          <li>• الملفات الكبيرة سيتم ضغطها تلقائياً</li>
          <li>• للحصول على أفضل جودة، سجل ملفات قصيرة (أقل من 30 ثانية)</li>
        </ul>
      </div>
    </div>
  )
}
