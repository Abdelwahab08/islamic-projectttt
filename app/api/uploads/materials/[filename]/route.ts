import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename
    const filePath = join(process.cwd(), 'uploads', 'materials', filename)

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)

    const extension = filename.split('.').pop()?.toLowerCase()
    let contentType = 'application/octet-stream'

    switch (extension) {
      case 'pdf':
        contentType = 'application/pdf'
        break
      case 'mp4':
      case 'mov':
      case 'webm':
        contentType = 'video/mp4'
        break
      case 'mp3':
        contentType = 'audio/mpeg'
        break
      case 'wav':
        contentType = 'audio/wav'
        break
      case 'ogg':
        contentType = 'audio/ogg'
        break
      case 'png':
        contentType = 'image/png'
        break
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg'
        break
    }

    return new NextResponse(Buffer.from(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch (error) {
    console.error('Error serving material file:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}


