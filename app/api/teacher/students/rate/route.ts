import { NextRequest, NextResponse } from 'next/server'
import { executeQuery } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { student_id, date, stage_id, page_number, rating, notes } = body

    console.log('📥 Received rating data:', { student_id, date, stage_id, page_number, rating, notes })

    if (!student_id || !date || !rating) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    // Normalize the date to ensure consistent format - store as DATE without timezone
    const dateObj = new Date(date)
    // Extract just the date part (YYYY-MM-DD) without timezone conversion
    const normalizedDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`
    console.log('📅 Normalized date:', { original: date, normalized: normalizedDate, originalDate: dateObj })
    
    // Also log what we're actually sending to the database
    console.log('💾 Sending to database:', {
      student_id,
      date: normalizedDate,
      stage_id,
      page_number,
      rating,
      notes
    })

    // Check if rating already exists for this student and date
    const existingRating = await executeQuery(
      'SELECT id FROM student_ratings WHERE student_id = ? AND date = ?',
      [student_id, normalizedDate]
    )

    let result
    if (existingRating.length > 0) {
      console.log('🔄 Updating existing rating...')
      // Update existing rating
      await executeQuery(
        `UPDATE student_ratings 
         SET rating = ?, page_number = ?, notes = ?, updated_at = NOW()
         WHERE student_id = ? AND date = ?`,
        [rating, page_number, notes, student_id, normalizedDate]
      )
      
      result = await executeQuery(
        'SELECT * FROM student_ratings WHERE student_id = ? AND date = ?',
        [student_id, normalizedDate]
      )
    } else {
      console.log('➕ Inserting new rating...')
      // Insert new rating
      await executeQuery(
        `INSERT INTO student_ratings 
         (id, student_id, date, stage_id, page_number, rating, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [uuidv4(), student_id, normalizedDate, stage_id, page_number, rating, notes]
      )
      
      result = await executeQuery(
        'SELECT * FROM student_ratings WHERE student_id = ? AND date = ?',
        [student_id, normalizedDate]
      )
    }
    
    console.log('💾 Rating saved to database:', result[0])

    // Update student's current page and stage if rating is good
    if (rating === 'متفوق' || rating === 'ممتاز' || rating === 'جيد') {
      await executeQuery(
        `UPDATE students 
         SET current_page = ?, 
             current_stage_id = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [page_number, stage_id, student_id]
      )
    }

    // Get updated student data
    const student = await executeQuery(
      `SELECT s.*, st.name_ar as current_stage_name, 
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as name
       FROM students s
       LEFT JOIN stages st ON s.current_stage_id = st.id
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [student_id]
    )

    return NextResponse.json({
      entry: result[0],
      student: student[0]
    })

  } catch (error) {
    console.error('Error submitting rating:', error)
    return NextResponse.json(
      { error: 'فشل في تسجيل التقييم' },
      { status: 500 }
    )
  }
}
