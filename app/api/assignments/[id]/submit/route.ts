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
      console.log('🔍 DEBUG: Content-Type:', contentType);
      
      if (contentType && contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        notes = (formData.get('notes') as string) || '';
        
        // Handle audio file upload
        const audioFile = formData.get('audio') as File;
        console.log('🔍 DEBUG: Audio file:', audioFile ? { name: audioFile.name, size: audioFile.size, type: audioFile.type } : 'No audio file');
        
        if (audioFile && audioFile.size > 0) {
          audioBlob = audioFile;
          
          // For Vercel serverless, we need to handle audio files differently
          // Check file size first (Vercel has 4.5MB payload limit)
          if (audioFile.size > 2 * 1024 * 1024) { // 2MB limit for better compatibility
            console.log('🔍 DEBUG: Audio file too large for Vercel, storing reference only');
            audio_url = `audio_file_${uuidv4()}_${audioFile.name}`;
          } else {
            // For smaller files, try to store as base64
            const arrayBuffer = await audioFile.arrayBuffer();
            const base64Audio = Buffer.from(arrayBuffer).toString('base64');
            
            // Check if the base64 data is too large for database
            if (base64Audio.length > 50000) { // 50KB limit for better compatibility
              console.log('🔍 DEBUG: Base64 data too large for database, storing reference only');
              audio_url = `audio_file_${uuidv4()}_recording.webm`;
            } else {
              audio_url = `data:${audioFile.type};base64,${base64Audio}`;
              console.log('🔍 DEBUG: Created base64 audio URL, length:', audio_url.length);
            }
          }
        } else {
          audio_url = (formData.get('audio_url') as string) || '';
          console.log('🔍 DEBUG: Using provided audio_url:', audio_url ? 'Yes' : 'No');
        }
      } else {
        // Try to parse as JSON
        const jsonData = await request.json();
        notes = jsonData.notes || '';
        audio_url = jsonData.audio_url || '';
        console.log('🔍 DEBUG: JSON data:', { notes: notes ? 'Yes' : 'No', audio_url: audio_url ? 'Yes' : 'No' });
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
    
    // For large base64 audio data, we'll store it in audio_url and keep file_url as a reference
    const fileUrlForDb = audioBlob ? `audio_${submissionId}` : fileName;
    
    console.log('🔍 DEBUG: About to insert submission:', {
      submissionId,
      assignmentId,
      studentId: assignment.student_id,
      notes: notes || '',
      fileUrl: fileUrlForDb,
      audioUrl: audio_url || ''
    });
    
    try {
      await executeUpdate(
        `INSERT INTO submissions (id, assignment_id, student_id, content, file_url, audio_url, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [submissionId, assignmentId, assignment.student_id, notes || '', fileUrlForDb, audio_url || '']
      );
      console.log('🔍 DEBUG: Submission inserted successfully');
    } catch (dbError) {
      console.error('🔍 DEBUG: Database insertion error:', dbError);
      throw dbError;
    }

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
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      assignmentId: params.id
    });
    return NextResponse.json(
      { 
        message: 'حدث خطأ في تسليم الواجب',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
