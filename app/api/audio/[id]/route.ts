import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { executeQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const submissionId = params.id

    // Get the audio data from the database
    const submission = await executeQuery(
      'SELECT audio_url, file_url FROM submissions WHERE id = ?',
      [submissionId]
    )

    if (submission.length === 0) {
      return NextResponse.json({ error: 'التسليم غير موجود' }, { status: 404 })
    }

    const audioData = submission[0].audio_url || submission[0].file_url

    if (!audioData) {
      return NextResponse.json({ error: 'لا يوجد ملف صوتي' }, { status: 404 })
    }

    // If it's base64 data, return it as audio
    if (audioData.startsWith('data:')) {
      const [header, base64Data] = audioData.split(',')
      const mimeType = header.match(/data:([^;]+)/)?.[1] || 'audio/wav'
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64')
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // If it's a file reference, return error (file not available in Vercel)
    if (audioData.startsWith('audio_file_')) {
      return NextResponse.json({ 
        error: 'الملف الصوتي كبير جداً ولا يمكن تشغيله في هذه البيئة',
        message: 'يرجى استخدام ملفات صوتية أصغر حجماً'
      }, { status: 413 })
    }

    // If it's a file path, return error (files not available in Vercel)
    return NextResponse.json({ 
      error: 'الملف الصوتي غير متوفر في هذه البيئة',
      message: 'يرجى إعادة تسليم الملف'
    }, { status: 404 })

  } catch (error) {
    console.error('Error serving audio:', error)
    return NextResponse.json(
      { error: 'خطأ في تحميل الملف الصوتي' },
      { status: 500 }
    )
  }
}
