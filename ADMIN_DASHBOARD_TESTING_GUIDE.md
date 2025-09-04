# Admin Dashboard Testing Guide

## 🚀 Deployment Status Check

**Wait 2-3 minutes after the latest deployment** before testing to ensure all changes are live.

## 🔐 Login Credentials
- **Email**: `admin@yaqeen.edu`
- **Password**: `admin123`

## 📋 Step-by-Step Testing Plan

### 1. **Login Test**
1. Go to your website: `https://islamic-projectttt-6x7wqdowe-abdelwahab.vercel.app/`
2. Click on "Login" or go to `/auth/login`
3. Enter credentials:
   - Email: `admin@yaqeen.edu`
   - Password: `admin123`
4. **Expected Result**: Should redirect to `/dashboard/admin`

### 2. **Admin Dashboard Main Page**
1. After login, you should see the admin dashboard
2. **Expected Result**: Dashboard loads without errors
3. **Check**: Look for any error messages or loading issues

### 3. **User Management Test** (المستخدمون والموافقات)
1. Click on "المستخدمون والموافقات" or go to `/dashboard/admin/users`
2. **Expected Result**: 
   - Page loads successfully
   - Shows list of users (teachers, students)
   - No 500 errors in browser console
3. **Test Actions**:
   - Try to approve a pending user
   - Try to reject a pending user
   - **Expected**: Actions should work without errors

### 4. **Reports Test** (التقارير العامة)
1. Click on "التقارير العامة" or go to `/dashboard/admin/reports`
2. **Expected Result**:
   - Page loads successfully
   - Shows statistics and charts
   - No "فشل في تحميل البيانات" error
3. **Test Actions**:
   - Try to download a report
   - **Expected**: Download should work

### 5. **Settings Test** (الإعدادات)
1. Click on "الإعدادات" or go to `/dashboard/admin/settings`
2. **Expected Result**:
   - Page loads successfully
   - Shows settings form
3. **Test Actions**:
   - Try to save settings
   - **Expected**: Should show "تم حفظ الإعدادات بنجاح"

### 6. **Certificate Approval Test** (الموافقة على الشهادة)
1. Go to certificates section
2. **Expected Result**:
   - Page loads successfully
   - Shows pending certificates
3. **Test Actions**:
   - Try to approve a certificate
   - **Expected**: Should work without 500 errors

## 🔍 Error Checking

### Browser Console Check
1. Open browser Developer Tools (F12)
2. Go to "Console" tab
3. Look for any red error messages
4. **Expected**: No 500 errors or authentication errors

### Network Tab Check
1. In Developer Tools, go to "Network" tab
2. Refresh the page
3. Look for any failed requests (red status codes)
4. **Expected**: All API calls should return 200 status

## 🚨 Common Issues & Solutions

### If you still see 500 errors:

1. **Check Deployment Status**:
   - Go to Vercel dashboard
   - Ensure latest deployment is complete
   - Wait 2-3 more minutes if still deploying

2. **Clear Browser Cache**:
   - Hard refresh (Ctrl+F5 or Cmd+Shift+R)
   - Or clear browser cache completely

3. **Check Environment Variables**:
   - Ensure all Railway database variables are set in Vercel
   - Check Vercel environment variables match Railway

### If login fails:
1. Check if user exists in database
2. Verify password is correct
3. Check if user has ADMIN role

## 📊 Expected Results After Fixes

✅ **All 500 errors should be resolved**  
✅ **User approvals should work**  
✅ **Reports should load data**  
✅ **Settings should save**  
✅ **Certificate approvals should work**  
✅ **No authentication errors**  
✅ **No dynamic server usage errors**  

## 🆘 If Issues Persist

If you still encounter problems after following this guide:

1. **Screenshot the error** (browser console + network tab)
2. **Note the exact error message**
3. **Check which specific API endpoint is failing**
4. **Report back with specific details**

## 🎯 Success Criteria

The admin dashboard is working correctly when:
- ✅ Login works without errors
- ✅ All pages load without 500 errors
- ✅ User management functions work
- ✅ Reports display data correctly
- ✅ Settings save successfully
- ✅ Certificate approvals work
- ✅ No console errors
- ✅ All API calls return 200 status

---

**Remember**: Wait 2-3 minutes after deployment before testing to ensure all changes are live!
