---
description: Hướng dẫn build và deploy ứng dụng lên production
---

# Deployment Workflow

## Build Production

### 1. Build Frontend
```bash
cd frontend
npm run build
```
Output sẽ được tạo trong folder `frontend/dist/`

### 2. Preview Production Build (Optional)
```bash
npm run preview
```

## Deploy Options

### Option A: Static Hosting (Vercel, Netlify)

#### Frontend
1. Connect repository với Vercel/Netlify
2. Với cấu trúc repo hiện tại (frontend nằm trong `frontend/`), ưu tiên dùng `vercel.json` ở root repo để build tự động đúng thư mục.
3. Nếu cấu hình thủ công trên Vercel thì:
   - Root Directory: `.`
   - Build command: `cd frontend && npm run build`
   - Output directory: `frontend/dist`
4. Thêm environment variables cho frontend:
   - `VITE_API_URL`: origin của backend API production (ví dụ: `https://your-backend-domain.com`), không thêm `/api` ở cuối.

#### Backend
Deploy lên Render, Railway, hoặc VPS với:
- Start command: `npm start`
- Environment variables từ file `.env`
- Bắt buộc thêm `CORS_ORIGINS` chứa domain frontend production (có thể nhiều domain, ngăn cách bằng dấu phẩy)
   - Ví dụ: `CORS_ORIGINS=https://your-frontend.vercel.app,https://www.your-domain.com`

### Option B: Docker Deployment

#### Dockerfile (Backend)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

#### Dockerfile (Frontend)
```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Option C: VPS Manual Deploy

1. SSH vào server
2. Clone/pull latest code
3. Install dependencies:
   ```bash
   cd backend && npm ci --only=production
   cd frontend && npm ci && npm run build
   ```
4. Sử dụng PM2 để quản lý process:
   ```bash
   pm2 start backend/app.js --name "manager-staff-api"
   ```
5. Configure Nginx làm reverse proxy

## Post-Deployment Checklist
- [ ] Kiểm tra API endpoints hoạt động
- [ ] Kiểm tra authentication flow
- [ ] Kiểm tra CORS settings
- [ ] Kiểm tra SSL certificate
- [ ] Kiểm tra database connection
