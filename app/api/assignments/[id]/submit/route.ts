import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-server';
import { executeUpdate, executeQuerySingle } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'STUDENT') {
      return NextResponse.json(
        { message: 'غير مصرح لك بتسليم الواجبات' },
        { status: 403 }
      );
    }

    const assignmentId = params.id;
    
    // Check if assignment exists and student can submit
    const assignment = await executeQuerySingle(
      `SELECT a.*, s.id as student_id 
       FROM assignments a
       JOIN students s ON s.user_id = ?
       JOIN teacher_students ts ON ts.student_id = s.id AND ts.teacher_id = a.teacher_id
       WHERE a.id = ?`,
      [user.id, assignmentId]
    );

    if (!assignment) {
      return NextResponse.json(
        { message: 'الواجب غير موجود أو غير مسموح لك بتسليمه' },
        { status: 404 }
      );
    }

    // Check if already submitted
    const existingSubmission = await executeQuerySingle(
      'SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?',
      [assignmentId, assignment.student_id]
    );

    if (existingSubmission) {
      return NextResponse.json(
        { message: 'لقد قمت بتسليم هذا الواجب مسبقاً' },
        { status: 400 }
      );
    }

    let notes = '';
    let audio_url = '';
    let audioBlob: Blob | null = null;

    try {
      // Try to parse as FormData first (for file uploads)
      const contentType = request.headers.get('content-type');
      
      if (contentType && contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        notes = (formData.get('notes') as string) || '';
        
        // Handle audio file upload
        const audioFile = formData.get('audio') as File;
        if (audioFile && audioFile.size > 0) {
          audioBlob = audioFile;
          // For Vercel, we'll store the audio as base64 in the database
          const arrayBuffer = await audioFile.arrayBuffer();
          const base64Audio = Buffer.from(arrayBuffer).toString('base64');
          audio_url = `data:${audioFile.type};base64,${base64Audio}`;
        } else {
          audio_url = (formData.get('audio_url') as string) || '';
        }
      } else {
        // Try to parse as JSON
        const jsonData = await request.json();
        notes = jsonData.notes || '';
        audio_url = jsonData.audio_url || '';
      }
    } catch (error) {
      console.error('Error parsing request data:', error);
      return NextResponse.json(
        { message: 'خطأ في تحليل البيانات المرسلة' },
        { status: 400 }
      );
    }

    if (!notes && !audio_url) {
      return NextResponse.json(
        { message: 'يجب إضافة ملاحظات أو رابط صوتي' },
        { status: 400 }
      );
    }

    // Generate unique filename for reference
    const fileName = `submission_${uuidv4()}.txt`;

    // Save submission to database
    const submissionId = uuidv4();
    await executeUpdate(
      `INSERT INTO submissions (id, assignment_id, student_id, content, file_url, submitted_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [submissionId, assignmentId, assignment.student_id, notes || '', audio_url || fileName]
    );

    // Add student to assignment_targets if not already there
    try {
      await executeUpdate(
        `INSERT IGNORE INTO assignment_targets (assignment_id, student_id) VALUES (?, ?)`,
        [assignmentId, assignment.student_id]
      );
    } catch (error) {
      console.log('Student already in assignment_targets or error adding:', error);
    }

    return NextResponse.json({
      message: 'تم تسليم الواجب بنجاح',
      submissionId,
      fileName
    });

  } catch (error) {
    console.error('Assignment submission error:', error);
    return NextResponse.json(
      { message: 'حدث خطأ في تسليم الواجب' },
      { status: 500 }
    );
  }
}
