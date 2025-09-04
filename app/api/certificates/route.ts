import { NextRequest, NextResponse } from 'next/server'
import { executeQuery, executeUpdate } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-server'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 401 })
    }

    let certificates
    if (user.role === 'STUDENT') {
      // Get student certificates
      const student = await executeQuery(
        'SELECT id FROM students WHERE user_id = ?',
        [user.id]
      )
      
      if (!student.length) {
        return NextResponse.json({ message: 'لم يتم العثور على بيانات الطالب' }, { status: 404 })
      }

      certificates = await executeQuery(`
        SELECT 
          c.id,
          CONCAT('شهادة رقم ', c.serial) as title,
          CONCAT('شهادة إتمام المرحلة - ', st.name_ar) as description,
          c.status,
          c.issued_at as created_at,
          c.approved_at,
          u.email as teacher_name,
          c.pdf_url as file_path
        FROM certificates c
        JOIN teachers t ON c.teacher_id = t.id
        JOIN users u ON t.user_id = u.id
        JOIN stages st ON c.stage_id = st.id
        WHERE c.student_id = ?
        ORDER BY c.issued_at DESC
      `, [student[0].id])
    } else if (user.role === 'TEACHER') {
      // Get teacher's issued certificates
      const teacher = await executeQuery(
        'SELECT id FROM teachers WHERE user_id = ?',
        [user.id]
      )
      
      if (!teacher.length) {
        return NextResponse.json({ message: 'لم يتم العثور على بيانات المعلم' }, { status: 404 })
      }

      certificates = await executeQuery(`
        SELECT 
          c.id,
          CONCAT('شهادة رقم ', c.serial) as title,
          CONCAT('شهادة إتمام المرحلة - ', st.name_ar) as description,
          c.status,
          c.issued_at as created_at,
          c.approved_at,
          su.email as student_name,
          c.pdf_url as file_path
        FROM certificates c
        JOIN students s ON c.student_id = s.id
        JOIN users su ON s.user_id = su.id
        JOIN stages st ON c.stage_id = st.id
        WHERE c.teacher_id = ?
        ORDER BY c.issued_at DESC
      `, [teacher[0].id])
    } else if (user.role === 'ADMIN') {
      // Get all certificates for admin
      certificates = await executeQuery(`
        SELECT 
          c.id,
          CONCAT('شهادة رقم ', c.serial) as title,
          CONCAT('شهادة إتمام المرحلة - ', st.name_ar) as description,
          c.status,
          c.issued_at as created_at,
          c.approved_at,
          su.email as student_name,
          tu.email as teacher_name,
          c.pdf_url as file_path
        FROM certificates c
        JOIN students s ON c.student_id = s.id
        JOIN users su ON s.user_id = su.id
        JOIN teachers t ON c.teacher_id = t.id
        JOIN users tu ON t.user_id = tu.id
        JOIN stages st ON c.stage_id = st.id
        ORDER BY c.issued_at DESC
      `)
    } else {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 403 })
    }

    return NextResponse.json(certificates)

  } catch (error) {
    console.error('Certificates error:', error)
    return NextResponse.json(
      { message: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'TEACHER') {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 401 })
    }

    const body = await request.json()
    const { student_id, stage_id, grade } = body

    // Get teacher ID
    const teacher = await executeQuery(
      'SELECT id FROM teachers WHERE user_id = ?',
      [user.id]
    )

    if (!teacher.length) {
      return NextResponse.json({ message: 'لم يتم العثور على بيانات المعلم' }, { status: 404 })
    }

    const certificateId = uuidv4()

    // Get next serial number
    const serialResult = await executeQuery(
      'SELECT COALESCE(MAX(serial), 0) + 1 as next_serial FROM certificates'
    )
    const serial = serialResult[0].next_serial

    await executeUpdate(`
      INSERT INTO certificates (id, serial, student_id, teacher_id, stage_id, grade, issued_at, status)
      VALUES (?, ?, ?, ?, ?, ?, NOW(), 'PENDING')
    `, [certificateId, serial, student_id, teacher[0].id, stage_id, grade])

    return NextResponse.json({ 
      message: 'تم إصدار الشهادة بنجاح',
      id: certificateId,
      serial: serial
    })

  } catch (error) {
    console.error('Create certificate error:', error)
    return NextResponse.json(
      { message: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}
