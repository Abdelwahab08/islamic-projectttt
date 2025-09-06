import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { executeQuery } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth-server'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'STUDENT') {
      return NextResponse.json({ message: 'غير مصرح' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Get student ID
    const student = await executeQuery(
      'SELECT id FROM students WHERE user_id = ?',
      [user.id]
    )

    if (!student.length) {
      return NextResponse.json({ message: 'لم يتم العثور على بيانات الطالب' }, { status: 404 })
    }

    const studentId = student[0].id

    // Workaround: fetch assignments and lessons separately to avoid UNION collation issues
    const assignmentsRaw = await executeQuery(`
      SELECT 
        a.id,
        a.title,
        a.description,
        DATE(a.created_at) as date,
        TIME(a.created_at) as time,
        60 as duration,
        u.email as teacher_name,
        CASE 
          WHEN a.created_at > NOW() THEN 'UPCOMING'
          WHEN a.created_at <= NOW() AND DATE_ADD(a.created_at, INTERVAL 7 DAY) >= NOW() THEN 'ONGOING'
          ELSE 'COMPLETED'
        END as status
      FROM assignments a
      JOIN teachers t ON CONVERT(a.teacher_id USING utf8mb4) = CONVERT(t.id USING utf8mb4)
      JOIN users u ON CONVERT(t.user_id USING utf8mb4) = CONVERT(u.id USING utf8mb4)
      JOIN teacher_students ts ON CONVERT(t.id USING utf8mb4) = CONVERT(ts.teacher_id USING utf8mb4)
      WHERE CONVERT(ts.student_id USING utf8mb4) = CONVERT(? USING utf8mb4)
      AND DATE(a.created_at) = ?
    `, [studentId, date])

    const lessonsRaw = await executeQuery(`
      SELECT 
        l.id,
        l.subject as title,
        COALESCE(g.name, '') as group_name,
        DATE(CONCAT(CURDATE(), ' ', l.start_time)) as date,
        TIME(l.start_time) as time,
        l.duration_minutes as duration,
        u.email as teacher_name
      FROM lessons l
      JOIN teachers t ON CONVERT(l.teacher_id USING utf8mb4) = CONVERT(t.id USING utf8mb4)
      JOIN users u ON CONVERT(t.user_id USING utf8mb4) = CONVERT(u.id USING utf8mb4)
      JOIN teacher_students ts ON CONVERT(t.id USING utf8mb4) = CONVERT(ts.teacher_id USING utf8mb4)
      LEFT JOIN \`groups\` g ON CONVERT(l.group_id USING utf8mb4) = CONVERT(g.id USING utf8mb4)
      WHERE CONVERT(ts.student_id USING utf8mb4) = CONVERT(? USING utf8mb4)
      AND DATE(CONCAT(CURDATE(), ' ', l.start_time)) = ?
    `, [studentId, date])

    const assignments = (assignmentsRaw as any[]).map((a) => ({
      type: 'ASSIGNMENT',
      id: a.id,
      title: a.title,
      description: a.description,
      date: a.date,
      time: a.time,
      duration: a.duration,
      teacher_name: a.teacher_name,
      status: a.status,
      location: null,
      meeting_url: null
    }))

    const lessons = (lessonsRaw as any[]).map((l) => ({
      type: 'LESSON',
      id: l.id,
      title: l.title,
      description: `حصة ${l.group_name || ''}`.trim(),
      date: l.date,
      time: l.time,
      duration: l.duration,
      teacher_name: l.teacher_name,
      status: (l.time > new Date().toTimeString().slice(0,5)) ? 'UPCOMING' : 'ONGOING',
      location: null,
      meeting_url: null
    }))

    const items = [...assignments, ...lessons].sort((a, b) => {
      const da = new Date(`${a.date}T${a.time}`)
      const db = new Date(`${b.date}T${b.time}`)
      return da.getTime() - db.getTime()
    })

    return NextResponse.json(items)

  } catch (error) {
    console.error('Schedule error:', error)
    return NextResponse.json(
      { message: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}
