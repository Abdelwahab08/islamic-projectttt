import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth-server'
import { executeQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUserFromRequest(request)
    if (!user || user.role !== 'STUDENT') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const materialId = params.id

    // Fetch material and basic access context
    const rows = await executeQuery(
      `SELECT m.id, m.title, m.file_url, m.kind
       FROM materials m
       WHERE m.id = ?
       LIMIT 1`,
      [materialId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'المادة غير موجودة' }, { status: 404 })
    }

    const material = rows[0] as { id: string; title: string; file_url: string; kind: string }
    const fileUrl = material.file_url as string | null
    if (!fileUrl) {
      return NextResponse.json({ error: 'لا يوجد رابط للمادة' }, { status: 400 })
    }

    // If data URL, decode and return
    if (fileUrl.startsWith('data:')) {
      const [meta, base64] = fileUrl.split(',')
      const mime = meta.match(/data:([^;]+)/)?.[1] || 'application/octet-stream'
      const buffer = Buffer.from(base64 || '', 'base64')
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mime,
          'Content-Length': buffer.length.toString(),
          'Content-Disposition': `attachment; filename="${sanitizeFilename(material.title)}"`,
        },
      })
    }

    // Normalize relative URLs to absolute
    let absoluteUrl: string
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      absoluteUrl = fileUrl
    } else if (fileUrl.startsWith('/')) {
      const origin = new URL(request.url).origin
      absoluteUrl = origin + fileUrl
    } else {
      // Unknown scheme; treat as not downloadable
      return NextResponse.json({ error: 'رابط المادة غير صالح' }, { status: 400 })
    }

    // Fetch the resource server-side to bypass CORS for downloads
    const res = await fetch(absoluteUrl)
    if (!res.ok) {
      return NextResponse.json({ error: 'تعذر تحميل الملف من المصدر' }, { status: 502 })
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Try to infer filename from URL path
    const inferred = inferFilenameFromUrl(absoluteUrl) || `${material.title}`
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': `attachment; filename="${sanitizeFilename(inferred)}"`,
        'Cache-Control': 'private, max-age=0, no-cache',
      },
    })

  } catch (error) {
    console.error('Material download error:', error)
    return NextResponse.json({ error: 'حدث خطأ في تحميل المادة' }, { status: 500 })
  }
}

function inferFilenameFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop()
    return last || null
  } catch {
    return null
  }
}

function sanitizeFilename(name: string): string {
  return (name || 'file')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .trim()
}

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { executeQuerySingle } from '@/lib/db'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { message: 'غير مصرح لك بتحميل المواد' },
        { status: 403 }
      )
    }

    const materialId = params.id

    // Get material details
    const material = await executeQuerySingle(`
      SELECT 
        m.*,
        s.user_id as student_user_id,
        t.user_id as teacher_user_id
      FROM materials m
      LEFT JOIN students s ON m.stage_id = s.current_stage_id
      LEFT JOIN teachers t ON m.teacher_id = t.id
      WHERE m.id = ?
    `, [materialId])

    if (!material) {
      return NextResponse.json(
        { message: 'المادة غير موجودة' },
        { status: 404 }
      )
    }

    // Check permissions - students can download materials for their stage
    const canDownload = 
      user.role === 'ADMIN' ||
      (user.role === 'TEACHER' && material.teacher_user_id === user.id) ||
      (user.role === 'STUDENT' && material.student_user_id === user.id)

    if (!canDownload) {
      return NextResponse.json(
        { message: 'غير مصرح لك بتحميل هذه المادة' },
        { status: 403 }
      )
    }

    // Parse file_url to get filename
    let filename = 'sample-material.pdf' // default
    try {
      if (material.file_url) {
        const fileUrls = JSON.parse(material.file_url)
        if (Array.isArray(fileUrls) && fileUrls.length > 0) {
          filename = fileUrls[0]
        }
      }
    } catch (error) {
      console.error('Error parsing file_url:', error)
    }

    // Construct file path
    const filePath = path.join(process.cwd(), 'uploads', 'materials', filename)

    try {
      // Check if file exists
      await fs.access(filePath)
      
      // Read file
      const fileBuffer = await fs.readFile(filePath)
      
      // Determine content type based on file extension
      const ext = path.extname(filename).toLowerCase()
      let contentType = 'application/octet-stream'
      
      if (ext === '.pdf') contentType = 'application/pdf'
      else if (ext === '.mp4' || ext === '.avi' || ext === '.mov') contentType = 'video/mp4'
      else if (ext === '.mp3' || ext === '.wav') contentType = 'audio/mpeg'
      else if (ext === '.doc' || ext === '.docx') contentType = 'application/msword'
      else if (ext === '.txt') contentType = 'text/plain'

      return new NextResponse(Buffer.from(fileBuffer), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    } catch (fileError) {
      console.error('Error reading file:', fileError)
      return NextResponse.json(
        { message: 'خطأ في قراءة الملف' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Material download error:', error)
    return NextResponse.json(
      { message: 'حدث خطأ في تحميل المادة' },
      { status: 500 }
    )
  }
}
