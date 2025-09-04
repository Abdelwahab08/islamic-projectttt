import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth-server'
import { executeQuery } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح - يجب أن تكون مدير' }, { status: 401 })
    }

    // Get all teacher-student assignments
    const assignments = await executeQuery(`
      SELECT 
        ts.id as assignment_id,
        ts.teacher_id,
        ts.student_id,
        ts.assigned_at,
        CONCAT(COALESCE(tu.first_name, ''), ' ', COALESCE(tu.last_name, '')) as teacher_name,
        tu.email as teacher_email,
        CONCAT(COALESCE(su.first_name, ''), ' ', COALESCE(su.last_name, '')) as student_name,
        su.email as student_email
      FROM teacher_students ts
      JOIN teachers t ON ts.teacher_id = t.id
      JOIN users tu ON t.user_id = tu.id
      JOIN students s ON ts.student_id = s.id
      JOIN users su ON s.user_id = su.id
      ORDER BY ts.assigned_at DESC
    `)

    // Get all teachers
    const teachers = await executeQuery(`
      SELECT 
        t.id as teacher_id,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as teacher_name,
        u.email as teacher_email,
        COUNT(ts.student_id) as assigned_students_count
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN teacher_students ts ON t.id = ts.teacher_id
      GROUP BY t.id, u.first_name, u.last_name, u.email
      ORDER BY u.first_name, u.last_name
    `)

    // Get all students
    const students = await executeQuery(`
      SELECT 
        s.id as student_id,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as student_name,
        u.email as student_email,
        CASE 
          WHEN ts.teacher_id IS NOT NULL THEN CONCAT(COALESCE(tu.first_name, ''), ' ', COALESCE(tu.last_name, ''))
          ELSE 'غير مسند'
        END as assigned_teacher_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN teacher_students ts ON s.id = ts.student_id
      LEFT JOIN teachers t ON ts.teacher_id = t.id
      LEFT JOIN users tu ON t.user_id = tu.id
      ORDER BY u.first_name, u.last_name
    `)

    return NextResponse.json({
      assignments,
      teachers,
      students,
      summary: {
        total_assignments: assignments.length,
        total_teachers: teachers.length,
        total_students: students.length,
        unassigned_students: students.filter((s: any) => s.assigned_teacher_name === 'غير مسند').length
      }
    })

  } catch (error) {
    console.error('Error fetching teacher-student debug info:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل معلومات التصحيح' },
      { status: 500 }
    )
  }
}
