---
description: Hướng dẫn phát triển và thêm API endpoints mới
---

# API Development Workflow

## Cấu trúc thư mục Backend

```
backend/
├── controllers/    ← Xử lý logic cho routes
├── middleware/     ← Auth, validation middleware
├── models/         ← Database models
├── routes/         ← Route definitions
├── services/       ← Business logic
└── utils/          ← Helper functions
```

## Thêm API Endpoint Mới

### 1. Tạo Model (nếu cần)

File: `backend/models/example.model.js`
```javascript
const db = require('../config/db');

const ExampleModel = {
  findAll: async () => {
    const [rows] = await db.query('SELECT * FROM examples');
    return rows;
  },
  
  findById: async (id) => {
    const [rows] = await db.query('SELECT * FROM examples WHERE id = ?', [id]);
    return rows[0];
  },
  
  create: async (data) => {
    const [result] = await db.query('INSERT INTO examples SET ?', data);
    return result.insertId;
  },
  
  update: async (id, data) => {
    await db.query('UPDATE examples SET ? WHERE id = ?', [data, id]);
  },
  
  delete: async (id) => {
    await db.query('DELETE FROM examples WHERE id = ?', [id]);
  }
};

module.exports = ExampleModel;
```

### 2. Tạo Controller

File: `backend/controllers/example.controller.js`
```javascript
const ExampleModel = require('../models/example.model');

const ExampleController = {
  getAll: async (req, res) => {
    try {
      const items = await ExampleModel.findAll();
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  getById: async (req, res) => {
    try {
      const item = await ExampleModel.findById(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  create: async (req, res) => {
    try {
      const id = await ExampleModel.create(req.body);
      res.status(201).json({ id, ...req.body });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  update: async (req, res) => {
    try {
      await ExampleModel.update(req.params.id, req.body);
      res.json({ message: 'Updated successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
  
  delete: async (req, res) => {
    try {
      await ExampleModel.delete(req.params.id);
      res.json({ message: 'Deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = ExampleController;
```

### 3. Tạo Routes

File: `backend/routes/example.routes.js`
```javascript
const express = require('express');
const router = express.Router();
const ExampleController = require('../controllers/example.controller');
const authMiddleware = require('../middleware/auth');

router.get('/', authMiddleware, ExampleController.getAll);
router.get('/:id', authMiddleware, ExampleController.getById);
router.post('/', authMiddleware, ExampleController.create);
router.put('/:id', authMiddleware, ExampleController.update);
router.delete('/:id', authMiddleware, ExampleController.delete);

module.exports = router;
```

### 4. Đăng ký Routes trong app.js

```javascript
const exampleRoutes = require('./routes/example.routes');
app.use('/api/examples', exampleRoutes);
```

## API Response Format

### Success Response
```json
{
  "data": { },
  "message": "Success"
}
```

### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Testing API

### Sử dụng curl
```bash
# GET all
curl http://localhost:5000/api/examples

# GET by ID
curl http://localhost:5000/api/examples/1

# POST
curl -X POST http://localhost:5000/api/examples \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "Test"}'

# PUT
curl -X PUT http://localhost:5000/api/examples/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name": "Updated"}'

# DELETE
curl -X DELETE http://localhost:5000/api/examples/1 \
  -H "Authorization: Bearer <token>"
```

### Sử dụng Postman/Insomnia
1. Import collection từ team
2. Set environment variables (BASE_URL, TOKEN)
3. Test từng endpoint
