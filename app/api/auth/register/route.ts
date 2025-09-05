import { NextRequest, NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth-server'
import { executeQuerySingle, executeUpdate } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const { email, password, role } = await request.json()

    if (!email || !password || !role) {
      return NextResponse.json(
        { message: 'جميع الحقول مطلوبة' },
        { status: 400 }
      )
    }

    if (role !== 'STUDENT') {
      return NextResponse.json(
        { message: 'نوع المستخدم غير صحيح' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingUser = await executeQuerySingle(
      'SELECT id FROM users WHERE email = ?',
      [email]
    )

    if (existingUser) {
      return NextResponse.json(
        { message: 'البريد الإلكتروني مستخدم بالفعل' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create user
    const userId = uuidv4()
    await executeUpdate(
      'INSERT INTO users (id, role, email, password_hash, is_approved, onboarding_status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, role, email, passwordHash, 0, 'PENDING']
    )

    // Get the RASHIDI stage (اتقان لغتي الرشيدي)
    const rashidiStage = await executeQuerySingle(
      'SELECT id FROM stages WHERE code = ? LIMIT 1',
      ['RASHIDI']
    )

    // Create student record with RASHIDI stage
    const studentId = uuidv4()
    await executeUpdate(
      'INSERT INTO students (id, user_id, current_stage_id, current_page) VALUES (?, ?, ?, ?)',
      [studentId, userId, rashidiStage?.id || null, 1]
    )

    return NextResponse.json({
      message: 'تم التسجيل بنجاح',
      userId: userId,
    })

  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { message: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}
