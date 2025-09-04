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
    const certificateData = {
      studentName: certificate.student_name || certificate.student_email,
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
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .certificate { 
            border: 5px solid #2c5530; 
            padding: 40px; 
            margin: 20px; 
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            max-width: 800px;
            width: 100%;
          }
          .title { 
            font-size: 32px; 
            color: #2c5530; 
            margin-bottom: 30px; 
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
          }
          .content { 
            font-size: 20px; 
            margin: 20px 0; 
            line-height: 1.6;
            color: #333;
          }
          .signature { 
            margin-top: 50px; 
            border-top: 2px solid #2c5530;
            padding-top: 20px;
          }
          .signature div {
            margin: 10px 0;
            font-size: 18px;
            color: #555;
          }
          .serial {
            position: absolute;
            top: 20px;
            right: 20px;
            font-size: 14px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="serial">رقم الشهادة: ${certificate.serial || certificate.id}</div>
          <div class="title">🏆 شهادة إنجاز 🏆</div>
          <div class="content">نشهد نحن إدارة المعهد الإسلامي</div>
          <div class="content">بأن الطالب المتميز:</div>
          <div class="content" style="font-size: 24px; font-weight: bold; color: #2c5530; margin: 30px 0;">
            ${certificateData.studentName}
          </div>
          <div class="content">قد أتم بنجاح مرحلة:</div>
          <div class="content" style="font-size: 22px; font-weight: bold; color: #2c5530;">
            ${certificateData.stageName}
          </div>
          <div class="content">بتقدير: ${certificateData.grade || 'ممتاز'}</div>
          <div class="content">في تاريخ: ${certificateData.completionDate}</div>
          <div class="signature">
            <div>المدرس المشرف: ${certificateData.teacherName}</div>
            <div>رئيس المعهد: مدير المعهد الإسلامي</div>
            <div style="margin-top: 20px; font-size: 16px; color: #888;">
              تم إصدار هذه الشهادة إلكترونياً
            </div>
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
        'Content-Disposition': `attachment; filename="certificate-${certificate.serial || certificate.id}.html"`,
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
