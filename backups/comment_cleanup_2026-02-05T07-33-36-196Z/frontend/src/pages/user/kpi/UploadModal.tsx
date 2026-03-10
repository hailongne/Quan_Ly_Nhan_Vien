import React from 'react'
import api from '../../../api/axios'
import { notify } from '../../../utils/notify'

type ResultItem = {
  id: string
  albumId?: number
  albumIndex?: number
  files: File[]
  linkInputs: string[]
}

const createResult = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  files: [],
  linkInputs: ['']
})

type ExistingItem = {
  output_id: number
  album_id: number
  item_type: 'image' | 'file' | 'link'
  url_or_path: string
  preview_url?: string | null
}

type ExistingLink = {
  link_id: number
  album_id: number
  url: string
}

type ExistingAlbum = {
  album_id: number
  album_index: number
}

const UploadModal: React.FC<{ onClose?: () => void; onSaved?: () => void; maxResults?: number; taskId?: number; chainKpiId?: number; kpiNames?: string[]; mode?: 'upload' | 'view'; existing?: { albums: ExistingAlbum[]; items: ExistingItem[]; links?: ExistingLink[] } | null }> = ({ onClose, onSaved, maxResults = 0, taskId, chainKpiId, kpiNames, mode = 'upload', existing }) => {
  const [results, setResults] = React.useState<ResultItem[]>([createResult()])
  const [saving, setSaving] = React.useState(false)
  const [hoveredAction, setHoveredAction] = React.useState<string | null>(null)
  const [modeState, setModeState] = React.useState<'upload' | 'view' | 'edit'>(mode)
  const [existingState, setExistingState] = React.useState<{ albums: ExistingAlbum[]; items: ExistingItem[]; links?: ExistingLink[] } | null>(existing || null)
  

  React.useEffect(() => {
    setModeState(mode)
  }, [mode])

  React.useEffect(() => {
    setExistingState(existing || null)
  }, [existing])

  React.useEffect(() => {
    if (maxResults <= 0) return
    setResults(prev => {
      if (prev.length === maxResults) return prev
      const next = [...prev]
      if (next.length > maxResults) return next.slice(0, maxResults)
      while (next.length < maxResults) next.push(createResult())
      return next
    })
  }, [maxResults])

  React.useEffect(() => {
    if (modeState !== 'edit' || !existingState || !Array.isArray(existingState.albums)) return
    setResults(existingState.albums.map((a) => ({
      id: String(a.album_id),
      albumId: a.album_id,
      albumIndex: a.album_index,
      files: [],
      linkInputs: ['']
    })))
  }, [modeState, existingState])

  const handleDeleteExistingItem = async (outputId: number) => {
    if (!taskId || !chainKpiId) return
    try {
      await api.delete(`/api/kpis/${chainKpiId}/tasks/${taskId}/outputs/items/${outputId}`)
      setExistingState(prev => prev ? { ...prev, items: prev.items.filter(i => i.output_id !== outputId) } : prev)
    } catch (err) {
      console.error('[UploadModal] delete item failed', err)
    }
  }

  const handleDeleteExistingLink = async (linkId: number) => {
    if (!taskId || !chainKpiId) return
    try {
      await api.delete(`/api/kpis/${chainKpiId}/tasks/${taskId}/outputs/links/${linkId}`)
      setExistingState(prev => prev ? { ...prev, links: (prev.links || []).filter(l => l.link_id !== linkId) } : prev)
    } catch (err) {
      console.error('[UploadModal] delete link failed', err)
    }
  }

  const updateLinkInput = (id: string, index: number, linkInput: string) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, linkInputs: r.linkInputs.map((v, i) => i === index ? linkInput : v) } : r))
  }

  const addLinkInput = (id: string) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, linkInputs: [...r.linkInputs, ''] } : r))
  }

  const removeLinkInput = (id: string, index: number) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, linkInputs: r.linkInputs.filter((_, i) => i !== index) } : r))
  }

  const addFiles = (id: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const newFiles = Array.from(fileList)
    setResults(prev => prev.map(r => r.id === id ? { ...r, files: [...r.files, ...newFiles] } : r))
  }

  const removeFile = (id: string, index: number) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, files: r.files.filter((_, i) => i !== index) } : r))
  }

  const openInNewTab = (src: string | null | undefined) => {
    if (!src) return
    try {
      window.open(String(src), '_blank')
    } catch (e) {
      console.error('openInNewTab failed', e)
    }
  }

  const albumHasExistingData = (result: any, idx: number) => {
    if (!existingState || !Array.isArray(existingState.albums)) return false
    const albumIndex = result.albumIndex ?? (idx + 1)
    const album = existingState.albums.find(a => Number(a.album_index) === Number(albumIndex))
    if (!album) return false
    const albumId = album.album_id
    const hasItem = Array.isArray(existingState.items) && existingState.items.some(i => i.album_id === albumId)
    const hasLink = Array.isArray(existingState.links) && existingState.links.some(l => l.album_id === albumId)
    return Boolean(hasItem || hasLink)
  }

  const formValid = React.useMemo(() => {
    // Each album must have at least one file or one non-empty link, or existing saved outputs (in edit)
    const list = (modeState === 'view' && existingState ? existingState.albums : results)
    for (let idx = 0; idx < list.length; idx++) {
      const result: any = list[idx]
      const filesPresent = Array.isArray(result.files) && result.files.length > 0
      const linksPresent = Array.isArray(result.linkInputs) && result.linkInputs.map((s: string) => s.trim()).filter(Boolean).length > 0
      const existingPresent = albumHasExistingData(result, idx)
      if (!filesPresent && !linksPresent && !existingPresent) return false
    }
    return true
  }, [results, existingState, modeState])

  const handleSave = async () => {
    if (modeState === 'view') return
    if (!taskId || !chainKpiId) {
      notify.error('Thiếu thông tin', 'Thiếu thông tin task/KPI')
      return
    }
    if (!formValid) {
      notify.error('Vui lòng upload đầy đủ kết quả cho tất cả KPI')
      return
    }
    setSaving(true)
    try {
      const payload = {
        albums: results.map((r, idx) => {
          const links = r.linkInputs.map(v => v.trim()).filter(v => v)
          return {
            albumId: r.albumId,
            albumIndex: r.albumIndex ?? (idx + 1),
            links
          }
        })
      }
      const form = new FormData()
      form.append('payload', JSON.stringify(payload))
      results.forEach((r, idx) => {
        r.files.forEach((f) => form.append(`files_${idx}`, f))
      })
      await api.post(`/api/kpis/${chainKpiId}/tasks/${taskId}/outputs`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      try { onSaved && onSaved() } catch (_) {}
      onClose && onClose()
    } catch (err: any) {
      console.error('[UploadModal] save failed', err)
      notify.error('Lưu thất bại', err?.response?.data?.message || 'Vui lòng thử lại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 12 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: 'linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)', borderRadius: 16, padding: 22, width: 760, maxWidth: '94vw', boxShadow: '0 24px 60px rgba(2,6,23,0.35)', maxHeight: '88vh', overflow: 'auto', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: 0.2 }}>Upload kết quả</div>
          </div>
          <button onClick={onClose} style={{ border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 14, width: 30, height: 30, borderRadius: 8, color: '#0f172a' }}>✕</button>
        </div>
        

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(modeState === 'view' && existingState ? existingState.albums : results).map((result: any, idx: number) => (
            <div key={result.id ?? result.album_id ?? idx} style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, position: 'relative', background: '#ffffff', boxShadow: '0 6px 18px rgba(15,23,42,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Album {idx + 1}</div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                {Array.isArray(kpiNames) && kpiNames[idx] ? kpiNames[idx] : `KPI ${idx + 1}`}
              </div>

              {(modeState === 'upload' || modeState === 'edit') && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => addFiles(result.id, e.target.files)}
                      style={{ display: 'none' }}
                    />
                    <span style={{ padding: '7px 12px', background: '#0f172a', color: '#fff', borderRadius: 8, boxShadow: '0 6px 14px rgba(15,23,42,0.2)' }}>Chọn file/ảnh</span>
                    <span style={{ color: '#64748b' }}>Có thể chọn nhiều file</span>
                  </label>
                </div>
              )}

              {(modeState === 'upload' || modeState === 'edit') && result.files.length > 0 && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 10 }}>
                  {result.files.map((file: File, fileIndex: number) => {
                    const isImage = /^image\//i.test(file.type || '')
                    const previewUrl = isImage ? URL.createObjectURL(file) : null
                    return (
                      <div key={`${result.id}-${fileIndex}`} style={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: 10, padding: 6, background: '#f8fafc', height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isImage && previewUrl ? (
                          <img
                            src={previewUrl}
                            alt="preview"
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                            onLoad={() => URL.revokeObjectURL(previewUrl)}
                            onClick={() => openInNewTab(previewUrl)}
                          />
                        ) : (
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', background: '#e2e8f0', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }} onClick={() => openInNewTab(URL.createObjectURL(file))}>
                            FILE
                          </div>
                        )}
                        <button
                          onClick={() => removeFile(result.id, fileIndex)}
                          style={{ position: 'absolute', top: 4, right: 4, border: 'none', background: 'rgba(15,23,42,0.85)', color: '#fff', width: 18, height: 18, borderRadius: 9, cursor: 'pointer', fontSize: 10, lineHeight: '18px' }}
                        >
                          ✕
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {(modeState === 'upload' || modeState === 'edit') && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>Thêm link</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {result.linkInputs.map((value: string, linkIndex: number) => (
                      <div key={`${result.id}-link-input-${linkIndex}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          value={value}
                          onChange={(e) => updateLinkInput(result.id, linkIndex, e.target.value)}
                          placeholder="https://..."
                          style={{ flex: 1, padding: '9px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.06)' }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLinkInput(result.id) } }}
                        />
                        <button
                          onClick={() => removeLinkInput(result.id, linkIndex)}
                          disabled={result.linkInputs.length === 1}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            padding: 0,
                            cursor: result.linkInputs.length === 1 ? 'not-allowed' : 'pointer',
                            opacity: result.linkInputs.length === 1 ? 0.5 : 1,
                            transition: 'transform 160ms ease, opacity 160ms ease'
                          }}
                          onMouseEnter={(e) => { if (result.linkInputs.length > 1) e.currentTarget.style.transform = 'scale(1.08)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                          aria-label="Xóa link"
                        >
                          <img src="/image/minus_icon.png" alt="remove" style={{ width: 18, height: 18, display: 'block' }} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addLinkInput(result.id)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        padding: 0,
                        cursor: 'pointer',
                        alignSelf: 'flex-end',
                        transition: 'transform 160ms ease, opacity 160ms ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                      aria-label="Thêm link"
                    >
                      <img src="/image/plus_icon.png" alt="add" style={{ width: 20, height: 20, display: 'block' }} />
                    </button>
                  </div>
                </div>
              )}

              {(modeState === 'view' || modeState === 'edit') && existingState && (
                <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))', gap: 10 }}>
                  {existingState.items.filter(i => i.album_id === (result.album_id ?? result.albumId)).map((item) => (
                    <div key={item.output_id} style={{ position: 'relative', border: '1px solid #e2e8f0', borderRadius: 10, padding: 6, background: '#f8fafc', height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: modeState === 'view' ? 'pointer' : 'default' }} onClick={() => { if (modeState === 'view') openInNewTab(item.preview_url || item.url_or_path) }}>
                      {item.item_type === 'image' ? (
                        <img src={item.preview_url || item.url_or_path} alt="preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'cover', borderRadius: 6 }} />
                      ) : (
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0f172a', background: '#e2e8f0', borderRadius: 6, padding: '4px 6px' }}>{item.item_type === 'link' ? 'LINK' : 'FILE'}</div>
                      )}
                      {modeState === 'edit' && (
                        <button
                          onClick={() => handleDeleteExistingItem(item.output_id)}
                          style={{ position: 'absolute', top: 4, right: 4, border: 'none', background: 'rgba(15,23,42,0.85)', color: '#fff', width: 18, height: 18, borderRadius: 9, cursor: 'pointer', fontSize: 10, lineHeight: '18px' }}
                          aria-label="Xóa"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {(modeState === 'view' || modeState === 'edit') && existingState && Array.isArray(existingState.links) && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {existingState.links.filter(l => l.album_id === (result.album_id ?? result.albumId)).map((l) => (
                    <a
                      key={l.link_id}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0f172a', border: '1px solid #0f172a', borderRadius: 999, padding: '5px 10px', textDecoration: 'none', boxShadow: '0 6px 12px rgba(15,23,42,0.2)' }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#dbe6ff' }}>Link kết quả công việc</span>
                      {modeState === 'edit' && (
                        <button
                          onClick={(e) => { e.preventDefault(); handleDeleteExistingLink(l.link_id) }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#fca5a5', fontSize: 12 }}
                          aria-label="Xóa"
                        >
                          ✕
                        </button>
                      )}
                    </a>
                  ))}
                </div>
              )}

              {modeState === 'view' && (
                <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredAction(`edit-${result.album_id ?? result.id ?? idx}`)}
                    onMouseLeave={() => setHoveredAction(null)}
                    onClick={() => setModeState('edit')}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      transform: hoveredAction === `edit-${result.album_id ?? result.id ?? idx}` ? 'scale(1.08)' : 'scale(1)',
                      opacity: hoveredAction === `edit-${result.album_id ?? result.id ?? idx}` ? 0.85 : 1,
                      transition: 'transform 160ms ease, opacity 160ms ease'
                    }}
                    aria-label="Chỉnh sửa"
                  >
                    <img src="/image/edit_icon.png" alt="edit" style={{ width: 28, height: 28, display: 'block' }} />
                  </button>
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredAction(`delete-${result.album_id ?? result.id ?? idx}`)}
                    onMouseLeave={() => setHoveredAction(null)}
                    onClick={() => console.log('[UploadModal] delete album', result.album_id ?? result.id ?? idx)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      transform: hoveredAction === `delete-${result.album_id ?? result.id ?? idx}` ? 'scale(1.08)' : 'scale(1)',
                      opacity: hoveredAction === `delete-${result.album_id ?? result.id ?? idx}` ? 0.85 : 1,
                      transition: 'transform 160ms ease, opacity 160ms ease'
                    }}
                    aria-label="Xóa"
                  >
                    <img src="/image/delete_icon.png" alt="delete" style={{ width: 28, height: 28, display: 'block' }} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 18 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 12px', background: '#f1f5f9', borderRadius: 10, border: '1px solid #e2e8f0', cursor: 'pointer', fontWeight: 700 }}>Đóng</button>
            {(modeState === 'upload' || modeState === 'edit') && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ padding: '8px 14px', background: saving ? '#1e293b' : '#0f172a', color: '#fff', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : (!formValid ? 'not-allowed' : 'pointer'), fontWeight: 800, boxShadow: '0 10px 20px rgba(15,23,42,0.25)', opacity: formValid ? 1 : 0.6 }}
              >
                {saving ? 'Đang lưu...' : 'Lưu kết quả'}
              </button>
            )}
          </div>
        </div>
      </div>

      
    </div>
  )
}

export default UploadModal
