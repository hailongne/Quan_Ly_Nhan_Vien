import React, { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export default function FiltersBar({ query, setQuery, status, setStatus, role, setRole, counts } : { query:string; setQuery:Dispatch<SetStateAction<string>>; status:string; setStatus:Dispatch<SetStateAction<string>>; role:string; setRole:Dispatch<SetStateAction<string>>; counts: Record<string, number> }){
  const [statusOpen, setStatusOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [statusHover, setStatusHover] = useState<string | null>(null);
  const [roleHover, setRoleHover] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement | null>(null);
  const roleRef = useRef<HTMLDivElement | null>(null);
    useEffect(()=>{
        function onDoc(e: MouseEvent){
            const target = e.target as Node;
            if(statusRef.current && statusRef.current.contains(target)) return;
            if(roleRef.current && roleRef.current.contains(target)) return;
            setStatusOpen(false);
            setRoleOpen(false);
        }
        document.addEventListener('click', onDoc);
        return ()=>document.removeEventListener('click', onDoc);
    },[]);
  const container: React.CSSProperties = { marginBottom: 18, background: '#fff', border: '1px solid #f3f4f6', borderRadius: 16, padding: 14, fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', fontWeight: 400, WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', color: '#0f1723' };
    const row: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 };
  
  const selectWrap: React.CSSProperties = { position: 'relative', minWidth: 160 };
    const dropdownButton: React.CSSProperties = { padding: '8px 12px', borderRadius: 10, border: '1px solid #e6e7eb', background: '#fff', cursor: 'pointer', minWidth: 160, textAlign: 'left', transition: 'box-shadow 150ms ease, transform 120ms ease' };
    const menuStyle: React.CSSProperties = { position: 'absolute', top: 44, left: 0, background: '#fff', border: '1px solid #e6e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(2,6,23,0.08)', zIndex: 50, overflow: 'hidden' };
    const menuItemStyleBase: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 12px', background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', transition: 'background 150ms ease, color 150ms ease, border-left 150ms ease, box-shadow 150ms ease', fontWeight: 400 };
  
  const statBadge: React.CSSProperties = { padding: '6px 12px', borderRadius: 999, background: '#eff6ff', border: '1px solid #93c5fd', color: '#1e40af', fontWeight: 600, fontSize: 12 };
  const tagBase = (active:boolean): React.CSSProperties => ({ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: active ? 'default' : 'pointer' });

    const stats = {
        total: counts.all || 0,
        byStatus: [
            { status: 'Hợp đồng', value: counts.contract || 0, key: 'contract' },
            { status: 'Chính thức', value: counts.official || 0, key: 'official' },
            { status: 'Thử việc', value: counts.probation || 0, key: 'probation' },
            { status: 'Thực tập', value: counts.intern || 0, key: 'intern' }
        ]
    };

  return (
    <section style={{ ...container, border: 'none' }}>
        <div style={row}>
                        <div style={selectWrap} ref={statusRef}>
                            <div onClick={(e)=>e.stopPropagation()}>
                                <button type="button" style={{ ...dropdownButton, boxShadow: statusOpen ? '0 8px 24px rgba(2,6,23,0.06)' : undefined }} onClick={(e)=>{ e.stopPropagation(); setStatusOpen(s=>{ const next = !s; if(next) setStatusHover(status==='all' ? 'all' : status); else setStatusHover(null); return next; }); }} aria-haspopup="menu" aria-expanded={statusOpen}>
                                    {stats.byStatus.find(s=>s.key===status)?.status ?? (status==='all' ? 'Tất cả trạng thái' : status)} ▾
                                    </button>
                                    {statusOpen && (
                                    <div role="menu" aria-hidden={!statusOpen} style={menuStyle}>
                                    <button
                                        role="menuitem"
                                        onMouseEnter={()=>setStatusHover('all')}
                                        onMouseLeave={()=>setStatusHover(null)}
                                        onClick={()=>{ setStatus('all'); setStatusOpen(false); setStatusHover(null); }}
                                        style={{
                                        ...menuItemStyleBase,
                                        background: statusHover === 'all' ? '#f3f6f9' : (status === 'all' ? '#eef2ff' : 'transparent'),
                                        color: status === 'all' ? '#2069d6' : '#0f1723',
                                        borderLeft: statusHover === 'all' ? '3px solid #dbeafe' : (status === 'all' ? '3px solid #bfdbfe' : '3px solid transparent'),
                                        boxShadow: statusHover === 'all' ? '0 2px 6px rgba(2,6,23,0.04)' : undefined
                                        }}
                                    >Tất cả trạng thái</button>
                                    {stats.byStatus.map((opt)=> {
                                        const key = opt.key;
                                        const isActive = status === key;
                                        const isHovered = statusHover === key;
                                        return (
                                        <button
                                            key={key}
                                            role="menuitem"
                                            onMouseEnter={()=>setStatusHover(key)}
                                            onMouseLeave={()=>setStatusHover(null)}
                                            onClick={()=>{ setStatus(key); setStatusOpen(false); setStatusHover(null); }}
                                            style={{
                                            ...menuItemStyleBase,
                                            background: isHovered ? '#f3f6f9' : (isActive ? '#eef2ff' : 'transparent'),
                                            color: isActive ? '#2069d6' : '#0f1723',
                                            borderLeft: isHovered ? '3px solid #dbeafe' : (isActive ? '3px solid #bfdbfe' : '3px solid transparent'),
                                            boxShadow: isHovered ? '0 2px 6px rgba(2,6,23,0.04)' : undefined
                                            }}
                                        >{opt.status} ({opt.value})</button>
                                        );
                                    })}
                                    </div>
                                    )}
                            </div>
                        </div>

                        <div style={{ ...selectWrap, minWidth: 140 }} ref={roleRef}>
                                <div onClick={(e)=>e.stopPropagation()}>
                                    <button type="button" style={{ ...dropdownButton, boxShadow: roleOpen ? '0 8px 24px rgba(2,6,23,0.06)' : undefined }} onClick={(e)=>{ e.stopPropagation(); setRoleOpen(s=>{ const next = !s; if(next) setRoleHover(role==='all' ? 'all' : role); else setRoleHover(null); return next; }); }} aria-haspopup="menu" aria-expanded={roleOpen}>
                                        {role === 'all' ? 'Tất cả vai trò' : (role === 'user' ? 'Nhân viên' : (role === 'leader' ? 'Trưởng nhóm' : role))} ▾
                                    </button>
                                    {roleOpen && (
                                      <div role="menu" aria-hidden={!roleOpen} style={menuStyle}>
                                      <button
                                        role="menuitem"
                                        onMouseEnter={()=>setRoleHover('all')}
                                        onMouseLeave={()=>setRoleHover(null)}
                                        onClick={()=>{ setRole('all'); setRoleOpen(false); setRoleHover(null); }}
                                        style={{
                                          ...menuItemStyleBase,
                                          background: roleHover === 'all' ? '#f3f6f9' : (role === 'all' ? '#eef2ff' : 'transparent'),
                                          color: role === 'all' ? '#2069d6' : '#0f1723',
                                          borderLeft: roleHover === 'all' ? '3px solid #dbeafe' : (role === 'all' ? '3px solid #bfdbfe' : '3px solid transparent'),
                                          boxShadow: roleHover === 'all' ? '0 2px 6px rgba(2,6,23,0.04)' : undefined
                                        }}
                                      >Tất cả vai trò</button>
                                        {['user','leader'].map((rkey)=>{
                                            const label = rkey === 'user' ? 'Nhân viên' : 'Trưởng nhóm';
                                            const isActive = role === rkey;
                                            const isHovered = roleHover === rkey;
                                            return (
                                                <button
                                                    key={rkey}
                                                    role="menuitem"
                                                    onMouseEnter={()=>setRoleHover(rkey)}
                                                    onMouseLeave={()=>setRoleHover(null)}
                                                    onClick={()=>{ setRole(rkey); setRoleOpen(false); setRoleHover(null); }}
                                                    style={{
                                              ...menuItemStyleBase,
                                              background: isHovered ? '#f3f6f9' : (isActive ? '#eef2ff' : 'transparent'),
                                              color: isActive ? '#2069d6' : '#0f1723',
                                              borderLeft: isHovered ? '3px solid #dbeafe' : (isActive ? '3px solid #bfdbfe' : '3px solid transparent'),
                                              boxShadow: isHovered ? '0 2px 6px rgba(2,6,23,0.04)' : undefined
                                                    }}
                                                >{label}</button>
                                            );
                                        })}
                                      </div>
                                    )}
                                </div>
                        </div>

            <button onClick={()=>setStatus('all')} aria-label="Lọc tất cả" style={{ ...statBadge, border: 'none', cursor: 'pointer' }}>Tổng: {stats.total}</button>

            {stats.byStatus.map((item)=> {
                const active = (status === item.key);
                return (
                    <button key={item.key} onClick={()=>setStatus(item.key)} style={{ ...tagBase(active), border: 'none', ...(active ? { background: '#eff6ff', color: '#1e40af' } : { background: '#eaf2ff', color: '#1e3a8a' }) }}>
                        <span>{item.status}:</span>
                        <span>{item.value}</span>
                    </button>
                );
            })}

            <div style={{ flex: 1, minWidth: 500 }}>
                <div style={{ width: '100%', border:'1px solid #008dc5', borderRadius: 12 }}>
                    <input
                        type="search"
                        value={query}
                        onChange={(e)=>setQuery(e.target.value)}
                        placeholder="Tìm theo tên, số điện thoại, email và phòng ban"
                        aria-label="Tìm kiếm nhân viên"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #e5e7eb', background: '#f8fafc', outline: 'none', fontSize: 14 }}
                    />
                </div>
            </div>
        </div>
    </section>
  );
}
