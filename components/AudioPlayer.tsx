'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react'

interface AudioPlayerProps {
  audioUrl: string
  filename: string
  className?: string
}

export default function AudioPlayer({ audioUrl, filename, className = '' }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [audioError, setAudioError] = useState(false)
  const [processedAudioUrl, setProcessedAudioUrl] = useState(audioUrl)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  // Process audio URL for Vercel compatibility
  useEffect(() => {
    if (audioUrl.startsWith('data:')) {
      try {
        console.log('🔍 AudioPlayer: Processing base64 data URL...')
        
        // Extract the base64 data and mime type
        const [header, base64Data] = audioUrl.split(',')
        const mimeType = header.match(/data:([^;]+)/)?.[1] || 'audio/wav'
        
        console.log('🔍 AudioPlayer: MIME type:', mimeType)
        console.log('🔍 AudioPlayer: Base64 data length:', base64Data.length)
        
        // For small base64 data, create blob URL directly
        if (base64Data.length < 100000) { // 100KB limit
          // Convert base64 to binary
          const binaryString = atob(base64Data)
          const bytes = new Uint8Array(binaryString.length)
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i)
          }
          
          // Create blob and URL
          const blob = new Blob([bytes], { type: mimeType })
          const newBlobUrl = URL.createObjectURL(blob)
          
          console.log('🔍 AudioPlayer: Created blob URL:', newBlobUrl)
          console.log('🔍 AudioPlayer: Blob size:', blob.size, 'bytes')
          
          // Clean up previous blob URL
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl)
          }
          
          setBlobUrl(newBlobUrl)
          setProcessedAudioUrl(newBlobUrl)
        } else {
          console.log('🔍 AudioPlayer: Base64 data too large, using original URL')
          setProcessedAudioUrl(audioUrl)
        }
      } catch (error) {
        console.error('🔍 AudioPlayer: Error processing base64 data:', error)
        setProcessedAudioUrl(audioUrl) // Fallback to original
      }
    } else if (audioUrl.startsWith('audio_file_')) {
      // For large file references, we can't serve them in Vercel
      console.log('🔍 AudioPlayer: Large file reference, cannot serve in Vercel')
      setProcessedAudioUrl('')
    } else {
      console.log('🔍 AudioPlayer: Using non-data URL:', audioUrl)
      setProcessedAudioUrl(audioUrl)
    }
  }, [audioUrl])

  // Force audio element to reload when URL changes
  useEffect(() => {
    const audio = audioRef.current
    if (audio && processedAudioUrl) {
      console.log('🔍 AudioPlayer: Reloading audio element with new URL')
      audio.load()
    }
  }, [processedAudioUrl])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    console.log('🔍 AudioPlayer: Setting up audio element with URL:', processedAudioUrl.substring(0, 100) + '...')

    const updateTime = () => setCurrentTime(audio.currentTime)
    const updateDuration = () => {
      console.log('🔍 AudioPlayer: Duration loaded:', audio.duration)
      setDuration(audio.duration)
    }
    const handlePlay = () => {
      console.log('🔍 AudioPlayer: Audio started playing')
      setIsPlaying(true)
    }
    const handlePause = () => {
      console.log('🔍 AudioPlayer: Audio paused')
      setIsPlaying(false)
    }
    const handleEnded = () => {
      console.log('🔍 AudioPlayer: Audio ended')
      setIsPlaying(false)
    }
    const handleError = (e: Event) => {
      console.error('🔍 AudioPlayer: Audio error:', audio.error, e)
      setAudioError(true)
    }
    const handleLoadStart = () => {
      console.log('🔍 AudioPlayer: Load started')
      setAudioError(false)
    }
    const handleCanPlay = () => {
      console.log('🔍 AudioPlayer: Can play')
    }
    const handleLoadedData = () => {
      console.log('🔍 AudioPlayer: Data loaded')
    }

    audio.addEventListener('timeupdate', updateTime)
    audio.addEventListener('loadedmetadata', updateDuration)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('loadeddata', handleLoadedData)

    return () => {
      audio.removeEventListener('timeupdate', updateTime)
      audio.removeEventListener('loadedmetadata', updateDuration)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('loadeddata', handleLoadedData)
    }
  }, [processedAudioUrl])

  const togglePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying) {
      audio.pause()
    } else {
      console.log('Attempting to play audio:', audioUrl)
      audio.play().catch(error => {
        console.error('Error playing audio:', error)
        setAudioError(true)
      })
    }
  }

  const toggleMute = () => {
    const audio = audioRef.current
    if (!audio) return

    if (isMuted) {
      audio.volume = volume
      setIsMuted(false)
    } else {
      audio.volume = 0
      setIsMuted(true)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current
    if (!audio) return

    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    audio.volume = newVolume
    setIsMuted(newVolume === 0)
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    const progress = progressRef.current
    if (!audio || !progress) return

    const rect = progress.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const progressWidth = rect.width
    const clickPercent = clickX / progressWidth
    const newTime = clickPercent * duration

    audio.currentTime = newTime
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleDownload = () => {
    try {
      const link = document.createElement('a')
      link.href = processedAudioUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      console.log('🔍 AudioPlayer: Download initiated for:', filename)
    } catch (error) {
      console.error('🔍 AudioPlayer: Download error:', error)
    }
  }

  // Show error state if audio failed to load
  if (audioError) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-red-600">
          <VolumeX className="w-4 h-4" />
          <span className="text-sm">خطأ في تحميل الملف الصوتي</span>
        </div>
        <div className="text-xs text-red-500 mt-1">
          URL: {audioUrl.substring(0, 50)}...
        </div>
      </div>
    )
  }

  // Show message if audio file is too large (stored as reference only)
  if (audioUrl.startsWith('audio_file_')) {
    return (
      <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-yellow-600">
          <Volume2 className="w-4 h-4" />
          <span className="text-sm">ملف صوتي كبير - تم حفظه كمرجع</span>
        </div>
        <div className="text-xs text-yellow-500 mt-1">
          الملف: {audioUrl}
        </div>
      </div>
    )
  }

  // Show message if audio URL is empty or invalid
  if (!audioUrl || audioUrl.trim() === '') {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-600">
          <VolumeX className="w-4 h-4" />
          <span className="text-sm">لا يوجد ملف صوتي</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg p-4 shadow-md ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            onClick={togglePlayPause}
            className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center hover:bg-accent transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>
          
          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={toggleMute}
              className="p-1 text-gray-600 hover:text-primary transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              console.log('🔍 AudioPlayer: Original URL:', audioUrl.substring(0, 100) + '...')
              console.log('🔍 AudioPlayer: Processed URL:', processedAudioUrl.substring(0, 100) + '...')
              const audio = audioRef.current
              if (audio) {
                console.log('🔍 AudioPlayer: Audio element ready state:', audio.readyState)
                console.log('🔍 AudioPlayer: Audio network state:', audio.networkState)
                console.log('🔍 AudioPlayer: Audio error:', audio.error)
                console.log('🔍 AudioPlayer: Audio src:', audio.src)
                // Force reload
                audio.load()
              }
            }}
            className="flex items-center space-x-1 space-x-reverse text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>اختبار</span>
          </button>
          <button
            onClick={() => {
              const audio = audioRef.current
              if (audio) {
                audio.load()
                console.log('🔍 AudioPlayer: Forced audio reload')
              }
            }}
            className="flex items-center space-x-1 space-x-reverse text-sm text-green-600 hover:text-green-800 transition-colors"
          >
            <span>إعادة تحميل</span>
          </button>
          <button
            onClick={() => {
              const audio = audioRef.current
              if (audio) {
                console.log('🔍 AudioPlayer: Testing audio element...')
                console.log('🔍 AudioPlayer: Audio src:', audio.src)
                console.log('🔍 AudioPlayer: Audio readyState:', audio.readyState)
                console.log('🔍 AudioPlayer: Audio networkState:', audio.networkState)
                console.log('🔍 AudioPlayer: Audio error:', audio.error)
                console.log('🔍 AudioPlayer: Audio duration:', audio.duration)
                console.log('🔍 AudioPlayer: Audio currentTime:', audio.currentTime)
                
                // Try to play
                audio.play().then(() => {
                  console.log('🔍 AudioPlayer: Play successful')
                }).catch(error => {
                  console.error('🔍 AudioPlayer: Play failed:', error)
                })
              }
            }}
            className="flex items-center space-x-1 space-x-reverse text-sm text-purple-600 hover:text-purple-800 transition-colors"
          >
            <span>اختبار تشغيل</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 space-x-reverse text-sm text-primary hover:text-accent transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>تحميل</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          className="w-full h-2 bg-gray-200 rounded-full cursor-pointer relative"
        >
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Time Display */}
      <div className="flex justify-between text-sm text-gray-600">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={processedAudioUrl}
        preload="metadata"
        className="hidden"
      />
    </div>
  )
}
