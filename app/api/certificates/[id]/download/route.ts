import { NextRequest, NextResponse } from 'next/server';
import { executeQuery } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const certificateId = params.id;

    console.log('Fetching certificate with ID:', certificateId);
    
    // Get certificate with all related data
    const result = await executeQuery(`
      SELECT 
        c.id,
        c.serial,
        c.grade,
        c.issued_at,
        c.status,
        st.name_ar as stage_name,
        s.user_id as student_user_id,
        CONCAT(COALESCE(su.first_name, ''), ' ', COALESCE(su.last_name, '')) as student_name,
        su.first_name as student_first_name,
        su.last_name as student_last_name,
        su.email as student_email,
        t.user_id as teacher_user_id,
        tu.email as teacher_email
      FROM certificates c
      JOIN stages st ON c.stage_id = st.id
      JOIN students s ON c.student_id = s.id
      JOIN users su ON s.user_id = su.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users tu ON t.user_id = tu.id
      WHERE c.id = ? AND c.status = 'APPROVED'
    `, [certificateId]);
    
    console.log('Query result:', result);
    
    // Handle the result correctly - it might be an array or object
    const certificates = Array.isArray(result) ? result : [result];

    if (certificates.length === 0) {
      return NextResponse.json(
        { error: 'الشهادة غير موجودة أو غير معتمدة' },
        { status: 404 }
      );
    }

    console.log('Certificates found:', certificates.length);
    const certificate = certificates[0];
    
    if (!certificate) {
      console.error('Certificate is undefined');
      return NextResponse.json(
        { error: 'بيانات الشهادة غير صحيحة' },
        { status: 500 }
      );
    }
    
    console.log('Certificate data from database:', certificate);

    // Validate required fields
    if (!certificate.issued_at) {
      console.error('Certificate issued_at is missing');
      return NextResponse.json(
        { error: 'تاريخ الإصدار مفقود' },
        { status: 500 }
      );
    }

    if (!certificate.stage_name) {
      console.error('Certificate stage_name is missing');
      return NextResponse.json(
        { error: 'اسم المرحلة مفقود' },
        { status: 500 }
      );
    }

    // Format the completion date in Arabic
    const completionDate = new Date(certificate.issued_at).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Create certificate data object with all required fields
    // Build a robust student display name
    const first = (certificate.student_first_name || '').trim()
    const last = (certificate.student_last_name || '').trim()
    let studentDisplayName = `${first} ${last}`.trim()
    if (!studentDisplayName) {
      const email = (certificate.student_email || '').trim()
      const local = email.includes('@') ? email.split('@')[0] : email
      studentDisplayName = local.replace(/[._-]+/g, ' ').trim() || 'الطالب'
    }

    const certificateData = {
      studentName: studentDisplayName,
      teacherName: certificate.teacher_email,
      stageName: certificate.stage_name,
      completionDate: completionDate,
      certificateId: certificate.id,
      grade: certificate.grade,
      serial: certificate.serial
    };

    console.log('Certificate data being generated:', certificateData);

    // Generate HTML certificate (Vercel serverless doesn't support Puppeteer)
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>شهادة إنجاز</title>
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body { 
            font-family: 'Cairo', 'Amiri', Arial, sans-serif; 
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 25%, #cbd5e1 50%, #94a3b8 75%, #64748b 100%);
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            position: relative;
            overflow-x: hidden;
          }
          
          body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="rgba(0,0,0,0.05)"/><circle cx="75" cy="75" r="1" fill="rgba(0,0,0,0.05)"/><circle cx="50" cy="10" r="0.5" fill="rgba(0,0,0,0.03)"/><circle cx="10" cy="60" r="0.5" fill="rgba(0,0,0,0.03)"/><circle cx="90" cy="40" r="0.5" fill="rgba(0,0,0,0.03)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
            opacity: 0.4;
            pointer-events: none;
          }
          
          .certificate { 
            background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
            border: 4px solid #e2e8f0;
            padding: 60px 50px; 
            margin: 20px; 
            border-radius: 25px;
            box-shadow: 
              0 25px 50px rgba(0,0,0,0.1),
              0 0 0 1px rgba(255,255,255,0.8),
              inset 0 1px 0 rgba(255,255,255,0.9);
            max-width: 900px;
            width: 100%;
            position: relative;
          }
          
          
          .header {
            text-align: center;
            margin-bottom: 40px;
            position: relative;
          }
          
          .institute-name {
            font-size: 18px;
            color: #64748b;
            font-weight: 400;
            margin-bottom: 10px;
            letter-spacing: 2px;
          }
          
          .title { 
            font-size: 42px; 
            color: #1f2937; 
            margin-bottom: 15px; 
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(31, 41, 55, 0.1);
            position: relative;
            display: inline-block;
          }
          
          .title::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 100px;
            height: 3px;
            background: linear-gradient(90deg, #6b7280, #374151);
            border-radius: 2px;
          }
          
          .subtitle {
            font-size: 16px;
            color: #64748b;
            font-weight: 300;
            margin-top: 20px;
          }
          
          .content { 
            font-size: 20px; 
            margin: 25px 0; 
            line-height: 1.8;
            color: #334155;
            font-weight: 400;
          }
          
          .student-name {
            font-size: 28px;
            font-weight: 700;
            color: #1f2937;
            margin: 35px 0;
            padding: 20px;
            background: linear-gradient(135deg, rgba(107, 114, 128, 0.1) 0%, rgba(55, 65, 81, 0.1) 100%);
            border-radius: 15px;
            border: 2px solid rgba(107, 114, 128, 0.2);
            position: relative;
          }
          
          .student-name::before {
            content: '👤';
            position: absolute;
            right: 15px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 24px;
          }
          
          .stage-name {
            font-size: 24px;
            font-weight: 600;
            color: #374151;
            margin: 25px 0;
            padding: 15px 25px;
            background: linear-gradient(135deg, rgba(55, 65, 81, 0.1) 0%, rgba(31, 41, 55, 0.1) 100%);
            border-radius: 12px;
            border-right: 4px solid #6b7280;
            display: inline-block;
          }
          
          .grade {
            font-size: 22px;
            font-weight: 600;
            color: #059669;
            margin: 20px 0;
            padding: 12px 20px;
            background: linear-gradient(135deg, rgba(5, 150, 105, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%);
            border-radius: 10px;
            border: 2px solid rgba(5, 150, 105, 0.2);
            display: inline-block;
          }
          
          .date {
            font-size: 18px;
            color: #64748b;
            margin: 20px 0;
            font-weight: 400;
          }
          
          .signature { 
            margin-top: 60px; 
            border-top: 3px solid #e2e8f0;
            padding-top: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
          }
          
          .signature-item {
            text-align: center;
            flex: 1;
            min-width: 200px;
          }
          
          .signature-item div {
            margin: 8px 0;
            font-size: 16px;
            color: #475569;
            font-weight: 500;
          }
          
          .signature-item .role {
            font-size: 14px;
            color: #64748b;
            font-weight: 400;
            margin-bottom: 5px;
          }
          
          .signature-item .name {
            font-size: 18px;
            color: #374151;
            font-weight: 600;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 5px;
            display: inline-block;
            min-width: 150px;
          }
          
          .serial {
            position: absolute;
            top: 25px;
            right: 25px;
            font-size: 12px;
            color: #94a3b8;
            background: rgba(148, 163, 184, 0.1);
            padding: 8px 12px;
            border-radius: 8px;
            font-weight: 500;
          }
          
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 14px;
            color: #94a3b8;
            font-style: italic;
          }
          
          .decorative-border {
            position: absolute;
            top: 20px;
            left: 20px;
            right: 20px;
            bottom: 20px;
            border: 2px solid rgba(107, 114, 128, 0.1);
            border-radius: 20px;
            pointer-events: none;
          }
          
          @media print {
            body {
              background: white !important;
            }
            .certificate {
              box-shadow: none !important;
              border: 2px solid #374151 !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="decorative-border"></div>
          <div class="serial">رقم الشهادة: ${certificate.serial || certificate.id}</div>
          
          <div class="header">
            <div class="institute-name">منصة يقين</div>
            <div class="title">شهادة إنجاز</div>
            <div class="subtitle">Certificate of Achievement</div>
          </div>
          
          <div class="content">نشهد نحن إدارة منصة يقين</div>
          <div class="content">بأن الطالب المتميز والمجتهد:</div>
          
          <div class="student-name">${certificateData.studentName}</div>
          
          <div class="content">قد أتم بنجاح وتفوق مرحلة:</div>
          <div class="stage-name">${certificateData.stageName}</div>
          
          <div class="content">بتقدير:</div>
          <div class="grade">${certificateData.grade || 'ممتاز'}</div>
          
          <div class="content">في تاريخ:</div>
          <div class="date">${certificateData.completionDate}</div>
          
          <div class="signature">
            <div class="signature-item">
              <div class="role">المدرس المشرف</div>
              <div class="name">${certificateData.teacherName}</div>
            </div>
            <div class="signature-item">
              <div class="role">رئيس المنصة</div>
              <div class="name">مدير منصة يقين</div>
            </div>
          </div>
          
          <div class="footer">
            تم إصدار هذه الشهادة إلكترونياً ومؤمنة رقمياً
          </div>
        </div>
      </body>
      </html>
    `;

    // Return HTML content instead of PDF (Vercel serverless doesn't support Puppeteer)
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      },
    });

  } catch (error) {
    console.error('Error generating certificate PDF:', error);
    return NextResponse.json(
      { error: 'فشل في إنشاء الشهادة' },
      { status: 500 }
    );
  }
}
