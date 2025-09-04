'use client'

import { useState } from 'react'
import { Volume2, Download, ExternalLink, AlertTriangle, Copy, Check } from 'lucide-react'

interface LargeFileAudioPlayerProps {
  audioUrl: string
  filename: string
  className?: string
}

export default function LargeFileAudioPlayer({ audioUrl, filename, className = '' }: LargeFileAudioPlayerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyReference = async () => {
    try {
      await navigator.clipboard.writeText(audioUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const generateDownloadLink = () => {
    // Create a data URL that can be downloaded
    const data = {
      type: 'audio_reference',
      reference: audioUrl,
      filename: filename,
      timestamp: new Date().toISOString()
    }
    
    const jsonData = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename.replace('.wav', '')}_reference.json`
    link.click()
    
    URL.revokeObjectURL(url)
  }

  const openInNewTab = () => {
    // Create a simple HTML page that explains the situation
    const htmlContent = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ملف صوتي كبير - ${filename}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: white;
            border-radius: 15px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            max-width: 600px;
            text-align: center;
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
            font-size: 2rem;
        }
        .info {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #ffc107;
        }
        .reference {
            background: #e9ecef;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
            font-family: monospace;
            word-break: break-all;
            font-size: 0.9rem;
        }
        .actions {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
            margin-top: 20px;
        }
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-weight: 500;
            transition: all 0.3s ease;
        }
        .btn-primary {
            background: #007bff;
            color: white;
        }
        .btn-primary:hover {
            background: #0056b3;
        }
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        .btn-secondary:hover {
            background: #545b62;
        }
        .btn-success {
            background: #28a745;
            color: white;
        }
        .btn-success:hover {
            background: #1e7e34;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🎵</div>
        <h1>ملف صوتي كبير</h1>
        
        <div class="info">
            <h3>📁 ${filename}</h3>
            <p>هذا الملف الصوتي كبير جداً ولا يمكن تشغيله مباشرة في Vercel.</p>
            <p>المرجع: <strong>${audioUrl}</strong></p>
        </div>
        
        <div class="reference">
            ${audioUrl}
        </div>
        
        <div class="actions">
            <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${audioUrl}')">
                📋 نسخ المرجع
            </button>
            <button class="btn btn-secondary" onclick="window.close()">
                ❌ إغلاق
            </button>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background: #d1ecf1; border-radius: 10px; border-left: 4px solid #17a2b8;">
            <h4>💡 حلول مقترحة:</h4>
            <ul style="text-align: right; margin: 10px 0;">
                <li>اطلب من الطالب إرسال ملف أصغر (أقل من 50KB)</li>
                <li>استخدم تطبيق ضغط الملفات الصوتية</li>
                <li>سجل ملفاً أقصر (أقل من 30 ثانية)</li>
                <li>استخدم جودة تسجيل منخفضة</li>
            </ul>
        </div>
    </div>
</body>
</html>`

    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className={`bg-orange-50 border border-orange-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 text-orange-600 mb-3">
        <Volume2 className="w-5 h-5" />
        <span className="font-medium">ملف صوتي كبير جداً</span>
      </div>
      
      <div className="text-sm text-orange-700 mb-4">
        <p className="mb-2">
          ⚠️ هذا الملف كبير جداً ولا يمكن تشغيله في Vercel
        </p>
        <p className="mb-2">
          📁 المرجع: <code className="bg-orange-100 px-2 py-1 rounded text-xs">{audioUrl}</code>
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-orange-600 mb-3">
          💡 <strong>حلول مقترحة:</strong>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopyReference}
            className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded text-sm transition-colors"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'تم النسخ!' : 'نسخ المرجع'}
          </button>
          
          <button
            onClick={generateDownloadLink}
            className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            تحميل المرجع
          </button>
          
          <button
            onClick={openInNewTab}
            className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            فتح في تبويب جديد
          </button>
        </div>
      </div>

      <div className="mt-4 p-3 bg-orange-100 rounded-lg">
        <div className="text-xs text-orange-800">
          <strong>نصائح للطلاب:</strong>
          <ul className="mt-1 space-y-1 text-right">
            <li>• استخدم جودة تسجيل منخفضة</li>
            <li>• سجل ملفات أقصر (أقل من 30 ثانية)</li>
            <li>• تأكد من أن حجم الملف أقل من 50KB</li>
            <li>• استخدم ميكروفون جيد للحصول على صوت واضح</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
