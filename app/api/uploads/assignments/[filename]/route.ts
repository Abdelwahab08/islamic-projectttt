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
    const filePath = join(process.cwd(), 'uploads', 'assignments', filename)
    
    // Check if file exists
    if (!existsSync(filePath)) {
      console.log('🔍 File not found:', filePath)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    
    // Read the file
    const fileBuffer = await readFile(filePath)
    
    // Determine content type based on file extension
    const extension = filename.split('.').pop()?.toLowerCase()
    let contentType = 'audio/mpeg' // default
    
    switch (extension) {
      case 'mp3':
        contentType = 'audio/mpeg'
        break
      case 'wav':
        contentType = 'audio/wav'
        break
      case 'ogg':
        contentType = 'audio/ogg'
        break
      case 'm4a':
        contentType = 'audio/mp4'
        break
      default:
        contentType = 'audio/mpeg'
    }
    
    // Return the file with appropriate headers
    return new NextResponse(Buffer.from(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    })
    
  } catch (error) {
    console.error('Error serving audio file:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}
