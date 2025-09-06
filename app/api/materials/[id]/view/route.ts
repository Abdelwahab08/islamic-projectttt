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
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const materialId = params.id
    const rows = await executeQuery(
      `SELECT m.id, m.title, m.file_url, m.kind, u.email AS teacher_email, st.name_ar AS stage_name
       FROM materials m
       LEFT JOIN teachers t ON m.teacher_id = t.id
       LEFT JOIN users u ON t.user_id = u.id
       LEFT JOIN stages st ON m.stage_id = st.id
       WHERE m.id = ?
       LIMIT 1`,
      [materialId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'المادة غير موجودة' }, { status: 404 })
    }

    const material = rows[0] as any
    const title = material.title || 'مادة تعليمية'
    const kind = (material.kind || 'PDF').toUpperCase()
    const fileUrlRaw: string = material.file_url || ''
    const origin = new URL(request.url).origin
    let src = fileUrlRaw
    if (fileUrlRaw.startsWith('http://') || fileUrlRaw.startsWith('https://')) {
      src = fileUrlRaw
    } else if (fileUrlRaw.startsWith('/uploads/materials/')) {
      // Map to API that serves local uploads in serverless
      const filename = fileUrlRaw.split('/').pop() || ''
      src = `${origin}/api/uploads/materials/${filename}`
    } else if (fileUrlRaw.startsWith('/')) {
      src = origin + fileUrlRaw
    }

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>معاينة المادة - ${escapeHtml(title)}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: Cairo, Arial, sans-serif; background:#f8fafc; margin:0; }
    .container { max-width: 900px; margin: 24px auto; background:#fff; border:1px solid #e5e7eb; border-radius:12px; box-shadow:0 10px 20px rgba(0,0,0,0.06); overflow:hidden; }
    .header { padding:16px 20px; border-bottom:1px solid #eef2f7; }
    .title { font-size:18px; font-weight:700; color:#111827; }
    .meta { font-size:12px; color:#6b7280; margin-top:6px; }
    .viewer { height: 80vh; display:flex; align-items:center; justify-content:center; background:#111827; }
    iframe, object, embed, video { width:100%; height:100%; border:0; }
    .fallback { background:#fff; color:#111827; padding:24px; text-align:center; }
    .link { color:#2563eb; text-decoration:none; word-break:break-all; }
    .tip { font-size:12px; color:#6b7280; margin-top:8px; }
    .footer { padding:12px 16px; border-top:1px solid #eef2f7; font-size:12px; color:#6b7280; text-align:center; }
  </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <div class="title">${escapeHtml(title)}</div>
        <div class="meta">${escapeHtml(material.stage_name || '')} • ${escapeHtml(material.teacher_email || '')}</div>
      </div>
      <div class="viewer">
        ${renderViewer(kind, src)}
      </div>
      <div class="fallback">
        <div>إذا لم تظهر المعاينة، يمكنك فتح الملف مباشرة:</div>
        <div style="margin-top:8px"><a class="link" href="${src}" target="_blank" rel="noopener">${src}</a></div>
        <div class="tip">قد تمنع بعض الروابط التضمين داخل الصفحة. افتح الرابط في تبويب جديد.</div>
      </div>
      <div class="footer">منصة يقين</div>
    </div>
  </body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    console.error('materials/view error', err)
    return NextResponse.json({ error: 'خطأ في تحميل المعاينة' }, { status: 500 })
  }
}

function renderViewer(kind: string, src: string): string {
  if (kind === 'VIDEO') {
    return `<video src="${escapeAttr(src)}" controls playsinline></video>`
  }
  if (kind === 'AUDIO') {
    return `<audio src="${escapeAttr(src)}" controls></audio>`
  }
  // Default PDF/other: use iframe; allow data URLs as well
  return `<iframe src="${escapeAttr(src)}"></iframe>`
}

function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}


