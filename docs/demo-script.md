# MessMate 2-Minute Demo Script

## Introduction (30 seconds)
"Welcome to MessMate - a comprehensive hostel mess management platform. I'll demonstrate the key features across three user roles: students, mess staff, and wardens."

---

## 1. Student Authentication & Dashboard (30 seconds)

**Action:**
1. Navigate to login page
2. Login with demo student credentials
3. Show student dashboard

**Script:**
"Let me start with the student experience. I'll login with our demo student account..."

**Credentials:**
- Email: `arjun.mehta@messmate.in`
- Password: `Student@2026`

**Key Points to Highlight:**
- Secure authentication with MySQL backend
- Personalized dashboard showing meal options
- Real-time meal opt-in capabilities

---

## 2. Meal Opt-in Feature (30 seconds)

**Action:**
1. Click on "Meal Opt-ins" tab
2. Opt-in for breakfast and lunch
3. Show confirmation and data persistence

**Script:**
"Students can easily opt-in for their meals. Let me show how this works with real data persistence..."

**Key Points to Highlight:**
- One-click meal opt-in
- Data stored in MySQL database
- Immediate feedback and confirmation
- Persistent across sessions

---

## 3. Meal Voting System (30 seconds)

**Action:**
1. Navigate to meal voting section
2. Vote for preferred dishes
3. Show live vote counting

**Script:**
"Students can also vote for their preferred dishes. This helps the mess staff plan better..."

**Key Points to Highlight:**
- Interactive voting interface
- Real-time vote aggregation
- Data-driven meal planning

---

## 4. Warden Analytics Dashboard (30 seconds)

**Action:**
1. Logout and login as warden
2. Navigate to warden dashboard
3. Show analytics and KPIs

**Script:**
"Now let me show the warden's view with comprehensive analytics..."

**Credentials:**
- Email: `dr.sharma@messmate.in`
- Password: `Warden@2026`

**Key Points to Highlight:**
- Real-time analytics dashboard
- Key performance indicators
- Data-driven decision making
- Waste tracking and meal ratings

---

## Technical Highlights (Throughout Demo)

**Backend Architecture:**
- "All data is stored in MySQL database with proper schema"
- "Authentication uses bcrypt for secure password hashing"
- "API endpoints handle all CRUD operations with proper error handling"

**Frontend Features:**
- "Built with Next.js 15 and React 19"
- "Responsive design works on all devices"
- "Real-time updates using API polling"

**Data Flow:**
- "User actions → API calls → MySQL storage → Dashboard updates"
- "No demo data - everything is real and persistent"

---

## Closing (15 seconds)

**Script:**
"As you can see, MessMate provides a complete solution for hostel mess management with role-based access, real-time data, and comprehensive analytics. The system is built with modern technologies and follows best practices for security and scalability."

---

## Demo Checklist

- [ ] Server is running (`npm run dev`)
- [ ] Database is connected (`/api/health/db` returns ok)
- [ ] Demo users exist in database
- [ ] All API endpoints are working
- [ ] Frontend is properly loading

## Potential Issues & Solutions

**If login fails:**
- Check database connection
- Verify demo users exist
- Check API endpoints

**If data doesn't persist:**
- Verify MySQL connection
- Check API error logs
- Ensure schema is created

**If pages don't load:**
- Check server status
- Verify build process
- Check for console errors

## Backup Demo Data

If demo data is lost, run these commands:
```bash
# Check database connection
curl http://localhost:4028/api/health/db

# Verify demo users
curl http://localhost:4028/api/auth/signin -X POST -H "Content-Type: application/json" -d '{"email":"arjun.mehta@messmate.in","password":"Student@2026"}'
```
