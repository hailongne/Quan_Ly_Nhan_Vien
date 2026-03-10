---
description: Quy trình làm việc với Git và branching strategy
---

# Git Workflow

## Branch Strategy

```
main          ← Production-ready code
  └── develop ← Integration branch
       └── feature/xxx  ← New features
       └── bugfix/xxx   ← Bug fixes
       └── hotfix/xxx   ← Urgent production fixes
```

## Quy trình phát triển feature mới

### 1. Tạo branch mới từ develop
```bash
git checkout develop
git pull origin develop
git checkout -b feature/tên-tính-năng
```

### 2. Commit thường xuyên với message rõ ràng
```bash
git add .
git commit -m "feat: mô tả ngắn gọn thay đổi"
```

#### Commit Message Convention
- `feat:` - Tính năng mới
- `fix:` - Sửa bug
- `docs:` - Thay đổi documentation
- `style:` - Format code, không ảnh hưởng logic
- `refactor:` - Refactor code
- `test:` - Thêm/sửa tests
- `chore:` - Thay đổi build process, tools

### 3. Push và tạo Pull Request
```bash
git push origin feature/tên-tính-năng
```
Sau đó tạo Pull Request trên GitHub/GitLab.

### 4. Code Review
- Request review từ team members
- Address feedback và push thêm commits
- Merge sau khi được approve

### 5. Merge vào develop
```bash
git checkout develop
git pull origin develop
git merge feature/tên-tính-năng
git push origin develop
```

## Hotfix Workflow

### 1. Tạo hotfix branch từ main
```bash
git checkout main
git pull origin main
git checkout -b hotfix/mô-tả-lỗi
```

### 2. Fix và commit
```bash
git add .
git commit -m "fix: mô tả sửa lỗi"
```

### 3. Merge vào cả main và develop
```bash
git checkout main
git merge hotfix/mô-tả-lỗi
git push origin main

git checkout develop
git merge hotfix/mô-tả-lỗi
git push origin develop
```

## Useful Commands

```bash
# Xem lịch sử commit
git log --oneline -n 10

# Xem thay đổi chưa commit
git status
git diff

# Undo last commit (giữ thay đổi)
git reset --soft HEAD~1

# Stash thay đổi tạm thời
git stash
git stash pop
```
