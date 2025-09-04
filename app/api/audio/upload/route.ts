import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File

    if (!audioFile) {
      return NextResponse.json({ error: 'ملف الصوت مطلوب' }, { status: 400 })
    }

    // For Vercel, we'll use a simple approach:
    // 1. Convert to base64
    // 2. Store in a simple JSON file or use a free service
    // 3. Return a simple URL

    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString('base64')
    
    // Create a simple data URL
    const audioDataUrl = `data:${audioFile.type};base64,${base64Audio}`
    
    // For now, we'll return the data URL directly
    // In production, you could use services like:
    // - Cloudinary (free tier)
    // - AWS S3
    // - Google Cloud Storage
    // - Firebase Storage
    
    return NextResponse.json({
      success: true,
      audioUrl: audioDataUrl,
      fileName: audioFile.name,
      size: audioFile.size,
      type: audioFile.type
    })

  } catch (error) {
    console.error('Audio upload error:', error)
    return NextResponse.json(
      { error: 'فشل في رفع الملف الصوتي' },
      { status: 500 }
    )
  }
}
