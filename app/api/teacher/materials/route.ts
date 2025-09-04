import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { executeQuery, executeUpdate } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const teacherId = user.id

    // Get teacher record
    const teachers = await executeQuery('SELECT id FROM teachers WHERE user_id = ?', [teacherId])
    if (teachers.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على المدرس' }, { status: 404 })
    }
    const teacherRecordId = teachers[0].id

    const materialsQuery = `
      SELECT 
        m.id,
        m.title,
        m.file_url,
        m.kind,
        m.created_at,
        st.name_ar as stage_name,
        g.name as group_name
      FROM materials m
      JOIN teachers t ON m.teacher_id = t.id
      LEFT JOIN stages st ON m.stage_id = st.id
      LEFT JOIN \`groups\` g ON m.group_id = g.id
      WHERE t.user_id = ?
      ORDER BY m.created_at DESC
    `

    const materials = await executeQuery(materialsQuery, [teacherId])

    const transformedMaterials = materials.map((material: any) => ({
      id: material.id,
      title: material.title,
      description: `${material.kind} material for ${material.stage_name || 'general'}`,
      kind: material.kind,
      file_url: material.file_url,
      file_path: material.file_url,
      file_size: 0, // Not available in current schema
      downloads_count: 0, // Not available in current schema
      created_at: material.created_at,
      group_name: material.group_name || 'غير محدد',
      stage_name: material.stage_name || 'غير محدد'
    }))

    return NextResponse.json({
      materials: transformedMaterials,
      total: transformedMaterials.length
    })

  } catch (error) {
    console.error('Error fetching teacher materials:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل المواد التعليمية' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    if (!user || user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const teacherId = user.id

    // Get teacher record
    const teachers = await executeQuery('SELECT id FROM teachers WHERE user_id = ?', [teacherId])
    if (teachers.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على المدرس' }, { status: 404 })
    }
    const teacherRecordId = teachers[0].id

    const { title, description, kind, file_url, group_id, stage_id } = await request.json()

    if (!title || !kind) {
      return NextResponse.json({ error: 'العنوان والنوع مطلوبان' }, { status: 400 })
    }

    // Save to database (without file upload for Vercel compatibility)
    const materialId = uuidv4()
    await executeUpdate(`
      INSERT INTO materials (id, title, teacher_id, stage_id, group_id, file_url, kind, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      materialId,
      title,
      teacherRecordId,
      stage_id || null,
      group_id || null,
      file_url || `https://example.com/materials/${materialId}`, // Placeholder URL
      kind
    ])

    return NextResponse.json({
      message: 'تم إضافة المادة التعليمية بنجاح',
      material: {
        id: materialId,
        title,
        file_url: file_url || `https://example.com/materials/${materialId}`,
        description: description || ''
      }
    })

  } catch (error) {
    console.error('Error creating material:', error)
    return NextResponse.json(
      { error: 'فشل في إضافة المادة التعليمية' },
      { status: 500 }
    )
  }
}
