---
description: Hướng dẫn cài đặt và khởi chạy môi trường phát triển
---

# Development Setup Workflow

## Yêu cầu hệ thống
- Node.js >= 18.x
- npm >= 9.x

## Các bước thực hiện

### 1. Clone project
```bash
git clone <repository-url>
cd ManagerStaff
```

### 2. Cài đặt Backend
```bash
cd backend
npm install
```

### 3. Cấu hình Backend Environment
Tạo file `.env` trong folder `backend/`:
```env
PORT=5000
DB_HOST=localhost
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=manager_staff
JWT_SECRET=your_jwt_secret
```

### 4. Cài đặt Frontend
```bash
cd frontend
npm install
```

### 5. Cấu hình Frontend Environment
Tạo file `.env` trong folder `frontend/`:
```env
VITE_API_URL=http://localhost:5000
```

### 6. Chạy Migrations (nếu có)
```bash
cd backend
node migrations/20260105_remove_daily_tasks_table.js
node migrations/20260105_remove_task_assignments_table.js
```

### 7. Khởi chạy Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm start
# Server chạy tại http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# Server chạy tại http://localhost:5556
```

## Xác minh
- Truy cập `http://localhost:5556` để xem frontend
- API backend có thể test tại `http://localhost:5000/api/`
