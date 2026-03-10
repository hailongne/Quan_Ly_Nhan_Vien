import { useEffect, useState } from 'react';
import { FiEye, FiEdit2, FiUserX } from 'react-icons/fi';
import type { ApiUser } from "../types";
import AddStaffModal from './AddStaffModal';

export default function StaffList({ users, onView, onEdit, onDelete, onAdd } : { users: ApiUser[]; onView: (user: ApiUser)=>void; onEdit: (user: ApiUser)=>void; onDelete:(id:number)=>void; onAdd?: (u?: Partial<ApiUser>)=>void }){
  useEffect(()=>{
    function noop(){ }
    document.addEventListener('click', noop);
    return ()=>document.removeEventListener('click', noop);
  },[]);
  const [showAdd, setShowAdd] = useState(false);
  const [addHover, setAddHover] = useState(false);
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'separate' };
  const thStyle: React.CSSProperties = { padding: '12px 10px', fontWeight: 700, fontSize: 14, background: '#dbeffa', borderRadius: 8 };
  const tdStyle: React.CSSProperties = { padding: '12px 10px', verticalAlign: 'middle' };
  const cvButtonStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, background: '#e6f7ff', color: '#0b66b3', border: '1px solid #bde0ff', fontWeight: 600, cursor: 'pointer' };
  const missingTagStyle: React.CSSProperties = { padding: '6px 10px', borderRadius: 999, background: '#f3f4f6', color: '#64748b', fontWeight: 500, fontSize: 13 };
  const iconBtnStyle: React.CSSProperties = { width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#374151' };

  function handleAddSubmit(u?: Partial<ApiUser>){
    onAdd?.(u);
  }
  return (
    <section >
      <div style={{ overflowX: 'auto', maxHeight:575, overflowY: 'auto' }}>
        <table style={tableStyle}>
          <thead  style={{ position: 'sticky', top: 0, zIndex: 3 }}>
            <tr>
              <th  style={{ ...thStyle, textAlign: 'center' }}>Nhân viên</th>
              <th  style={{ ...thStyle, textAlign: 'center' }}>Ảnh</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Liên hệ</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Vị trí nhân sự</th>
              <th  style={{ ...thStyle, textAlign: 'center' }}>CV</th>
              <th  style={{ ...thStyle, textAlign: 'center' }}>
                <button onClick={()=>setShowAdd(true)} onMouseEnter={()=>setAddHover(true)} onMouseLeave={()=>setAddHover(false)} style={{ padding: '8px 14px', borderRadius: 12, background: 'linear-gradient(135deg,#4f46e5,#2563eb)', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'transform 120ms ease', transform: addHover ? 'translateY(-2px) scale(1.02)' : 'translateY(0)' }}>Thêm nhân viên</button>
                <AddStaffModal isOpen={showAdd} onClose={()=>setShowAdd(false)} onSubmit={handleAddSubmit} />
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i)=> {
              const rowKey = (u as any).user_id ?? (u as any).id ?? u.username;
              const idForAction = (u as any).id ?? (u as any).user_id ?? 0;
              return (
              <tr key={String(rowKey)}  style={{ background: i % 2 === 0 ? '#ffffff' : '#eef7fb' }}>
                <td  style={{ ...tdStyle, textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, textAlign: 'center' }}>{u.name || '—'}</div>
                  <div style={{ marginTop: 6 }}><RoleTag role={u.role} /></div>
                </td>
                <td  style={{ ...tdStyle, textAlign: 'center' }}>
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.name || u.username} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', display: 'block', margin: '0 auto' }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                      <span  style={missingTagStyle}>Chưa có</span>
                    </div>
                  )}
                </td>
                <td  style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13 }}>{u.email || '—'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{u.username ? `@${u.username}` : '—'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{u.phone || '—'}</div>
                </td>
                <td  style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 600 }}>{u.department || '—'}</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <StatusBadge status={u.employment_status || u.status} />
                    <RoleTag role={u.role} />
                  </div>
                </td>
                <td  style={{ textAlign: 'center' }}>
                  { (u as any).cv_url || (u as any).cv || (u as any).cv_link || (u as any).resume_url ? (
                    <a href={(u as any).cv_url || (u as any).cv || (u as any).cv_link || (u as any).resume_url} target="_blank" rel="noreferrer">
                      <button  style={cvButtonStyle}>Xem CV</button>
                    </a>
                  ) : (
                    <span  style={missingTagStyle}>Chưa có</span>
                  )}
                </td>
                <td  style={{ textAlign: 'center' }}>
                  <div  style={{ justifyContent: 'center' }}>
                    <button style={iconBtnStyle} onClick={()=>onView(u)} aria-label="Xem" title="Xem chi tiết">
                      <FiEye />
                    </button>
                    <button style={iconBtnStyle} onClick={()=>onEdit(u)} aria-label="Sửa" title="Sửa">
                      <FiEdit2 />
                    </button>
                    <button
                      style={iconBtnStyle}
                      onClick={()=>onDelete(idForAction)}
                      aria-label="Xóa"
                      title="Xóa nhân viên"
                    >
                      <FiUserX />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = status?.toLowerCase();
  let color = '#0f172a';
  let bg = '#f8fafc';
  let label = status ?? '—';

  switch (s) {
    case 'inactive':
    case 'disabled':
      color = '#0f172a';
      bg = '#f1f5f9';
      label = 'Đã vô hiệu';
      break;
    case 'contract':
      color = '#0369a1';
      bg = '#e6f7ff';
      label = 'Hợp đồng';
      break;
    case 'official':
      color = '#1e40af';
      bg = '#e6f7ff';
      label = 'Chính thức';
      break;
    case 'probation':
      color = '#f97316';
      bg = '#fff7ed';
      label = 'Thử việc';
      break;
    case 'intern':
      color = '#0ea5e9';
      bg = '#eff6ff';
      label = 'Thực tập';
      break;
    default:
      return null;
  }

  return <span style={{ padding: '6px 10px', borderRadius: 999, background: bg, color, fontWeight: 600, fontSize: 12 }}>{label}</span>;
}

function RoleTag({ role }: { role?: string }) {
  const r = role?.toLowerCase();
  let color = '#374151';
  let bg = '#fff7ed';
  let label = role ?? '—';

  if (r === 'leader') {
    color = '#1e40af';
    bg = '#e6f7ff';
    label = 'Trưởng nhóm';
  } else if (r === 'user') {
    color = '#374151';
    bg = '#fff7ed';
    label = 'Nhân viên';
  } else {
    return <div style={{ fontSize: 12, color: '#6b7280' }}>{role || '—'}</div>;
  }

  return <span style={{ padding: '6px 10px', borderRadius: 999, background: bg, color, fontWeight: 600, fontSize: 12 }}>{label}</span>;
}
