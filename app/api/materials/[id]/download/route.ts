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
