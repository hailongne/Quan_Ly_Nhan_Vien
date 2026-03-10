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
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Thêm environment variables:
   - `VITE_API_URL`: URL của backend API

#### Backend
Deploy lên Render, Railway, hoặc VPS với:
- Start command: `npm start`
- Environment variables từ file `.env`

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
