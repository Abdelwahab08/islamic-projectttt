import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUserFromRequest } from '@/lib/auth-server'
import { executeQuery } from '@/lib/db'

// Helper (top-level, not inside a block) to query with a specific membership table
const fetchMeetingsWithMembershipTable = async (
  membershipTable: 'group_students' | 'group_members',
  studentId: string,
  currentStageId: string | null
) => {
  const sql = `
    SELECT DISTINCT
      m.id,
      m.title,
      m.description,
      m.scheduled_at,
      m.duration_minutes,
      m.provider AS meeting_type,
      m.status,
      m.join_url,
      u.email AS teacher_email,
      st.name_ar AS stage_name,
      g.name AS group_name
    FROM meetings m
    LEFT JOIN teachers t ON m.teacher_id = t.id
    LEFT JOIN users u ON t.user_id = u.id
    LEFT JOIN stages st ON m.level_stage_id = st.id
    LEFT JOIN \`groups\` g ON m.group_id = g.id
    LEFT JOIN ${membershipTable} gm ON m.group_id = gm.group_id
    WHERE (
      (m.group_id IS NOT NULL AND gm.student_id = ?)
      OR (m.level_stage_id IS NOT NULL AND m.level_stage_id = ?)
    )
    ORDER BY m.scheduled_at ASC
  `
  return await executeQuery(sql, [studentId, currentStageId])
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

    let meetings: any[] = []
    try {
      // Try group_students first
      meetings = await fetchMeetingsWithMembershipTable('group_students', studentId, currentStageId)
    } catch (err: any) {
      console.error('student/meetings: group_students failed, trying group_members…', err)
      try {
        meetings = await fetchMeetingsWithMembershipTable('group_members', studentId, currentStageId)
      } catch (err2) {
        console.error('student/meetings: group_members failed as well', err2)
        throw err2
      }
    }

    const transformedMeetings = meetings.map((meeting: any) => ({
      id: meeting.id,
      title: meeting.title,
      description: meeting.description,
      scheduledAt: meeting.scheduled_at,
      durationMinutes: meeting.duration_minutes,
      meetingType: meeting.meeting_type,
      status: meeting.status,
      joinUrl: meeting.join_url,
      createdAt: meeting.created_at,
      teacherEmail: meeting.teacher_email,
      stageName: meeting.stage_name,
      groupName: meeting.group_name
    }))

    return NextResponse.json({ meetings: transformedMeetings })

  } catch (error) {
    console.error('Error fetching student meetings:', error)
    return NextResponse.json(
      { message: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}
