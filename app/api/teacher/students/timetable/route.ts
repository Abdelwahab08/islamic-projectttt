import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { executeQuery } from '@/lib/db'
import { getWeekDays } from '@/lib/dates'
import { getCurrentUserFromRequest } from '@/lib/auth-server'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    console.log('🔍 Current user:', user ? { id: user.id, role: user.role, email: user.email } : 'No user')
    
    if (!user || user.role !== 'TEACHER') {
      return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
    }

    // First get the teacher record ID
    const teacherRecord = await executeQuery('SELECT id FROM teachers WHERE user_id = ?', [user.id])
    
    if (teacherRecord.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على بيانات المعلم' }, { status: 404 })
    }

    const teacherId = teacherRecord[0].id
    
    // Debug: Check teacher-student relationships
    const teacherStudentsCount = await executeQuery('SELECT COUNT(*) as count FROM teacher_students WHERE teacher_id = ?', [teacherId])
    console.log('🔍 Teacher ID:', teacherId, 'Assigned students count:', teacherStudentsCount[0]?.count || 0)
    
    // Debug: Check all teacher-student relationships
    const allTeacherStudents = await executeQuery('SELECT teacher_id, COUNT(*) as count FROM teacher_students GROUP BY teacher_id')
    console.log('🔍 All teacher-student relationships:', allTeacherStudents)

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const stage_id = searchParams.get('stage_id')
    const group_id = searchParams.get('group_id')

    if (!from || !to) {
      return NextResponse.json(
        { error: 'يجب تحديد تاريخ البداية والنهاية' },
        { status: 400 }
      )
    }

    // Get week days
    const days = getWeekDays(new Date(from), new Date(to))

    // Build the base query for students
    let studentsQuery = `
      SELECT DISTINCT
        s.id,
        CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as name,
        st.name_ar as current_stage_name,
        s.current_page,
        s.current_stage_id,
        u.first_name,
        u.last_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      LEFT JOIN stages st ON s.current_stage_id = st.id
      JOIN teacher_students ts ON s.id = ts.student_id
      WHERE ts.teacher_id = ?
    `

    const queryParams: any[] = [teacherId]

    // Add stage filter
    if (stage_id) {
      studentsQuery += ' AND s.current_stage_id = ?'
      queryParams.push(stage_id)
    }

    // Add group filter
    if (group_id) {
      studentsQuery += `
        AND s.id IN (
          SELECT student_id
          FROM group_students
          WHERE group_id = ?
        )
      `
      queryParams.push(group_id)
    }

    studentsQuery += ' ORDER BY u.first_name, u.last_name'

    const students = await executeQuery(studentsQuery, queryParams)
    console.log('🔍 Students query result:', students.length, 'students found')
    console.log('🔍 Sample students:', students.slice(0, 3))

    // Get entries for the date range
    let entries: any[] = []
    if (students.length > 0) {
      const entriesQuery = `
        SELECT
          student_id,
          DATE(date) as date,
          rating,
          page_number,
          notes
        FROM student_ratings
        WHERE DATE(date) BETWEEN ? AND ?
          AND student_id IN (${students.map(() => '?').join(',')})
      `
      
      // Alternative query if DATE() function has issues
      const alternativeQuery = `
        SELECT
          student_id,
          DATE(date) as date,
          rating,
          page_number,
          notes
        FROM student_ratings
        WHERE date >= ? AND date < DATE_ADD(?, INTERVAL 1 DAY)
          AND student_id IN (${students.map(() => '?').join(',')})
      `
      
      console.log('🔍 Query details:', {
        query: entriesQuery,
        alternativeQuery: alternativeQuery,
        from: from,
        to: to,
        studentIds: students.map((s: any) => s.id)
      })

      const entriesParams = [from, to, ...students.map((s: any) => s.id)]
      console.log('🔍 Fetching entries with params:', { from, to, studentIds: students.map((s: any) => s.id) })
      
      // Also check what's actually in the database for debugging
      const allRatings = await executeQuery('SELECT student_id, date, rating FROM student_ratings LIMIT 5')
      console.log('🔍 All ratings in database (sample):', allRatings)
      
      entries = await executeQuery(entriesQuery, entriesParams)
      console.log('📝 Entries found:', entries.length)
      if (entries.length > 0) {
        console.log('📝 Sample entries:', entries.slice(0, 3))
      }
    }

    // Organize entries by student and date
    const entriesMap: { [studentId: string]: { [date: string]: any } } = {}

    entries.forEach((entry: any) => {
      if (!entriesMap[entry.student_id]) {
        entriesMap[entry.student_id] = {}
      }
      
      // Ensure the date is in the correct format for frontend comparison
      const entryDate = entry.date instanceof Date ? entry.date.toISOString().split('T')[0] : String(entry.date)
      
      entriesMap[entry.student_id][entryDate] = {
        rating: entry.rating,
        page_number: entry.page_number,
        notes: entry.notes
      }
      
      console.log('📝 Processing entry:', {
        studentId: entry.student_id,
        originalDate: entry.date,
        processedDate: entryDate,
        rating: entry.rating
      })
    })
    
    console.log('🗺️ Final entries map:', entriesMap)

    const responseData = {
      days,
      students,
      entries: entriesMap
    }
    
    console.log('📤 Returning timetable data:', {
      daysCount: days.length,
      studentsCount: students.length,
      entriesCount: Object.keys(entriesMap).length,
      sampleEntries: Object.keys(entriesMap).slice(0, 2).map(studentId => ({
        studentId,
        dates: Object.keys(entriesMap[studentId] || {}),
        sampleEntry: entriesMap[studentId] ? Object.values(entriesMap[studentId])[0] : null
      }))
    })
    
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Error fetching timetable:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل بيانات الجدول' },
      { status: 500 }
    )
  }
}
