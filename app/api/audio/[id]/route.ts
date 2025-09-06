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

    // If it's a file reference, synthesize a short WAV tone so the player can play something
    if (audioData.startsWith('audio_file_')) {
      const sampleRate = 8000
      const durationSec = 1
      const numSamples = sampleRate * durationSec
      const header = Buffer.alloc(44)
      const data = Buffer.alloc(numSamples * 2)
      // Write a 440Hz sine as placeholder
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate
        const sample = Math.sin(2 * Math.PI * 440 * t)
        const int16 = Math.max(-1, Math.min(1, sample)) * 32767
        data.writeInt16LE(int16, i * 2)
      }
      // RIFF header for PCM WAV mono 16-bit
      header.write('RIFF', 0)
      header.writeUInt32LE(36 + data.length, 4)
      header.write('WAVE', 8)
      header.write('fmt ', 12)
      header.writeUInt32LE(16, 16) // PCM
      header.writeUInt16LE(1, 20)  // PCM format
      header.writeUInt16LE(1, 22)  // channels
      header.writeUInt32LE(sampleRate, 24)
      header.writeUInt32LE(sampleRate * 2, 28)
      header.writeUInt16LE(2, 32)  // block align
      header.writeUInt16LE(16, 34) // bits
      header.write('data', 36)
      header.writeUInt32LE(data.length, 40)
      const wav = Buffer.concat([header, data])
      return new NextResponse(wav, {
        headers: {
          'Content-Type': 'audio/wav',
          'Content-Length': wav.length.toString(),
          'Cache-Control': 'no-store',
        },
      })
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
