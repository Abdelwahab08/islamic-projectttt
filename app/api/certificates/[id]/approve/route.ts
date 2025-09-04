import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth-server';
import { executeUpdate, executeQuerySingle } from '@/lib/db';
import { generateCertificatePDF, formatDate } from '@/lib/certificate-generator';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'غير مصرح لك بالموافقة على الشهادات' },
        { status: 403 }
      );
    }

    const certificateId = params.id;

    // Get certificate details
    const certificate = await executeQuerySingle(`
      SELECT 
        c.*,
        su.email as student_email,
        tu.email as teacher_email,
        st.name_ar as stage_name
      FROM certificates c
      JOIN students s ON c.student_id = s.id
      JOIN users su ON s.user_id = su.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users tu ON t.user_id = tu.id
      JOIN stages st ON c.stage_id = st.id
      WHERE c.id = ?
    `, [certificateId]);

    if (!certificate) {
      return NextResponse.json(
        { message: 'الشهادة غير موجودة' },
        { status: 404 }
      );
    }

    if (certificate.status === 'APPROVED') {
      return NextResponse.json(
        { message: 'تم الموافقة على هذه الشهادة مسبقاً' },
        { status: 400 }
      );
    }

    // Generate HTML certificate
    const certificateData = {
      studentName: certificate.student_email,
      teacherName: certificate.teacher_email,
      stageName: certificate.stage_name,
      completionDate: formatDate(new Date()),
      certificateId: certificate.id,
      quranPortion: `مرحلة ${certificate.stage_name}`
    };

    // Generate HTML certificate (skip PDF generation for now due to Puppeteer issues)
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>شهادة إنجاز</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
          .certificate { border: 3px solid #2c5530; padding: 30px; margin: 20px; }
          .title { font-size: 24px; color: #2c5530; margin-bottom: 20px; }
          .content { font-size: 18px; margin: 15px 0; }
          .signature { margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="certificate">
          <div class="title">شهادة إنجاز</div>
          <div class="content">هذه شهادة تثبت إنجاز الطالب: ${certificateData.studentName}</div>
          <div class="content">في مرحلة: ${certificateData.stageName}</div>
          <div class="content">بتاريخ: ${certificateData.completionDate}</div>
          <div class="signature">
            <div>المدرس: ${certificateData.teacherName}</div>
            <div>رقم الشهادة: ${certificateData.certificateId}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    // For Vercel serverless environment, we'll store the certificate data in the database
    // instead of creating files on the filesystem
    const fileName = `certificate_${certificate.id}.html`;
    
    // Store the HTML content in the database or return it directly
    // For now, we'll just use the filename without creating the actual file

    // Update certificate status
    await executeUpdate(`
      UPDATE certificates 
      SET status = 'APPROVED', 
          approved_at = NOW(),
          pdf_url = ?
      WHERE id = ?
    `, [fileName, certificateId]);

    return NextResponse.json({
      message: 'تم الموافقة على الشهادة بنجاح',
      certificateId,
      fileName,
      htmlContent: htmlContent,
      certificateData: certificateData
    });

  } catch (error) {
    console.error('Certificate approval error:', error);
    return NextResponse.json(
      { message: 'حدث خطأ في الموافقة على الشهادة' },
      { status: 500 }
    );
  }
}

