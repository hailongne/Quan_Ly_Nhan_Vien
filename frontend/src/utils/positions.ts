export interface PositionInput { id?: any; name?: string; title?: string; capacity?: number | string; quantity?: number | string; limit?: number; max_capacity?: number; max?: number; count?: number; remaining?: number }

export interface NormalizedPosition { id: string; name: string; remaining: number; count: number; capacity?: number }

export function computeRemainingForPositions(data: any[], users: any[], deptId?: number): NormalizedPosition[] {
  const list = Array.isArray(data) ? data : [];
  return list.map((p: any) => {
    if (typeof p === 'string') p = { name: p };
    const name = p.name ?? p.title ?? String(p.id);
    const capacity = Number(p.capacity ?? p.limit ?? p.max_capacity ?? p.max ?? p.quantity ?? 0);
    const currentCount = (users || []).filter((u: any) => {
      const did = (u.department_id ?? u.departmentId ?? u.department_id) as any;
      const pos = String(u.department_position ?? u.position ?? u.job_title ?? '').trim();
      return (Number(did) === Number(deptId)) && pos === String(name);
    }).length;
    const remaining = Number.isFinite(capacity) ? Math.max(0, capacity - currentCount) : 0;
    return { id: String(p.id ?? p.name ?? `pos-${name}`), name, remaining, count: currentCount, capacity };
  });
}
