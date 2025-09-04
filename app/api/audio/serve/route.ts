import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth-server'

export async function GET(request: NextRequest) {
  try {
    // Get current user to ensure they're authenticated
    const user = await getCurrentUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const audioId = searchParams.get('id')
    
    if (!audioId) {
      return NextResponse.json({ error: 'معرف الملف الصوتي مطلوب' }, { status: 400 })
    }

    // Check if this is a large file reference
    if (audioId.startsWith('audio_file_')) {
      // For large files, we need to get the actual audio data from the database
      // Let's check if we can find the submission with this audio reference
      const { executeQuery } = await import('@/lib/db')
      
      const submission = await executeQuery(
        `SELECT audio_url FROM submissions WHERE audio_url = ? LIMIT 1`,
        [audioId]
      )

      if (submission.length === 0) {
        return NextResponse.json({ error: 'الملف الصوتي غير موجود' }, { status: 404 })
      }

      // If the audio_url is just a reference, we can't serve the actual audio
      // Let's return a helpful message instead
      return NextResponse.json({ 
        error: 'ملف صوتي كبير جداً',
        message: 'هذا الملف كبير جداً ولا يمكن تشغيله في Vercel',
        suggestion: 'يرجى طلب الملف من الطالب مباشرة أو استخدام ملف أصغر'
      }, { status: 413 })
    }

    // If it's a data URL, we can serve it
    if (audioId.startsWith('data:')) {
      // Extract the base64 data
      const base64Data = audioId.split(',')[1]
      if (!base64Data) {
        return NextResponse.json({ error: 'بيانات الملف الصوتي غير صحيحة' }, { status: 400 })
      }

      try {
        // Convert base64 to buffer
        const audioBuffer = Buffer.from(base64Data, 'base64')
        
        // Determine content type from the data URL
        const mimeType = audioId.split(',')[0].split(':')[1].split(';')[0]
        
        return new NextResponse(audioBuffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Length': audioBuffer.length.toString(),
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (error) {
        console.error('Error serving audio data:', error)
        return NextResponse.json({ error: 'خطأ في تحميل الملف الصوتي' }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'نوع الملف غير مدعوم' }, { status: 400 })

  } catch (error) {
    console.error('Error in audio serve API:', error)
    return NextResponse.json({ error: 'خطأ في الخادم' }, { status: 500 })
  }
}
