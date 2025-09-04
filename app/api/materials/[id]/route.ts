import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-server'
import { executeUpdate, executeQuery } from '@/lib/db'
import { unlink } from 'fs/promises'
import { join } from 'path'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'غير مصرح لك بتعديل المحتوى التعليمي' },
        { status: 403 }
      )
    }

    const materialId = params.id
    const { title, kind } = await request.json()

    if (!title || !kind) {
      return NextResponse.json(
        { message: 'العنوان والنوع مطلوبان' },
        { status: 400 }
      )
    }

    // Update the material
    const result = await executeUpdate(
      'UPDATE materials SET title = ?, kind = ? WHERE id = ?',
      [title, kind, materialId]
    )

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: 'المحتوى التعليمي غير موجود' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'تم تحديث المحتوى التعليمي بنجاح'
    })

  } catch (error) {
    console.error('Error updating material:', error)
    return NextResponse.json(
      { message: 'حدث خطأ في تحديث المحتوى التعليمي' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'غير مصرح لك بحذف المحتوى التعليمي' },
        { status: 403 }
      )
    }

    const materialId = params.id

    // Get material details to delete files
    const materials = await executeQuery(
      'SELECT file_url FROM materials WHERE id = ?',
      [materialId]
    )

    if (materials.length === 0) {
      return NextResponse.json(
        { message: 'المحتوى التعليمي غير موجود' },
        { status: 404 }
      )
    }

    const material = materials[0]

    // Delete the material from database
    const result = await executeUpdate(
      'DELETE FROM materials WHERE id = ?',
      [materialId]
    )

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { message: 'المحتوى التعليمي غير موجود' },
        { status: 404 }
      )
    }

    // Try to delete physical files (optional - don't fail if files don't exist)
    try {
      if (material.file_url) {
        const fileUrls = JSON.parse(material.file_url)
        for (const fileName of fileUrls) {
          const filePath = join(process.cwd(), 'uploads', 'materials', fileName)
          await unlink(filePath).catch(() => {
            // Ignore file deletion errors
          })
        }
      }
    } catch (fileError) {
      console.warn('Could not delete material files:', fileError)
    }

    return NextResponse.json({
      message: 'تم حذف المحتوى التعليمي بنجاح'
    })

  } catch (error) {
    console.error('Error deleting material:', error)
    return NextResponse.json(
      { message: 'حدث خطأ في حذف المحتوى التعليمي' },
      { status: 500 }
    )
  }
}
