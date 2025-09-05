import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth-server'
import { executeQuery } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    
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

    const meetingsQuery = `
      SELECT 
        m.id,
        m.title,
        m.scheduled_at,
        m.duration_minutes,
        m.provider,
        m.join_url,
        m.record,
        m.recording_url,
        m.status,
        g.name as group_name,
        st.name_ar as stage_name
      FROM meetings m
      JOIN teachers t ON m.teacher_id = t.id
      LEFT JOIN \`groups\` g ON m.group_id = g.id
      LEFT JOIN stages st ON m.level_stage_id = st.id
      WHERE t.user_id = ?
      ORDER BY m.scheduled_at DESC
    `

    const meetings = await executeQuery(meetingsQuery, [teacherId])
    console.log('🔍 Teacher Meetings - Raw meetings data:', meetings)

    const transformedMeetings = meetings.map((meeting: any) => ({
      id: meeting.id,
      title: meeting.title,
      description: `اجتماع ${meeting.provider} ${meeting.group_name ? `للمجموعة ${meeting.group_name}` : ''}`,
      date: meeting.scheduled_at,
      time: new Date(meeting.scheduled_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      duration: meeting.duration_minutes,
      meeting_type: meeting.provider || 'غير محدد',
      max_participants: 50, // Default value
      current_participants: 0, // Default value
      status: meeting.status || 'scheduled',
      join_url: meeting.join_url,
      group_name: meeting.group_name || 'غير محدد',
      stage_name: meeting.stage_name || 'غير محدد'
    }))

    return NextResponse.json({
      meetings: transformedMeetings,
      total: transformedMeetings.length
    })

  } catch (error) {
    console.error('Error fetching teacher meetings:', error)
    return NextResponse.json(
      { error: 'فشل في تحميل الاجتماعات' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request)
    
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

    const body = await request.json()
    const { title, description, date, time, duration, meeting_type, group_id, stage_id } = body

    console.log('🔍 Meeting Creation - Request body:', body)
    console.log('🔍 Meeting Creation - Group ID:', group_id)
    console.log('🔍 Meeting Creation - Stage ID:', stage_id)

    if (!title || !date || !time || !duration) {
      return NextResponse.json({ error: 'جميع الحقول مطلوبة' }, { status: 400 })
    }

    // Combine date and time
    const scheduledAt = new Date(`${date}T${time}`)
    
    // Generate join URL (placeholder for now)
    const joinUrl = `https://meet.google.com/${uuidv4().replace(/-/g, '').substring(0, 12)}`

    // Save to database
    const meetingId = uuidv4()
    console.log('🔍 Meeting Creation - Saving to database:', {
      meetingId,
      teacherRecordId,
      meeting_type: meeting_type || 'AGORA',
      title,
      scheduledAt,
      duration,
      stage_id: stage_id || null,
      group_id: group_id || null,
      joinUrl
    })
    
    const result = await executeQuery(`
      INSERT INTO meetings (id, teacher_id, provider, title, scheduled_at, duration_minutes, level_stage_id, group_id, join_url, record)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `, [
      meetingId,
      teacherRecordId,
      meeting_type || 'AGORA',
      title,
      scheduledAt,
      duration,
      stage_id || null,
      group_id || null,
      joinUrl
    ])
    
    console.log('🔍 Meeting Creation - Database result:', result)

    return NextResponse.json({
      message: 'تم إنشاء الاجتماع بنجاح',
      meeting: {
        id: meetingId,
        title,
        scheduled_at: scheduledAt,
        duration_minutes: duration,
        join_url: joinUrl
      }
    })

  } catch (error) {
    console.error('Error creating meeting:', error)
    return NextResponse.json(
      { error: 'فشل في إنشاء الاجتماع' },
      { status: 500 }
    )
  }
}
