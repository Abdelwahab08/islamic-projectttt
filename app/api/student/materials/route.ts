import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth-server'
import { executeQuery } from '@/lib/db'

// Helper (top-level) to fetch materials for a student via membership or assignment
const fetchMaterialsWithMembership = async (
  membershipTable: 'group_students' | 'group_members',
  studentId: string,
  currentStageId: string | null
) => {
  return await executeQuery(`
    SELECT DISTINCT
      m.id,
      m.title,
      m.file_url,
      m.kind,
      m.created_at,
      u.email as teacher_email,
      st.name_ar as stage_name
    FROM materials m
    LEFT JOIN teachers t ON m.teacher_id = t.id
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN stages st ON m.stage_id = st.id
    LEFT JOIN ${membershipTable} gm ON m.group_id = gm.group_id AND gm.student_id = ?
    LEFT JOIN teacher_students ts ON m.teacher_id = ts.teacher_id AND ts.student_id = ?
    WHERE (
      m.stage_id = ? OR
      gm.student_id IS NOT NULL OR
      ts.student_id IS NOT NULL
    )
    ORDER BY m.created_at DESC
  `, [studentId, studentId, currentStageId])
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    
    if (!user || user.role !== 'STUDENT') {
      return NextResponse.json(
        { message: 'غير مصرح' },
        { status: 403 }
      )
    }

    // Get student record ID and current stage
    const student = await executeQuery(
      'SELECT id, current_stage_id FROM students WHERE user_id = ? LIMIT 1',
      [user.id]
    )

    if (student.length === 0) {
      return NextResponse.json(
        { message: 'لم يتم العثور على بيانات الطالب' },
        { status: 404 }
      )
    }

    const studentId = student[0].id
    const currentStageId = student[0].current_stage_id

    let materials = [] as any[]
    try {
      materials = await fetchMaterialsWithMembership('group_students', studentId, currentStageId)
    } catch (err) {
      materials = await fetchMaterialsWithMembership('group_members', studentId, currentStageId)
    }

    const transformedMaterials = materials.map((material: any) => ({
      id: material.id,
      title: material.title,
      fileUrl: material.file_url,
      fileType: material.kind,
      createdAt: material.created_at,
      teacherEmail: material.teacher_email,
      stageName: material.stage_name
    }))

    return NextResponse.json({ materials: transformedMaterials })

  } catch (error) {
    console.error('Error fetching student materials:', error)
    return NextResponse.json(
      { message: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}
