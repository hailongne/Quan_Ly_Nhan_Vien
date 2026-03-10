import React, { useEffect, useRef } from 'react';

export type ConfirmModalProps = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', onConfirm, onCancel }: ConfirmModalProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 };
  const modalStyle: React.CSSProperties = { background: '#fff', borderRadius: 14, boxShadow: '0 20px 48px rgba(15,23,42,0.22)', width: 420, maxWidth: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' };
  const bodyStyle: React.CSSProperties = { padding: '18px 18px 12px', display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'center' };
  const titleStyle: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 };
  const messageStyle: React.CSSProperties = { fontSize: 14, color: '#1f2937', margin: 0, whiteSpace: 'pre-line', lineHeight: 1.45 };
  const buttonsRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #e5e7eb' };
  const buttonBase: React.CSSProperties = { padding: '12px 10px', background: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, transition: 'background-color 120ms ease, color 120ms ease' };
  const cancelButton: React.CSSProperties = { ...buttonBase, color: '#2563eb' };
  const confirmButton: React.CSSProperties = { ...buttonBase, color: '#2563eb' };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" onClick={onCancel}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={bodyStyle}>
          {title ? <h3 style={titleStyle}>{title}</h3> : null}
          {message ? <p style={messageStyle}>{message}</p> : null}
        </div>
        <div style={buttonsRow}>
          <button type="button" style={{ ...cancelButton, borderRight: '1px solid #e5e7eb' }} onClick={onCancel}>
            {cancelText}
          </button>
          <button type="button" style={confirmButton} onClick={onConfirm} ref={confirmButtonRef}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
