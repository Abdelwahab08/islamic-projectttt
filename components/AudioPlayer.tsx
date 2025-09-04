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
  
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  // Process base64 data URL to blob URL for better compatibility
  useEffect(() => {
    if (audioUrl.startsWith('data:')) {
      try {
        // Convert data URL to blob
        const response = fetch(audioUrl)
        response.then(res => res.blob()).then(blob => {
          const blobUrl = URL.createObjectURL(blob)
          console.log('🔍 AudioPlayer: Created blob URL:', blobUrl)
          setProcessedAudioUrl(blobUrl)
        }).catch(error => {
          console.error('🔍 AudioPlayer: Error creating blob URL:', error)
          setProcessedAudioUrl(audioUrl) // Fallback to original
        })
      } catch (error) {
        console.error('🔍 AudioPlayer: Error processing data URL:', error)
        setProcessedAudioUrl(audioUrl) // Fallback to original
      }
    } else {
      setProcessedAudioUrl(audioUrl)
    }
  }, [audioUrl])

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
    const link = document.createElement('a')
    link.href = audioUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
              }
            }}
            className="flex items-center space-x-1 space-x-reverse text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            <span>اختبار</span>
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
