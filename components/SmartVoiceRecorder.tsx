'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Play, Pause, Download, AlertTriangle, CheckCircle } from 'lucide-react'

interface SmartVoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void
  isSubmitting?: boolean
  maxSizeKB?: number
}

export default function SmartVoiceRecorder({ 
  onRecordingComplete, 
  isSubmitting = false,
  maxSizeKB = 50 
}: SmartVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioURL, setAudioURL] = useState<string | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [recordingQuality, setRecordingQuality] = useState<'high' | 'medium' | 'low'>('medium')
  
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

  const getRecordingSettings = () => {
    switch (recordingQuality) {
      case 'low':
        return {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 8000, // Very low sample rate
            channelCount: 1,
            volume: 0.8
          },
          mimeType: 'audio/webm;codecs=opus'
        }
      case 'medium':
        return {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000, // Medium sample rate
            channelCount: 1,
            volume: 0.9
          },
          mimeType: 'audio/webm;codecs=opus'
        }
      case 'high':
        return {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100, // High sample rate
            channelCount: 2,
            volume: 1.0
          },
          mimeType: 'audio/webm;codecs=opus'
        }
    }
  }

  const startRecording = async () => {
    try {
      const settings = getRecordingSettings()
      const stream = await navigator.mediaDevices.getUserMedia(settings)
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: settings.mimeType
      })
      
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: settings.mimeType })
        const fileSizeKB = Math.round(blob.size / 1024)
        setFileSize(fileSizeKB)
        
        console.log('🔍 SmartVoiceRecorder: File size:', fileSizeKB, 'KB (Quality:', recordingQuality, ')')
        
        const url = URL.createObjectURL(blob)
        setAudioURL(url)
        onRecordingComplete(blob)
        
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

  const getQualityInfo = () => {
    switch (recordingQuality) {
      case 'low':
        return { label: 'منخفضة', color: 'green', description: 'ملفات صغيرة - مناسبة لـ Vercel' }
      case 'medium':
        return { label: 'متوسطة', color: 'blue', description: 'جودة متوازنة' }
      case 'high':
        return { label: 'عالية', color: 'red', description: 'ملفات كبيرة - قد لا تعمل في Vercel' }
    }
  }

  const qualityInfo = getQualityInfo()

  return (
    <div className="space-y-4">
      {/* Quality Selector */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3">جودة التسجيل:</h4>
        <div className="flex gap-2">
          {(['low', 'medium', 'high'] as const).map((quality) => (
            <button
              key={quality}
              onClick={() => setRecordingQuality(quality)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                recordingQuality === quality
                  ? quality === 'low' 
                    ? 'bg-green-500 text-white' 
                    : quality === 'medium'
                    ? 'bg-blue-500 text-white'
                    : 'bg-red-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              {quality === 'low' ? 'منخفضة' : quality === 'medium' ? 'متوسطة' : 'عالية'}
            </button>
          ))}
        </div>
        <div className={`text-sm mt-2 p-2 rounded ${
          qualityInfo.color === 'green' ? 'bg-green-100 text-green-700' :
          qualityInfo.color === 'blue' ? 'bg-blue-100 text-blue-700' :
          'bg-red-100 text-red-700'
        }`}>
          {qualityInfo.description}
        </div>
      </div>

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

      {/* Audio Player */}
      {audioURL && (
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
            <div className={`text-center text-sm p-3 rounded-lg ${
              fileSize <= maxSizeKB 
                ? 'bg-green-100 text-green-700 border border-green-200' 
                : 'bg-orange-100 text-orange-700 border border-orange-200'
            }`}>
              <div className="flex items-center justify-center gap-2 mb-1">
                {fileSize <= maxSizeKB ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span className="font-medium">
                  {fileSize <= maxSizeKB ? 'حجم مناسب!' : 'حجم كبير'}
                </span>
              </div>
              <div>
                📁 حجم الملف: {fileSize} KB
                <br />
                🎯 الحد الأقصى: {maxSizeKB} KB
                {fileSize <= maxSizeKB ? (
                  <div className="text-green-600 mt-1">
                    ✅ سيعمل بشكل مثالي في Vercel
                  </div>
                ) : (
                  <div className="text-orange-600 mt-1">
                    ⚠️ قد لا يعمل في Vercel - جرب جودة منخفضة
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">نصائح للتسجيل:</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• اختر "جودة منخفضة" للحصول على ملفات صغيرة</li>
          <li>• سجل ملفات قصيرة (أقل من 30 ثانية)</li>
          <li>• تأكد من أن حجم الملف أقل من {maxSizeKB} KB</li>
          <li>• استخدم ميكروفون جيد للحصول على صوت واضح</li>
        </ul>
      </div>
    </div>
  )
}
