'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Download, Upload } from 'lucide-react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  isSubmitting?: boolean;
}

export default function VoiceRecorder({ onRecordingComplete, isSubmitting = false }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [fileSize, setFileSize] = useState<number | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setAudioURL(url);
        
        // Check file size and warn if too large
        const fileSizeKB = Math.round(blob.size / 1024);
        setFileSize(fileSizeKB);
        console.log('🔍 VoiceRecorder: File size:', fileSizeKB, 'KB');
        
        if (fileSizeKB > 50) {
          console.warn('🔍 VoiceRecorder: File is too large for Vercel playback:', fileSizeKB, 'KB');
        }
        
        onRecordingComplete(blob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('خطأ في الوصول إلى الميكروفون');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const playRecording = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white rounded-lg p-6 shadow-md border">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">تسجيل الصوت</h3>
      
      {/* Recording Controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
        {!isRecording && !audioURL && (
          <button
            onClick={startRecording}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
          >
            <Mic className="w-5 h-5" />
            بدء التسجيل
          </button>
        )}

        {isRecording && (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
          >
            <Square className="w-5 h-5" />
            إيقاف التسجيل
          </button>
        )}
      </div>

      {/* Recording Timer */}
      {isRecording && (
        <div className="text-center mb-4">
          <div className="text-2xl font-mono text-red-500">
            {formatTime(recordingTime)}
          </div>
          <div className="text-sm text-gray-600">جاري التسجيل...</div>
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
                const link = document.createElement('a');
                link.href = audioURL;
                link.download = 'recording.wav';
                link.click();
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
          
          {fileSize && (
            <div className={`text-center text-sm mt-2 p-2 rounded-lg ${
              fileSize > 50 
                ? 'bg-orange-100 text-orange-700 border border-orange-200' 
                : 'bg-green-100 text-green-700 border border-green-200'
            }`}>
              📁 حجم الملف: {fileSize} KB
              {fileSize > 50 && (
                <div className="mt-1 text-xs">
                  ⚠️ الملف كبير جداً - قد لا يعمل في Vercel
                  <br />
                  💡 نصيحة: سجل ملفاً أقصر (أقل من 30 ثانية)
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">تعليمات التسجيل:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• تأكد من أن الميكروفون يعمل بشكل صحيح</li>
          <li>• اختر مكاناً هادئاً للتسجيل</li>
          <li>• تحدث بوضوح وبصوت مناسب</li>
          <li>• يمكنك إعادة التسجيل عدة مرات</li>
        </ul>
      </div>
    </div>
  );
}
