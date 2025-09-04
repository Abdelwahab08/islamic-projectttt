'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, Volume2, Download } from 'lucide-react'

interface SimpleAudioPlayerProps {
  audioUrl: string
  filename: string
  className?: string
}

export default function SimpleAudioPlayer({ audioUrl, filename, className = '' }: SimpleAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const audioRef = useRef<HTMLAudioElement>(null)

  // Check if this is a large file reference that can't be played
  useEffect(() => {
    if (audioUrl.startsWith('audio_file_')) {
      setError('ملف صوتي كبير جداً - لا يمكن تشغيله في Vercel')
      setIsLoading(false)
      return
    }
    
    if (!audioUrl || audioUrl.trim() === '') {
      setError('لا يوجد ملف صوتي')
      setIsLoading(false)
      return
    }
  }, [audioUrl])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
      setIsLoading(false)
      console.log('🔍 SimpleAudioPlayer: Audio loaded, duration:', audio.duration)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handlePlay = () => {
      setIsPlaying(true)
      console.log('🔍 SimpleAudioPlayer: Audio started playing')
    }

    const handlePause = () => {
      setIsPlaying(false)
      console.log('🔍 SimpleAudioPlayer: Audio paused')
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      console.log('🔍 SimpleAudioPlayer: Audio ended')
    }

    const handleError = (e: Event) => {
      console.error('🔍 SimpleAudioPlayer: Audio error:', audio.error)
      setError('خطأ في تحميل الملف الصوتي')
      setIsLoading(false)
    }

    const handleLoadStart = () => {
      setIsLoading(true)
      setError(null)
      console.log('🔍 SimpleAudioPlayer: Loading started')
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('loadstart', handleLoadStart)

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('loadstart', handleLoadStart)
    }
  }, [])

  const togglePlayPause = async () => {
    const audio = audioRef.current
    if (!audio) return

    try {
      if (isPlaying) {
        audio.pause()
      } else {
        await audio.play()
      }
    } catch (error) {
      console.error('🔍 SimpleAudioPlayer: Play error:', error)
      setError('فشل في تشغيل الملف الصوتي')
    }
  }

  const handleDownload = () => {
    try {
      const link = document.createElement('a')
      link.href = audioUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('🔍 SimpleAudioPlayer: Download error:', error)
    }
  }

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Show error state
  if (error) {
    return (
      <div className={`bg-orange-50 border border-orange-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-orange-600 mb-2">
          <Volume2 className="w-4 h-4" />
          <span className="text-sm font-medium">{error}</span>
        </div>
        {error.includes('كبير جداً') && (
          <div className="text-xs text-orange-500">
            💡 نصيحة: لتشغيل الملفات الصوتية، يرجى تسجيل ملفات أصغر حجماً (أقل من 50KB)
          </div>
        )}
      </div>
    )
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          <span className="text-sm">جاري تحميل الملف الصوتي...</span>
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
            className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>
          
          <div className="flex items-center space-x-2 space-x-reverse">
            <Volume2 className="w-4 h-4 text-gray-600" />
          </div>
        </div>

        <button
          onClick={handleDownload}
          className="flex items-center space-x-1 space-x-reverse text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>تحميل</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-2">
        <div className="w-full h-2 bg-gray-200 rounded-full">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-100"
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
        src={audioUrl}
        preload="metadata"
        className="hidden"
      />
    </div>
  )
}
