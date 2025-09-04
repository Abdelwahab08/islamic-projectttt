import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { executeQuery } from '@/config/database';
import { generateToken } from '@/lib/auth-server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني وكلمة المرور مطلوبان' },
        { status: 400 }
      );
    }

    // Direct query instead of using v_user_access view
    const query = `
      SELECT 
        u.id,
        u.email,
        u.password_hash,
        u.role,
        u.is_approved,
        u.onboarding_status,
        CASE 
          WHEN u.role = 'ADMIN' THEN '/dashboard/admin'
          WHEN u.role = 'TEACHER' AND u.is_approved = 1 THEN '/dashboard/teacher'
          WHEN u.role = 'TEACHER' AND u.is_approved = 0 THEN '/auth/awaiting-approval?type=teacher'
          WHEN u.role = 'STUDENT' AND u.is_approved = 1 THEN '/dashboard/student'
          WHEN u.role = 'STUDENT' AND u.is_approved = 0 THEN '/auth/awaiting-approval?type=student'
          WHEN u.role = 'ACADEMIC_MOD' THEN '/dashboard/admin'
          ELSE '/'
        END AS redirect_path,
        CASE 
          WHEN u.role = 'ADMIN' THEN 'المدير'
          WHEN u.role = 'TEACHER' THEN 'المعلم'
          WHEN u.role = 'STUDENT' THEN 'الطالب'
          WHEN u.role = 'ACADEMIC_MOD' THEN 'المشرف الأكاديمي'
          ELSE 'مستخدم'
        END AS role_name_ar
      FROM users u
      WHERE u.email = ?
    `;

    const result = await executeQuery(query, [email]);
    
    if (!result || !Array.isArray(result) || result.length === 0) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    const user = result[0];

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    // Check if user is approved
    if (!user.is_approved) {
      return NextResponse.json(
        { 
          error: 'طلبك قيد المراجعة من قبل الإدارة. سيتم إعلامك بالنتيجة قريباً.',
          type: 'pending_approval',
          role: user.role
        },
        { status: 403 }
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      role: user.role,
      email: user.email
    });

    // Create response with cookie
    const response = NextResponse.json({
      message: 'تم تسجيل الدخول بنجاح',
      redirect: user.redirect_path,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        roleNameAr: user.role_name_ar,
        redirectPath: user.redirect_path
      }
    });

    // Set auth cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });
    
    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في السيرفر' },
      { status: 500 }
    );
  }
}
