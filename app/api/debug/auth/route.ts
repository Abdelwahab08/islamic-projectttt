import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debug: Testing getCurrentUser in API route...')
    
    // Test 1: Check if we can access cookies
    console.log('🔍 Debug: Checking cookies...')
    const cookieStore = await import('next/headers').then(m => m.cookies())
    const token = cookieStore.get('auth-token')?.value
    console.log('🔍 Debug: Token from cookies:', token ? 'exists' : 'not found')
    
    // Test 2: Try getCurrentUser
    console.log('🔍 Debug: Calling getCurrentUser...')
    const user = await getCurrentUser()
    console.log('🔍 Debug: getCurrentUser result:', user ? 'success' : 'failed')
    
    if (user) {
      console.log('🔍 Debug: User details:', {
        id: user.id,
        email: user.email,
        role: user.role,
        is_approved: user.is_approved,
        onboarding_status: user.onboarding_status
      })
    }
    
    return NextResponse.json({
      success: true,
      hasToken: !!token,
      hasUser: !!user,
      user: user ? {
        id: user.id,
        email: user.email,
        role: user.role,
        is_approved: user.is_approved,
        onboarding_status: user.onboarding_status
      } : null,
      message: 'Debug successful'
    })
    
  } catch (error) {
    console.error('🔍 Debug: Error in auth debug:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      message: 'Debug failed'
    }, { status: 500 })
  }
}
