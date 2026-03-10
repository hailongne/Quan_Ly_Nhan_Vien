---
description: Hướng dẫn viết và chạy tests cho ứng dụng
---

# Testing Workflow

## Cấu trúc Tests

```
backend/
├── __tests__/           ← Test files
│   ├── unit/           ← Unit tests
│   └── integration/    ← Integration tests
└── jest.config.js      ← Jest configuration

frontend/
├── __tests__/           ← Test files
│   ├── components/     ← Component tests
│   └── pages/          ← Page tests
└── vitest.config.ts    ← Vitest configuration
```

## Backend Testing

### Setup Jest
```bash
cd backend
npm install --save-dev jest supertest
```

### Unit Test Example

File: `backend/__tests__/unit/user.service.test.js`
```javascript
const UserService = require('../../services/user.service');

describe('UserService', () => {
  describe('validateEmail', () => {
    it('should return true for valid email', () => {
      expect(UserService.validateEmail('test@example.com')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(UserService.validateEmail('invalid-email')).toBe(false);
    });
  });

  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'test123';
      const hash = await UserService.hashPassword(password);
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });
  });
});
```

### Integration Test Example

File: `backend/__tests__/integration/auth.test.js`
```javascript
const request = require('supertest');
const app = require('../../app');

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: '123456'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });
  });
});
```

### Chạy Backend Tests
```bash
cd backend
npm test                    # Chạy tất cả tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
npm test -- user.test.js   # Chạy file cụ thể
```

## Frontend Testing

### Setup Vitest
```bash
cd frontend
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

### Component Test Example

File: `frontend/__tests__/components/StatCard.test.tsx`
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatCard from '../../src/components/StatCard';

describe('StatCard', () => {
  it('should render title and value', () => {
    render(<StatCard title="Total Tasks" value={100} />);
    
    expect(screen.getByText('Total Tasks')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should show trend indicator when provided', () => {
    render(<StatCard title="Tasks" value={50} trend={10} />);
    
    expect(screen.getByText('+10%')).toBeInTheDocument();
  });
});
```

### Hook Test Example

File: `frontend/__tests__/hooks/useAuth.test.tsx`
```tsx
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { useAuth } from '../../src/hooks/useAuth';

const wrapper = ({ children }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('useAuth', () => {
  it('should return null user when not logged in', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
  });

  it('should update user after login', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    
    await act(async () => {
      await result.current.login('user@example.com', '123456');
    });

    expect(result.current.user).not.toBeNull();
  });
});
```

### Chạy Frontend Tests
```bash
cd frontend
npm run test              # Chạy tất cả tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
npm run test:ui          # Vitest UI
```

## Test Coverage

### Yêu cầu coverage tối thiểu
- **Statements**: 70%
- **Branches**: 60%
- **Functions**: 70%
- **Lines**: 70%

### Xem Coverage Report
```bash
npm run test:coverage
# Report sẽ được tạo trong folder coverage/
# Mở coverage/lcov-report/index.html trong browser
```

## CI/CD Integration

### GitHub Actions Example
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm ci
      - run: cd backend && npm test

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm ci
      - run: cd frontend && npm run test
```

## Testing Best Practices

1. **Test behavior, not implementation**
2. **Use meaningful test descriptions**
3. **Keep tests independent**
4. **Mock external dependencies**
5. **Write tests before fixing bugs**
6. **Run tests before committing**


