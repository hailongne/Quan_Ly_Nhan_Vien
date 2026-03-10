---
description: Hướng dẫn phát triển Frontend components và pages
---

# Frontend Development Workflow

## Cấu trúc thư mục

```
frontend/src/
├── api/            ← API calls & axios config
├── components/     ← Reusable UI components
├── contexts/       ← React Context providers
├── hooks/          ← Custom hooks
├── pages/          ← Page components
└── App.tsx         ← Main app với routing
```

## Thêm Component Mới

### 1. Tạo Component File

File: `src/components/ExampleCard.tsx`
```tsx
import React from 'react';

interface ExampleCardProps {
  title: string;
  description: string;
  onClick?: () => void;
}

const ExampleCard: React.FC<ExampleCardProps> = ({ 
  title, 
  description, 
  onClick 
}) => {
  return (
    <div 
      className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      <p className="text-gray-600 mt-2">{description}</p>
    </div>
  );
};

export default ExampleCard;
```

### 2. Export từ index (optional)

File: `src/components/index.ts`
```tsx
export { default as ExampleCard } from './ExampleCard';
export { default as StatCard } from './StatCard';
// ...other exports
```

## Thêm Page Mới

### 1. Tạo Page Component

File: `src/pages/ExamplePage.tsx`
```tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import ExampleCard from '../components/ExampleCard';
import { fetchExamples } from '../api/examples';

const ExamplePage: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchExamples();
        setItems(data);
      } catch (err) {
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Example Page</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <ExampleCard
            key={item.id}
            title={item.title}
            description={item.description}
          />
        ))}
      </div>
    </div>
  );
};

export default ExamplePage;
```

### 2. Thêm Route trong App.tsx

```tsx
import ExamplePage from './pages/ExamplePage';

// Trong Routes component:
<Route path="/examples" element={
  <ProtectedRoute>
    <ExamplePage />
  </ProtectedRoute>
} />
```

### 3. Thêm vào Sidebar Navigation

Cập nhật `components/Layout.tsx` để thêm link mới vào sidebar.

## Thêm API Call

File: `src/api/examples.ts`
```tsx
import api from './axios';

export interface Example {
  id: number;
  title: string;
  description: string;
  createdAt: string;
}

export const fetchExamples = async (): Promise<Example[]> => {
  const response = await api.get('/examples');
  return response.data;
};

export const fetchExampleById = async (id: number): Promise<Example> => {
  const response = await api.get(`/examples/${id}`);
  return response.data;
};

export const createExample = async (data: Partial<Example>): Promise<Example> => {
  const response = await api.post('/examples', data);
  return response.data;
};

export const updateExample = async (id: number, data: Partial<Example>): Promise<Example> => {
  const response = await api.put(`/examples/${id}`, data);
  return response.data;
};

export const deleteExample = async (id: number): Promise<void> => {
  await api.delete(`/examples/${id}`);
};
```

## Custom Hook Pattern

File: `src/hooks/useExamples.ts`
```tsx
import { useState, useEffect } from 'react';
import { fetchExamples, Example } from '../api/examples';

export const useExamples = () => {
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchExamples();
        setExamples(data);
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return { examples, loading, error, refetch: () => {} };
};
```

## Development Tips

### Hot Reload
Vite tự động hot reload khi save files.

### TypeScript Errors
```bash
npm run type-check
```

### Linting
```bash
npm run lint
npm run lint:fix
```

### Build kiểm tra trước khi commit
```bash
npm run build
```
