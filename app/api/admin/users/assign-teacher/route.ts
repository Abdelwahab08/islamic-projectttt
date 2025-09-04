import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth-server'
import { executeQuery, executeUpdate } from '@/lib/db'
import { createNotificationFromTemplate, notificationTemplates } from '@/lib/notifications'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { studentId, teacherId } = await request.json()

    if (!studentId || !teacherId) {
      return NextResponse.json({ error: 'معرف الطالب والمعلم مطلوبان' }, { status: 400 })
    }

    // Verify student exists and is a student (studentId is actually user ID)
    const student = await executeQuery(
      'SELECT s.id as student_record_id, s.user_id, u.role, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = ? AND u.role = "STUDENT"',
      [studentId]
    )

    if (student.length === 0) {
      return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 })
    }

    const studentRecordId = student[0].student_record_id
    const studentEmail = student[0].email

    // Verify teacher exists and is a teacher
    const teacher = await executeQuery(
      'SELECT t.id, t.user_id, u.role FROM teachers t JOIN users u ON t.user_id = u.id WHERE t.id = ? AND u.role = "TEACHER"',
      [teacherId]
    )

    if (teacher.length === 0) {
      return NextResponse.json({ error: 'المعلم غير موجود' }, { status: 404 })
    }

    const teacherUserId = teacher[0].user_id

    // Check if assignment already exists
    const existingAssignment = await executeQuery(
      'SELECT id FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
      [teacherId, studentRecordId]
    )

    if (existingAssignment.length > 0) {
      return NextResponse.json({ error: 'الطالب مسند بالفعل لهذا المعلم' }, { status: 400 })
    }

    // Create the assignment
    console.log('🔍 Creating teacher-student assignment:', { teacherId, studentRecordId, studentEmail })
    const result = await executeUpdate(
      'INSERT INTO teacher_students (id, teacher_id, student_id, assigned_at) VALUES (UUID(), ?, ?, CURRENT_TIMESTAMP)',
      [teacherId, studentRecordId]
    )
    console.log('🔍 Assignment created successfully:', result)

    // Create notifications for both teacher and student
    try {
      // Notify teacher about new student
      await createNotificationFromTemplate(
        teacherUserId,
        notificationTemplates.teacher.newStudent(studentEmail)
      )

      // Notify student about being assigned to teacher
      await createNotificationFromTemplate(
        studentId,
        notificationTemplates.student.welcome(studentEmail)
      )
    } catch (notificationError) {
      console.error('Error creating notifications:', notificationError)
      // Don't fail the assignment if notifications fail
    }

    return NextResponse.json({
      message: 'تم إسناد الطالب للمعلم بنجاح'
    })

  } catch (error) {
    console.error('❌ Error assigning teacher:', error)
    return NextResponse.json(
      { error: 'فشل في إسناد الطالب للمعلم' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const teacherId = searchParams.get('teacherId')

    if (!studentId || !teacherId) {
      return NextResponse.json({ error: 'معرف الطالب والمعلم مطلوبان' }, { status: 400 })
    }

    // Get student record ID from user ID
    const student = await executeQuery(
      'SELECT s.id as student_record_id FROM students s WHERE s.user_id = ?',
      [studentId]
    )

    if (student.length === 0) {
      return NextResponse.json({ error: 'الطالب غير موجود' }, { status: 404 })
    }

    const studentRecordId = student[0].student_record_id

    // Remove the assignment
    const result = await executeUpdate(
      'DELETE FROM teacher_students WHERE teacher_id = ? AND student_id = ?',
      [teacherId, studentRecordId]
    )

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'الإسناد غير موجود' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'تم إلغاء إسناد الطالب بنجاح'
    })

  } catch (error) {
    console.error('❌ Error removing teacher assignment:', error)
    return NextResponse.json(
      { error: 'فشل في إلغاء إسناد الطالب' },
      { status: 500 }
    )
  }
}
