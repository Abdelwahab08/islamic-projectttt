'use client'

import DashboardLayout from '@/app/components/DashboardLayout'
import { MessageSquare } from 'lucide-react'

export default function ChatPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">الشات</h1>
          <p className="text-muted">التواصل مع الطلاب والمعلمين</p>
        </div>

        <div className="card">
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-600 mb-2">قريباً</h2>
            <p className="text-muted">صفحة الشات قيد التطوير</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
