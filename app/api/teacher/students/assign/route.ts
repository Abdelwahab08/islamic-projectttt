import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth-server'
import { executeQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    
    if (!user || user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { student_ids } = body

    if (!student_ids || !Array.isArray(student_ids)) {
      return NextResponse.json({ error: 'معرفات الطلاب مطلوبة' }, { status: 400 })
    }

    // Get teacher ID
    const teacherRecord = await executeQuery('SELECT id FROM teachers WHERE user_id = ?', [user.id])
    
    if (teacherRecord.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على بيانات المعلم' }, { status: 404 })
    }

    const teacherId = teacherRecord[0].id

    // Remove existing assignments for this teacher
    await executeQuery('DELETE FROM teacher_students WHERE teacher_id = ?', [teacherId])

    // Add new assignments
    for (const studentId of student_ids) {
      await executeQuery(
        'INSERT INTO teacher_students (teacher_id, student_id, created_at) VALUES (?, ?, NOW())',
        [teacherId, studentId]
      )
    }

    return NextResponse.json({ 
      message: 'تم تعيين الطلاب للمعلم بنجاح',
      assigned_count: student_ids.length 
    })

  } catch (error) {
    console.error('Error assigning students:', error)
    return NextResponse.json(
      { error: 'فشل في تعيين الطلاب' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    
    if (!user || user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    // Get teacher ID
    const teacherRecord = await executeQuery('SELECT id FROM teachers WHERE user_id = ?', [user.id])
    
    if (teacherRecord.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على بيانات المعلم' }, { status: 404 })
    }

    const teacherId = teacherRecord[0].id

    // Get all students assigned to this teacher
    const assignedStudents = await executeQuery(`
      SELECT 
        s.id,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as name,
        u.email
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN teacher_students ts ON s.id = ts.student_id
      WHERE ts.teacher_id = ?
      ORDER BY u.first_name, u.last_name
    `, [teacherId])

    // Get all students (for assignment)
    const allStudents = await executeQuery(`
      SELECT 
        s.id,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as name,
        u.email
      FROM students s
      JOIN users u ON s.user_id = u.id
      ORDER BY u.first_name, u.last_name
    `)

    return NextResponse.json({
      assigned_students: assignedStudents,
      all_students: allStudents,
      teacher_id: teacherId
    })

  } catch (error) {
    console.error('Error fetching student assignments:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل بيانات الطلاب' },
      { status: 500 }
    )
  }
}
