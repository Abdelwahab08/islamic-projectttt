import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth-server'
import { executeQuery } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)

    if (!user || user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    // First get the teacher record ID
    const teacherRecord = await executeQuery('SELECT id FROM teachers WHERE user_id = ?', [user.id])
    
    if (teacherRecord.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على بيانات المعلم' }, { status: 404 })
    }

    const teacherId = teacherRecord[0].id
    
    console.log('🔍 Teacher Students API - Current user:', user ? { id: user.id, role: user.role, email: user.email } : 'No user')
    console.log('🔍 Teacher Students API - Teacher ID:', teacherId)

    // Get students assigned to this teacher
    const students = await executeQuery(`
      SELECT
        s.id,
        s.user_id,
        u.email,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as name,
        '' as phone,
        DATE_FORMAT(COALESCE(s.updated_at, NOW()), '%Y-%m-%d') as join_date,
        st.name_ar as current_stage,
        0 as progress_percentage,
        0 as total_assignments,
        0 as completed_assignments,
        0 as certificates_count,
        DATE_FORMAT(COALESCE(s.updated_at, NOW()), '%Y-%m-%d') as last_activity,
        'active' as status,
        s.current_page,
        s.current_stage_id as stage_id,
        st.name_ar as stage_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN stages st ON s.current_stage_id = st.id
      JOIN teacher_students ts ON s.id = ts.student_id
      WHERE ts.teacher_id = ?
      ORDER BY u.first_name, u.last_name ASC
    `, [teacherId])
    
    console.log('🔍 Teacher Students API - Found students:', students.length)
    console.log('🔍 Teacher Students API - Sample students:', students.slice(0, 3))

    return NextResponse.json({ students })

  } catch (error) {
    console.error('Error fetching students:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل الطلاب' },
      { status: 500 }
    )
  }
}
