import api from './axios';

export type AssignableUser = {
  user_id: number;
  name: string;
  email?: string;
  role?: string;
  department_id?: number | null;
};

export type CreateIndividualTaskPayload = {
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  assignee_user_ids: number[];
};

export type CreatedIndividualTask = {
  task_id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  assignees: Array<{ user_id: number; name: string }>;
};

export type CreatedTaskOverview = {
  task_id: number;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  summary: {
    total_assignees: number;
    accepted_count: number;
    completed_count: number;
    submitted_count: number;
  };
  assignees: Array<{
    user_id: number;
    name: string;
    status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
    accepted_at?: string | null;
    completed_at?: string | null;
  }>;
  submission: {
    submission_id: number;
    submitted_by_user_id: number;
    submitted_by_name: string;
    submitted_at: string;
    file_url?: string | null;
    file_urls?: string[];
    link_url?: string | null;
    note?: string | null;
  } | null;
};

export type MyIndividualAssignment = {
  assignment_id: number;
  task_id: number;
  status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
  assigned_at: string;
  completed_at: string | null;
  accepted_at?: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  assigned_by_user_id: number | null;
  assigned_by_name: string | null;
  teammate_names?: string | null;
  assignee_names?: string | null;
  accepted_count?: number;
  total_assignees?: number;
  my_submission_count?: number;
  task_submission_count?: number;
  submitted_by_name?: string | null;
  submitted_at?: string | null;
};

export async function getAssignableUsers(): Promise<AssignableUser[]> {
  const res = await api.get('/api/individual-tasks/assignable-users');
  return Array.isArray(res.data) ? res.data : [];
}

export async function createIndividualTask(payload: CreateIndividualTaskPayload) {
  const res = await api.post('/api/individual-tasks', payload);
  return res.data;
}

export async function getCreatedIndividualTasks(): Promise<CreatedIndividualTask[]> {
  const res = await api.get('/api/individual-tasks/created-by-me');
  return Array.isArray(res.data) ? res.data : [];
}

export async function getCreatedTaskOverview(): Promise<CreatedTaskOverview[]> {
  const res = await api.get('/api/individual-tasks/created-overview');
  return Array.isArray(res.data) ? res.data : [];
}

export async function getMyIndividualAssignments(): Promise<MyIndividualAssignment[]> {
  const res = await api.get('/api/individual-tasks/my-assignments');
  return Array.isArray(res.data) ? res.data : [];
}

export async function acceptIndividualTask(taskId: number) {
  const res = await api.post(`/api/individual-tasks/${taskId}/accept`);
  return res.data;
}

export async function submitIndividualTaskResult(taskId: number, payload: { link_url?: string; note?: string; files?: File[] }) {
  const form = new FormData();
  if (payload.link_url) form.append('link_url', payload.link_url);
  if (payload.note) form.append('note', payload.note);
  if (Array.isArray(payload.files)) {
    payload.files.forEach((file) => {
      if (file) form.append('result_files', file);
    });
  }

  const res = await api.post(`/api/individual-tasks/${taskId}/submit`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return res.data;
}
