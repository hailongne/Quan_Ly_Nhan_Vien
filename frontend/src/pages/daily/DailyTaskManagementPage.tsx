import { useEffect, useMemo, useState } from 'react';
import {
  acceptIndividualTask,
  createIndividualTask,
  getCreatedTaskOverview,
  getAssignableUsers,
  getMyIndividualAssignments,
  submitIndividualTaskResult,
  type AssignableUser,
  type CreatedTaskOverview,
  type MyIndividualAssignment
} from '../../api/individualTasks';
import { notify } from '../../utils/notify';

type Props = {
  role: string;
};

function toYmd(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeRole(role: string) {
  return String(role || '').toLowerCase();
}

function toVietnameseStatus(status: string) {
  switch (String(status || '').toLowerCase()) {
    case 'todo':
      return 'Chưa bắt đầu';
    case 'in_progress':
      return 'Đang thực hiện';
    case 'completed':
      return 'Hoàn thành';
    case 'cancelled':
      return 'Đã hủy';
    default:
      return status || 'Không xác định';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN');
}

function normalizeUrl(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export default function DailyTaskManagementPage({ role }: Props) {
  const normalizedRole = normalizeRole(role);
  const canAssign = normalizedRole === 'admin' || normalizedRole === 'leader';

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [createdOverview, setCreatedOverview] = useState<CreatedTaskOverview[]>([]);
  const [myAssignments, setMyAssignments] = useState<MyIndividualAssignment[]>([]);
  const [managerTab, setManagerTab] = useState<'assign' | 'history' | 'my'>('assign');
  const [acceptingTaskId, setAcceptingTaskId] = useState<number | null>(null);
  const [submittingTaskId, setSubmittingTaskId] = useState<number | null>(null);
  const [openSubmitTaskId, setOpenSubmitTaskId] = useState<number | null>(null);
  const [submitLink, setSubmitLink] = useState('');
  const [submitNote, setSubmitNote] = useState('');
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(toYmd(new Date()));
  const [endDate, setEndDate] = useState(toYmd(new Date()));
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<number[]>([]);

  const selectedCount = selectedAssigneeIds.length;

  const myOpenAssignments = useMemo(() => {
    return myAssignments.filter((x) => x.status !== 'completed' && x.status !== 'cancelled');
  }, [myAssignments]);

  const myDoneAssignments = useMemo(() => {
    return myAssignments.filter((x) => x.status === 'completed');
  }, [myAssignments]);

  async function loadData() {
    setLoading(true);
    try {
      const jobs: Promise<any>[] = [getMyIndividualAssignments().then(setMyAssignments)];
      if (canAssign) {
        jobs.push(getAssignableUsers().then(setAssignableUsers));
        jobs.push(getCreatedTaskOverview().then(setCreatedOverview));
      }
      await Promise.all(jobs);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể tải dữ liệu công việc';
      notify.error('Lỗi', msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAssign]);

  function toggleAssignee(userId: number) {
    setSelectedAssigneeIds((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      return [...prev, userId];
    });
  }

  async function onCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!canAssign) return;

    const t = title.trim();
    const d = description.trim();
    const today = toYmd(new Date());

    if (!t) return notify.error('Thiếu nội dung', 'Vui lòng nhập nội dung công việc');
    if (!startDate || !endDate) return notify.error('Thiếu thời gian', 'Vui lòng chọn ngày bắt đầu và ngày kết thúc');
    if (startDate < today || endDate < today) return notify.error('Không hợp lệ', 'Ngày công việc không được ở quá khứ');
    if (startDate > endDate) return notify.error('Không hợp lệ', 'Ngày bắt đầu không được sau ngày kết thúc');
    if (selectedAssigneeIds.length === 0) return notify.error('Chưa chọn nhân viên', 'Chọn ít nhất 1 nhân viên để giao việc');

    setSaving(true);
    try {
      await createIndividualTask({
        title: t,
        description: d,
        start_date: startDate,
        end_date: endDate,
        assignee_user_ids: selectedAssigneeIds
      });
      notify.success('Thành công', 'Đã giao công việc cho nhân viên');
      setTitle('');
      setDescription('');
      setSelectedAssigneeIds([]);
      await loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể giao việc';
      notify.error('Lỗi', msg);
    } finally {
      setSaving(false);
    }
  }

  async function onAcceptTask(taskId: number) {
    setAcceptingTaskId(taskId);
    try {
      await acceptIndividualTask(taskId);
      notify.success('Thành công', 'Bạn đã nhận nhiệm vụ');
      await loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể nhận nhiệm vụ';
      notify.error('Lỗi', msg);
    } finally {
      setAcceptingTaskId(null);
    }
  }

  function openSubmitBox(taskId: number) {
    setOpenSubmitTaskId(taskId);
    setSubmitLink('');
    setSubmitNote('');
    setSubmitFiles([]);
  }

  async function onSubmitResult(taskId: number) {
    const link = submitLink.trim();
    if (!link && submitFiles.length === 0) {
      notify.error('Thiếu dữ liệu', 'Vui lòng chọn ảnh/tệp hoặc nhập link kết quả');
      return;
    }

    setSubmittingTaskId(taskId);
    try {
      await submitIndividualTaskResult(taskId, { link_url: link || undefined, note: submitNote.trim() || undefined, files: submitFiles });
      notify.success('Thành công', 'Đã nộp kết quả');
      setOpenSubmitTaskId(null);
      setSubmitLink('');
      setSubmitNote('');
      setSubmitFiles([]);
      await loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể nộp kết quả';
      notify.error('Lỗi', msg);
    } finally {
      setSubmittingTaskId(null);
    }
  }

  return (
    <div style={{ padding: 20, display: 'grid', gap: 16 }}>

      {canAssign ? (
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
            <button
              type="button"
              onClick={() => setManagerTab('assign')}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 8,
                border: managerTab === 'assign' ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                background: managerTab === 'assign' ? '#dbeafe' : '#fff',
                color: managerTab === 'assign' ? '#1e3a8a' : '#334155',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Giao việc mới
            </button>
            <button
              type="button"
              onClick={() => setManagerTab('history')}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 8,
                border: managerTab === 'history' ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                background: managerTab === 'history' ? '#dbeafe' : '#fff',
                color: managerTab === 'history' ? '#1e3a8a' : '#334155',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Lịch sử & Tiến độ
            </button>
            <button
              type="button"
              onClick={() => setManagerTab('my')}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 8,
                border: managerTab === 'my' ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                background: managerTab === 'my' ? '#dbeafe' : '#fff',
                color: managerTab === 'my' ? '#1e3a8a' : '#334155',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Công việc được giao cho bạn
            </button>
          </div>

          {managerTab === 'assign' ? (
            <>
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Tạo công việc mới</div>
          <form onSubmit={onCreateTask} style={{ display: 'grid', gap: 12 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Nội dung công việc</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Hoàn tất báo cáo tuần"
                style={{ width: '100%', height: 40, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 12px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Mô tả công việc</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả chi tiết yêu cầu công việc"
                rows={4}
                style={{ width: '100%', borderRadius: 8, border: '1px solid #cbd5e1', padding: 12, resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Ngày bắt đầu</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={toYmd(new Date())}
                  style={{ width: 240, height: 40, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>Ngày kết thúc</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || toYmd(new Date())}
                  style={{ width: 240, height: 40, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 12px' }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontWeight: 600 }}>Nhân viên nhận việc</label>
                <span style={{ color: '#475569', fontSize: 13 }}>Đã chọn: {selectedCount}</span>
              </div>

              <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 10, maxHeight: 220, overflowY: 'auto' }}>
                {assignableUsers.length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: 14 }}>Không có nhân viên khả dụng.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {assignableUsers.map((u) => (
                      <label key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, background: selectedAssigneeIds.includes(u.user_id) ? '#eff6ff' : 'transparent' }}>
                        <input
                          type="checkbox"
                          checked={selectedAssigneeIds.includes(u.user_id)}
                          onChange={() => toggleAssignee(u.user_id)}
                        />
                        <span style={{ fontWeight: 600 }}>{u.name || `User ${u.user_id}`}</span>
                        <span style={{ color: '#64748b', fontSize: 13 }}>{u.email || ''}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={saving || loading}
                style={{
                  height: 40,
                  padding: '0 18px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 700,
                  cursor: saving || loading ? 'not-allowed' : 'pointer',
                  opacity: saving || loading ? 0.7 : 1
                }}
              >
                {saving ? 'Đang giao việc...' : 'Giao việc'}
              </button>
            </div>
          </form>
        </div>
            </>
          ) : managerTab === 'history' ? (
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Lịch sử giao việc & kiểm soát tiến độ</div>
              {createdOverview.length === 0 ? (
                <div style={{ color: '#64748b' }}>Chưa có dữ liệu lịch sử giao việc.</div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {createdOverview.map((task) => (
                    <div key={`ov-${task.task_id}`} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                      {(() => {
                        const total = Number(task.summary.total_assignees || 0);
                        const accepted = Number(task.summary.accepted_count || 0);
                        const isCompletedBySubmission = Boolean(task.submission);
                        const completionLabel = isCompletedBySubmission ? 'Đã hoàn thành' : 'Chưa hoàn thành';
                        const linkUrl = normalizeUrl(task.submission?.link_url || '');

                        return (
                          <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{task.title}</div>
                        <div style={{ fontSize: 13, color: '#334155' }}>
                          Tiến độ nhận: <strong>{accepted}/{total}</strong> | Hoàn thành: <strong>{completionLabel}</strong>
                        </div>
                      </div>

                      <div style={{ marginTop: 4, color: '#475569' }}>{task.description || 'Không có mô tả'}</div>
                      <div style={{ marginTop: 6, color: '#334155', fontSize: 14 }}>
                        Thời gian: <strong>{task.start_date || '-'} - {task.end_date || '-'}</strong>
                      </div>

                      <div style={{ marginTop: 8, borderTop: '1px dashed #e2e8f0', paddingTop: 8 }}>
                        {task.submission ? (
                          <div style={{ fontSize: 14, color: '#334155', display: 'grid', gap: 4 }}>
                            <div>Kết quả đã nộp bởi: <strong>{task.submission.submitted_by_name}</strong></div>
                            <div>Thời gian nộp: <strong>{formatDateTime(task.submission.submitted_at)}</strong></div>
                            {linkUrl ? (
                              <div>
                                Link: <a href={linkUrl} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', textDecoration: 'underline', wordBreak: 'break-all' }}>{linkUrl}</a>
                              </div>
                            ) : null}
                            {Array.isArray(task.submission.file_urls) && task.submission.file_urls.length > 0 ? (
                              <div>
                                Tệp:
                                <div style={{ marginTop: 4, display: 'grid', gap: 2 }}>
                                  {task.submission.file_urls.map((f, idx) => (
                                    <a key={`${task.submission?.submission_id}-f-${idx}`} href={f} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', textDecoration: 'underline', wordBreak: 'break-all' }}>
                                      Mở tệp {idx + 1}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            ) : task.submission.file_url ? (
                              <div>Tệp: <a href={task.submission.file_url} target="_blank" rel="noreferrer">Mở tệp kết quả</a></div>
                            ) : null}
                            {task.submission.note ? <div>Ghi chú: {task.submission.note}</div> : null}
                          </div>
                        ) : (
                          <div style={{ color: '#64748b', fontSize: 14 }}>Chưa có kết quả nộp.</div>
                        )}
                      </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {!canAssign || managerTab === 'my' ? (
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Công việc được giao cho bạn</div>
        {myAssignments.length === 0 ? (
          <div style={{ color: '#64748b' }}>Bạn chưa có công việc nào.</div>
        ) : (
          <>
            <div style={{ marginBottom: 10, color: '#334155', fontSize: 14 }}>
              Đang mở: <strong>{myOpenAssignments.length}</strong> | Hoàn thành: <strong>{myDoneAssignments.length}</strong>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {myAssignments.map((task) => (
                <div key={task.assignment_id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                  {(() => {
                    const teammateRaw = String(task.teammate_names || '').trim();
                    const teammateNames = teammateRaw
                      ? Array.from(new Set(teammateRaw.split('||').map((x) => x.trim()).filter(Boolean)))
                      : [];
                    const assigneeRaw = String(task.assignee_names || '').trim();
                    const assigneeNames = assigneeRaw
                      ? Array.from(new Set(assigneeRaw.split('||').map((x) => x.trim()).filter(Boolean)))
                      : [];
                    const acceptedCount = Number(task.accepted_count || 0);
                    const totalAssignees = Number(task.total_assignees || 0);
                    const allAccepted = totalAssignees > 0 && acceptedCount >= totalAssignees;
                    const isAcceptedByMe = Boolean(task.accepted_at);
                    const hasSubmitted = Number(task.my_submission_count || 0) > 0;
                    const hasAnySubmission = Number(task.task_submission_count || 0) > 0;
                    const submittedBy = String(task.submitted_by_name || '').trim();
                    const submittedAt = formatDateTime(task.submitted_at || null);
                    const canShowSubmit = isAcceptedByMe && allAccepted && !hasSubmitted && !hasAnySubmission;

                    return (
                      <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', flex: 1 }}>{task.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', background: '#dbeafe', borderRadius: 999, padding: '4px 10px' }}>
                        {toVietnameseStatus(task.status)}
                      </span>

                      {hasSubmitted ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 999, padding: '4px 10px' }}>
                          Đã nộp kết quả
                        </span>
                      ) : hasAnySubmission ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#6b21a8', background: '#f3e8ff', borderRadius: 999, padding: '4px 10px' }}>
                          Đã có người nộp kết quả
                        </span>
                      ) : !isAcceptedByMe ? (
                        <button
                          type="button"
                          onClick={() => onAcceptTask(task.task_id)}
                          disabled={acceptingTaskId === task.task_id}
                          style={{
                            height: 30,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#16a34a',
                            color: '#fff',
                            fontWeight: 700,
                            cursor: acceptingTaskId === task.task_id ? 'not-allowed' : 'pointer',
                            opacity: acceptingTaskId === task.task_id ? 0.7 : 1
                          }}
                        >
                          {acceptingTaskId === task.task_id ? 'Đang nhận...' : `Nhận nhiệm vụ (${acceptedCount}/${totalAssignees || 1})`}
                        </button>
                      ) : canShowSubmit ? (
                        <button
                          type="button"
                          onClick={() => openSubmitBox(task.task_id)}
                          style={{
                            height: 30,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#2563eb',
                            color: '#fff',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Nộp kết quả
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 999, padding: '4px 10px', fontWeight: 700 }}>
                          Chờ nhận ({acceptedCount}/{totalAssignees || 1})
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: 4, color: '#475569' }}>{task.description || 'Không có mô tả'}</div>
                  <div style={{ marginTop: 6, color: '#334155', fontSize: 14 }}>
                    Thời gian: <strong>{task.start_date || '-'} - {task.end_date || '-'}</strong> | Người giao: <strong>{task.assigned_by_name || '-'}</strong>
                  </div>
                  {assigneeNames.length > 0 ? (
                    <div style={{ marginTop: 6, color: '#334155', fontSize: 14 }}>
                      Người thực hiện gồm: <strong>{assigneeNames.join(', ')}</strong>
                    </div>
                  ) : teammateNames.length > 0 ? (
                    <div style={{ marginTop: 6, color: '#334155', fontSize: 14 }}>
                      Giao cùng với: <strong>{teammateNames.join(', ')}</strong>
                    </div>
                  ) : null}

                  {hasAnySubmission ? (
                    <div style={{ marginTop: 6, color: '#334155', fontSize: 14 }}>
                      Ai đã nộp kết quả: <strong>{submittedBy || 'Không xác định'}</strong> | Thời gian nộp: <strong>{submittedAt}</strong>
                    </div>
                  ) : null}

                  {openSubmitTaskId === task.task_id && canShowSubmit ? (
                    <div style={{ marginTop: 10, borderTop: '1px dashed #cbd5e1', paddingTop: 10, display: 'grid', gap: 8 }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>Nộp kết quả</div>
                      <input
                        type="url"
                        value={submitLink}
                        onChange={(e) => setSubmitLink(e.target.value)}
                        placeholder="Dán link kết quả (Google Drive, Docs, ...)"
                        style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid #cbd5e1', padding: '0 10px' }}
                      />
                      <input
                        type="file"
                        multiple
                        onChange={(e) => setSubmitFiles(Array.from(e.target.files || []))}
                        style={{ width: '100%' }}
                      />
                      {submitFiles.length > 0 ? (
                        <div style={{ color: '#334155', fontSize: 13 }}>Đã chọn {submitFiles.length} tệp</div>
                      ) : null}
                      <textarea
                        value={submitNote}
                        onChange={(e) => setSubmitNote(e.target.value)}
                        placeholder="Ghi chú (tuỳ chọn)"
                        rows={3}
                        style={{ width: '100%', borderRadius: 8, border: '1px solid #cbd5e1', padding: 10, resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setOpenSubmitTaskId(null)}
                          style={{ height: 34, padding: '0 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: 600 }}
                        >
                          Huỷ
                        </button>
                        <button
                          type="button"
                          onClick={() => onSubmitResult(task.task_id)}
                          disabled={submittingTaskId === task.task_id}
                          style={{
                            height: 34,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#2563eb',
                            color: '#fff',
                            fontWeight: 700,
                            cursor: submittingTaskId === task.task_id ? 'not-allowed' : 'pointer',
                            opacity: submittingTaskId === task.task_id ? 0.7 : 1
                          }}
                        >
                          {submittingTaskId === task.task_id ? 'Đang nộp...' : 'Xác nhận nộp'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
      ) : null}
    </div>
  );
}
