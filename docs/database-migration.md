---
description: Hướng dẫn tạo và chạy database migrations
---

# Database Migration Workflow

## Cấu trúc thư mục

```
backend/
├── migrations/           ← Migration files
│   ├── 20260105_xxx.js
│   └── ...
└── config/
    └── db.js            ← Database connection
```

## Tạo Migration Mới

### 1. Naming Convention
Format: `YYYYMMDD_description.js`

Ví dụ:
- `20260126_create_users_table.js`
- `20260126_add_email_to_users.js`
- `20260126_remove_legacy_column.js`

### 2. Template Migration File

File: `migrations/YYYYMMDD_description.js`
```javascript
const db = require('../config/db');

const migrate = async () => {
  console.log('Starting migration: description...');
  
  try {
    // CREATE TABLE
    await db.query(`
      CREATE TABLE IF NOT EXISTS example_table (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    // ADD COLUMN
    // await db.query(`
    //   ALTER TABLE users 
    //   ADD COLUMN email VARCHAR(255) AFTER name
    // `);
    
    // DROP COLUMN
    // await db.query(`
    //   ALTER TABLE users 
    //   DROP COLUMN legacy_field
    // `);
    
    // ADD INDEX
    // await db.query(`
    //   CREATE INDEX idx_user_email ON users(email)
    // `);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    process.exit(0);
  }
};

migrate();
```

## Chạy Migration

### Chạy một migration cụ thể
```bash
cd backend
node migrations/20260126_create_example_table.js
```

### Chạy tất cả migrations (nếu có script)
```bash
npm run migrate
```

## Rollback Migration

Tạo file rollback tương ứng:

File: `migrations/YYYYMMDD_description_rollback.js`
```javascript
const db = require('../config/db');

const rollback = async () => {
  console.log('Rolling back migration...');
  
  try {
    // DROP TABLE
    await db.query('DROP TABLE IF EXISTS example_table');
    
    // REMOVE COLUMN
    // await db.query('ALTER TABLE users DROP COLUMN email');
    
    // DROP INDEX
    // await db.query('DROP INDEX idx_user_email ON users');
    
    console.log('Rollback completed successfully!');
  } catch (error) {
    console.error('Rollback failed:', error);
    throw error;
  } finally {
    process.exit(0);
  }
};

rollback();
```

## Best Practices

### 1. Backup trước khi migrate
```bash
mysqldump -u user -p database_name > backup_YYYYMMDD.sql
```

### 2. Test trên development trước
- Chạy migration trên local/dev environment
- Verify data integrity
- Test ứng dụng hoạt động bình thường

### 3. Không sửa migration đã chạy
- Nếu cần thay đổi, tạo migration mới
- Giữ lịch sử migrations rõ ràng

### 4. Atomic migrations
- Mỗi migration chỉ làm một việc
- Dễ rollback khi có lỗi

### 5. Document breaking changes
- Note trong README nếu migration ảnh hưởng code
- Notify team members trước khi merge

## Troubleshooting

### Lỗi duplicate entry
```sql
-- Xóa duplicates trước khi add unique constraint
DELETE t1 FROM table t1
INNER JOIN table t2 
WHERE t1.id > t2.id AND t1.email = t2.email;
```

### Lỗi foreign key constraint
```sql
-- Temporarily disable foreign key checks
SET FOREIGN_KEY_CHECKS = 0;
-- Run migration
SET FOREIGN_KEY_CHECKS = 1;
```

### Kiểm tra migration status
```sql
SHOW TABLES;
DESCRIBE table_name;
SHOW CREATE TABLE table_name;
```
