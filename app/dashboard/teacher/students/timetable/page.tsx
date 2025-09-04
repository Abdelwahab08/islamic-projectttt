'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/app/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Calendar, 
  Download, 
  Printer, 
  RefreshCw, 
  User,
  ChevronRight,
  ChevronLeft,
  Info
} from 'lucide-react'
import { 
  getCurrentWeek, 
  getPreviousWeek, 
  getNextWeek, 
  getWeekDays, 
  formatWeekDay, 
  formatDateForAPI,
  getWeekLabel
} from '@/lib/dates'
import TimetableFilters from './components/TimetableFilters'
import TimetableGrid from './components/TimetableGrid'
import RateDrawer from './components/RateDrawer'
import toast from 'react-hot-toast'

interface Student {
  id: string
  name: string
  current_stage_name: string
  current_page: number
  current_stage_id?: string
}

interface Entry {
  rating: string
  page_number: number
  notes?: string
}

interface TimetableData {
  days: string[]
  students: Student[]
  entries: { [studentId: string]: { [date: string]: Entry } }
}

export default function TimetablePage() {
  const [data, setData] = useState<TimetableData | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeek())
  const [filters, setFilters] = useState({
    stage_id: '',
    group_id: ''
  })
  const [selectedCell, setSelectedCell] = useState<{
    student: Student
    date: string
    entry?: Entry
  } | null>(null)
  const [showRateDrawer, setShowRateDrawer] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        from: formatDateForAPI(currentWeek.start),
        to: formatDateForAPI(currentWeek.end),
        ...(filters.stage_id && { stage_id: filters.stage_id }),
        ...(filters.group_id && { group_id: filters.group_id })
      })

      const response = await fetch(`/api/teacher/students/timetable?${params}`)
      if (response.ok) {
        const result = await response.json()
        console.log('📊 Timetable data received:', result)
        console.log('📅 Days:', result.days)
        console.log('👨‍🎓 Students:', result.students.length)
        console.log('📝 Entries:', result.entries)
        setData(result)
      } else {
        toast.error('فشل في تحميل البيانات')
      }
    } catch (error) {
      console.error('Error fetching timetable:', error)
      toast.error('حدث خطأ في تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentWeek, filters])

  const handleWeekChange = (direction: 'prev' | 'next' | 'current') => {
    switch (direction) {
      case 'prev':
        setCurrentWeek(getPreviousWeek())
        break
      case 'next':
        setCurrentWeek(getNextWeek())
        break
      case 'current':
        setCurrentWeek(getCurrentWeek())
        break
    }
  }

  const handleCellClick = (student: Student, date: string, entry?: Entry) => {
    setSelectedCell({ student, date, entry })
    setShowRateDrawer(true)
  }

  const handleRateSubmit = async (ratingData: any) => {
    try {
      const response = await fetch('/api/teacher/students/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ratingData)
      })

      if (response.ok) {
        const result = await response.json()
        toast.success('تم تسجيل التقييم بنجاح')
        
        // Close the drawer first
        setShowRateDrawer(false)
        
        // Refresh the data completely to ensure we get the latest data
        await fetchData()
        
      } else {
        const error = await response.json()
        toast.error(error.message || 'فشل في تسجيل التقييم')
      }
    } catch (error) {
      console.error('Error submitting rating:', error)
      toast.error('حدث خطأ في تسجيل التقييم')
    }
  }

  const handleExportCSV = async () => {
    try {
      const params = new URLSearchParams({
        from: formatDateForAPI(currentWeek.start),
        to: formatDateForAPI(currentWeek.end),
        ...(filters.stage_id && { stage_id: filters.stage_id }),
        ...(filters.group_id && { group_id: filters.group_id })
      })

      const response = await fetch(`/api/teacher/students/timetable/export?${params}`)
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `timetable-${formatDateForAPI(currentWeek.start)}-${formatDateForAPI(currentWeek.end)}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('تم تصدير البيانات بنجاح')
      } else {
        toast.error('فشل في تصدير البيانات')
      }
    } catch (error) {
      console.error('Error exporting CSV:', error)
      toast.error('حدث خطأ في تصدير البيانات')
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-2">جدول متابعة الطلاب الأسبوعي</h1>
            <p className="text-muted">متابعة تقدم الطلاب وتقييمهم اليومي</p>
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="spinner"></div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary mb-2">جدول متابعة الطلاب الأسبوعي</h1>
          <p className="text-muted">متابعة تقدم الطلاب وتقييمهم اليومي</p>
        </div>

        {/* Filters */}
        <TimetableFilters
          filters={filters}
          onFiltersChange={setFilters}
          currentWeek={currentWeek}
          onWeekChange={handleWeekChange}
          onRefresh={fetchData}
        />

        {/* Summary Stats */}
        {data && (
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{data.students.length}</div>
                  <div className="text-sm text-gray-600">إجمالي الطلاب</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {Object.values(data.entries).reduce((total: number, studentEntries: any) => 
                      total + Object.keys(studentEntries).length, 0
                    )}
                  </div>
                  <div className="text-sm text-gray-600">التقييمات المسجلة</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{data.days.length}</div>
                  <div className="text-sm text-gray-600">أيام الأسبوع</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {data.students.length * data.days.length - Object.values(data.entries).reduce((total: number, studentEntries: any) => 
                      total + Object.keys(studentEntries).length, 0
                    )}
                  </div>
                  <div className="text-sm text-gray-600">تقييمات مفقودة</div>
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-[#16a34a] text-white">متفوق/ممتاز (10)</Badge>
                <Badge className="bg-[#22c55e] text-white">جيد (9)</Badge>
                <Badge className="bg-[#f59e0b] text-white">إعادة</Badge>
                <Badge className="bg-[#ef4444] text-white">غياب</Badge>
                <Badge className="bg-[#2db1a1] text-white">إذن</Badge>
                                 <Badge className="bg-gray-100 text-gray-500">فارغ (لا يوجد)</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export/Print Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="w-4 h-4 ml-2" />
            تصدير CSV
          </Button>
          <Button onClick={handlePrint} variant="outline">
            <Printer className="w-4 h-4 ml-2" />
            طباعة PDF
          </Button>
        </div>

        {/* Timetable Grid */}
        {data && (
          <TimetableGrid
            data={data}
            onCellClick={handleCellClick}
          />
        )}

        {/* Rate Drawer */}
        {selectedCell && (
          <RateDrawer
            open={showRateDrawer}
            onOpenChange={setShowRateDrawer}
            student={selectedCell.student}
            date={selectedCell.date}
            entry={selectedCell.entry}
            onSubmit={handleRateSubmit}
          />
        )}
      </div>
    </DashboardLayout>
  )
}
