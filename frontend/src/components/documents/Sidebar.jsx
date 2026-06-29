import { useCallback, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useDropzone } from 'react-dropzone'
import { useStore } from '../../store/useStore'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, Upload, FileText, Trash2,
  Loader2, LogOut, Sparkles, CheckCircle,
  Layers, Pencil, Tag, Plus, X, Check, Search, ChevronDown, ChevronRight
} from 'lucide-react'

const TAG_COLORS = [
  '#7c6af7', '#5eead4', '#f97316', '#ec4899',
  '#84cc16', '#f59e0b', '#3b82f6', '#8b5cf6',
]

const MIN_WIDTH = 180
const MAX_WIDTH = 320
const DEFAULT_WIDTH = 224 // w-56

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function DocSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-2">
      {[1, 2, 3].map(i => (
        <div key={i} className="px-3 py-2.5 rounded-xl flex items-start gap-2.5 animate-pulse">
          <div className="w-3.5 h-3.5 rounded bg-bg-tertiary mt-0.5 flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-2.5 bg-bg-tertiary rounded w-3/4" />
            <div className="h-2 bg-bg-tertiary rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SuggestionSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-8 bg-bg-tertiary rounded-lg animate-pulse" />
      ))}
    </div>
  )
}

function TagManagerContent({ doc, onClose }) {
  const { tags, assignTag, removeTagFromDoc, createTag, deleteTag } = useStore()
  const [newTagName, setNewTagName] = useState('')
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0])
  const [creating, setCreating] = useState(false)

  const docTagIds = new Set(doc.tags?.map(t => t.id) || [])

  const handleCreate = async () => {
    if (!newTagName.trim()) return
    setCreating(true)
    try {
      const tag = await createTag(newTagName.trim(), selectedColor)
      await assignTag(doc.id, tag.id)
      setNewTagName('')
      toast.success(`Tag "${tag.name}" created`)
    } catch (_) {
      toast.error('Failed to create tag')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteTag = async (tag) => {
    if (!confirm(`Delete tag "${tag.name}"? It will be removed from all documents.`)) return
    try {
      await deleteTag(tag.id)
      toast.success(`Tag "${tag.name}" deleted`)
    } catch (_) {
      toast.error('Failed to delete tag')
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-muted uppercase tracking-widest">Manage tags</span>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-col gap-1 mb-3">
          {tags.map(tag => {
            const assigned = docTagIds.has(tag.id)
            return (
              <div key={tag.id} className="flex items-center gap-1.5 group/tag">
                <button
                  onClick={() => assigned ? removeTagFromDoc(doc.id, tag.id) : assignTag(doc.id, tag.id)}
                  className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all text-left"
                  style={{ background: assigned ? tag.color + '15' : 'transparent', border: `1px solid ${assigned ? tag.color + '50' : 'transparent'}` }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: tag.color }} />
                  <span className="text-[11px] font-mono flex-1 truncate" style={{ color: tag.color }}>{tag.name}</span>
                  {assigned && <Check size={9} style={{ color: tag.color }} />}
                </button>
                <button
                  onClick={() => handleDeleteTag(tag)}
                  className="opacity-0 group-hover/tag:opacity-100 text-muted hover:text-red-400 transition-all flex-shrink-0 p-1 rounded"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <input
          value={newTagName}
          onChange={e => setNewTagName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); e.stopPropagation() }}
          placeholder="New tag name…"
          className="w-full text-[11px] bg-bg-secondary border border-border rounded-lg px-2.5 py-1.5
            outline-none focus:border-accent-purple/50 text-[var(--text-color)] font-mono transition-colors"
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          {TAG_COLORS.map(c => (
            <button key={c} onClick={() => setSelectedColor(c)}
              className="w-4 h-4 rounded-full transition-transform hover:scale-110 flex-shrink-0"
              style={{ background: c, outline: selectedColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }}
            />
          ))}
          <button onClick={handleCreate} disabled={!newTagName.trim() || creating}
            className="ml-auto flex items-center gap-1 text-[10px] font-mono text-muted hover:text-accent-purple border border-border hover:border-accent-purple/40 rounded-lg px-2 py-1 transition-all disabled:opacity-40">
            {creating ? <Loader2 size={9} className="animate-spin" /> : <Plus size={9} />}
            add
          </button>
        </div>
      </div>
    </>
  )
}

function TagManagerPortal({ doc, onClose }) {
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    const el = document.getElementById(`tag-btn-${doc.id}`)
    if (el) {
      const rect = el.getBoundingClientRect()
      setPos({ top: rect.top, left: rect.right + 8 })
    }
    const handler = (e) => {
      const portal = document.getElementById(`tag-portal-${doc.id}`)
      const tagBtn = document.getElementById(`tag-btn-${doc.id}`)
      if (portal && !portal.contains(e.target) && tagBtn && !tagBtn.contains(e.target)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return createPortal(
    <motion.div
      id={`tag-portal-${doc.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="w-52 p-3 bg-bg-secondary border border-border rounded-xl shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      <TagManagerContent doc={doc} onClose={onClose} />
    </motion.div>,
    document.body
  )
}

export default function Sidebar({ isOpen, onClose }) {
  const {
    documents, activeDoc, activeDocs, multiMode, uploading, uploadProgress,
    tags, activeTagFilter, fetchTags,
    uploadDocument, deleteDocument, renameDocument, setActiveDoc, toggleDocSelection,
    setActiveTagFilter, loadHistory, logout, sendMessage, searchDocuments,
  } = useStore()

  const [suggestionsOpen, setSuggestionsOpen] = useState(true)
  const [suggestions, setSuggestions] = useState([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [taggingDocId, setTaggingDocId] = useState(null)
  const renameInputRef = useRef(null)
  const [docSearch, setDocSearch] = useState('')
  const [docSearchResults, setDocSearchResults] = useState([])
  const [searchingDocs, setSearchingDocs] = useState(false)
  const [isDraggingState, setIsDraggingState] = useState(false)
  // ── Drag-to-resize (desktop only) ────────────────────────────────────────────
  const isMobile = () => window.innerWidth < 768
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-width')
      return saved ? parseInt(saved, 10) : DEFAULT_WIDTH
    }
    return DEFAULT_WIDTH
  })
  const [collapsed, setCollapsed] = useState(false)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  const handleDragStart = (e) => {
    if (isMobile()) return
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    setIsDraggingState(true)

  }

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return
      const delta = e.clientX - dragStartX.current
      const newWidth = dragStartWidth.current + delta

      if (newWidth < MIN_WIDTH) {
        // Snap to collapsed below threshold
        setCollapsed(true)
        setSidebarWidth(DEFAULT_WIDTH)
      } else {
        setCollapsed(false)
        const clamped = Math.min(newWidth, MAX_WIDTH)
        setSidebarWidth(clamped)
      }
    }

    const onUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('sidebar-width', sidebarWidth.toString())
      setIsDraggingState(false)

    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [sidebarWidth])

  // Persist width on change
  useEffect(() => {
    if (!collapsed) localStorage.setItem('sidebar-width', sidebarWidth.toString())
  }, [sidebarWidth, collapsed])

  useEffect(() => {
    const t = setTimeout(() => setLoadingDocs(false), 600)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => { fetchTags() }, [])

  useEffect(() => {
    const handler = () => setCollapsed(s => !s)
    window.addEventListener('toggle-sidebar', handler)
    return () => window.removeEventListener('toggle-sidebar', handler)
  }, [])

  const handleDocSearch = async (q) => {
    setDocSearch(q)
    if (q.trim().length < 2) { setDocSearchResults([]); return }
    setSearchingDocs(true)
    try {
      const results = await searchDocuments(q.trim())
      setDocSearchResults(results)
    } catch (_) {}
    finally { setSearchingDocs(false) }
  }

  const generateSuggestions = async (doc) => {
    setLoadingSuggestions(true)
    setSuggestions([])
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/chat/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          doc_id: doc.id,
          query: 'Generate exactly 3 short questions (max 8 words each) someone might ask about this document. Return ONLY a JSON array of strings. Example: ["What is X?", "How does Y work?", "What are the Z?"]',
          history: [],
        }),
      })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.text) fullText += data.text
          } catch (_) {}
        }
      }
      const match = fullText.match(/\[.*?\]/s)
      if (match) setSuggestions(JSON.parse(match[0]).slice(0, 3))
    } catch (_) {}
    finally { setLoadingSuggestions(false) }
  }

  useEffect(() => {
    const handler = (e) => generateSuggestions(e.detail)
    window.addEventListener('regenerate-suggestions', handler)
    return () => window.removeEventListener('regenerate-suggestions', handler)
  }, [])

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus()
  }, [renamingId])

  const startRename = (e, doc) => {
    e.stopPropagation()
    setRenamingId(doc.id)
    setRenameValue(doc.filename)
  }

  const commitRename = async (docId) => {
    const trimmed = renameValue.trim()
    if (!trimmed) { setRenamingId(null); return }
    try {
      await renameDocument(docId, trimmed)
      toast.success('Renamed')
    } catch (_) {
      toast.error('Rename failed')
    }
    setRenamingId(null)
  }

  const onDrop = useCallback(async (accepted) => {
    if (!accepted.length) return
    try {
      const uploads = accepted.map(file =>
        toast.promise(uploadDocument(file), {
          loading: `Indexing ${file.name}…`,
          success: `${file.name} ready!`,
          error: (e) => e.response?.data?.detail || `Failed: ${file.name}`,
        })
      )
      const results = await Promise.all(uploads)
      const lastDoc = results[results.length - 1]
      if (lastDoc) generateSuggestions(lastDoc)
    } catch (_) {}
  }, [uploadDocument])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [], 'text/plain': [], 'text/markdown': [] },
    maxFiles: 10,
    multiple: true,
    disabled: uploading,
  })

  const handleDelete = async (e, doc) => {
    e.stopPropagation()
    if (!confirm(`Delete "${doc.filename}"?`)) return
    await deleteDocument(doc.id)
    setSuggestions([])
    toast.success('Document deleted')
  }

  const handleSelect = async (doc) => {
    if (taggingDocId === doc.id) return
    if (multiMode) {
      toggleDocSelection(doc.id)
    } else {
      setActiveDoc(doc)
      await loadHistory(doc.id)
      generateSuggestions(doc)
    }
    // Close sidebar on mobile after selecting
    if (isMobile()) onClose?.()
  }

  const filteredDocs = activeTagFilter
    ? documents.filter(d => d.tags?.some(t => t.id === activeTagFilter))
    : documents

  // ── Sidebar inner content ────────────────────────────────────────────────────
  const sidebarContent = (
    <aside
      className="bg-bg-secondary border-r border-border flex flex-col h-full relative select-none group/sidebar"
      style={{
        width: collapsed ? 0 : sidebarWidth,
        minWidth: collapsed ? 0 : sidebarWidth,
        overflow: collapsed ? 'hidden' : undefined,
        transition: isDraggingState ? 'none' : 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-purple to-accent-teal flex items-center justify-center flex-shrink-0">
          <Brain size={14} color="#fff" />
        </div>
        <span className="font-bold text-sm tracking-tight truncate">DocMind</span>
      </div>

      {/* Upload zone */}
      <div className="p-3 flex-shrink-0">
        <motion.div
          {...getRootProps()}
          whileHover={{ scale: 1.01 }}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-accent-purple bg-accent-purple/5' : 'border-border hover:border-accent-purple/50'}`}
        >
          <input {...getInputProps()} />
          {uploading
            ? <Loader2 size={20} className="mx-auto mb-1.5 text-accent-purple animate-spin" />
            : <Upload size={20} className="mx-auto mb-1.5 text-muted" />
          }
          <p className="text-xs text-muted leading-snug">
            {uploading ? 'Indexing…' : isDragActive ? 'Drop them!' : 'Drop PDFs or TXT\nor click to upload'}
          </p>
        </motion.div>

        <AnimatePresence>
          {uploading && uploadProgress.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 flex flex-col gap-1">
              {uploadProgress.map((p, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-2">
                  {p.done
                    ? <CheckCircle size={10} className="text-accent-teal flex-shrink-0" />
                    : <div className="w-2.5 h-2.5 rounded-full border border-muted flex-shrink-0" />
                  }
                  <span className={`text-[10px] font-mono ${p.done ? 'text-accent-teal' : 'text-muted'}`}>{p.step}</span>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tag filters */}
      <AnimatePresence>
        {tags.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-3 pb-2 flex-shrink-0">
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setActiveTagFilter(null)}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${!activeTagFilter ? 'border-accent-purple/50 bg-accent-purple/10 text-accent-purple' : 'border-border text-muted hover:border-accent-purple/30'}`}
              >
                all
              </button>
              {tags.map(tag => (
                <button key={tag.id} onClick={() => setActiveTagFilter(activeTagFilter === tag.id ? null : tag.id)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all"
                  style={{ borderColor: activeTagFilter === tag.id ? tag.color : tag.color + '40', background: activeTagFilter === tag.id ? tag.color + '20' : 'transparent', color: tag.color, opacity: activeTagFilter && activeTagFilter !== tag.id ? 0.5 : 1 }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document search */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 bg-bg-tertiary border border-border rounded-lg px-2.5 py-1.5">
          <Search size={11} className="text-muted flex-shrink-0" />
          <input value={docSearch} onChange={e => handleDocSearch(e.target.value)} placeholder="Search across docs…"
            className="flex-1 bg-transparent text-[11px] font-mono text-[var(--text-color)] placeholder:text-muted outline-none"
          />
          {docSearch && <button onClick={() => { setDocSearch(''); setDocSearchResults([]) }}><X size={10} className="text-muted hover:text-[var(--text-color)]" /></button>}
        </div>
        <AnimatePresence>
          {(docSearchResults.length > 0 || searchingDocs) && docSearch.length >= 2 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 flex flex-col gap-1">
              {searchingDocs ? (
                <div className="flex items-center gap-2 px-1 py-2">
                  <Loader2 size={11} className="animate-spin text-muted" />
                  <span className="text-[10px] font-mono text-muted">searching…</span>
                </div>
              ) : docSearchResults.length === 0 ? (
                <p className="text-[10px] font-mono text-muted px-1 py-2">No results found.</p>
              ) : docSearchResults.map((r, i) => (
                <motion.button key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  onClick={async () => {
                    const doc = documents.find(d => d.id === r.doc_id)
                    if (!doc) return
                    setActiveDoc(doc)
                    await loadHistory(doc.id)
                    generateSuggestions(doc)
                    setDocSearch('')
                    setDocSearchResults([])
                    window.dispatchEvent(new CustomEvent('prefill-input', { detail: docSearch }))
                    if (isMobile()) onClose?.()
                  }}                  
                className="text-left px-2.5 py-2 rounded-lg border border-border hover:border-accent-purple/40 hover:bg-accent-purple/5 transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-mono text-accent-purple truncate">{r.filename}</span>
                    <span className="text-[9px] font-mono text-muted flex-shrink-0 ml-1">{Math.round(r.similarity * 100)}%</span>
                  </div>
                  <p className="text-[10px] text-muted leading-relaxed line-clamp-2">{r.text}</p>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Multi-mode banner */}
      <AnimatePresence>
        {multiMode && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mx-3 mb-2 px-3 py-2 bg-accent-purple/10 border border-accent-purple/30 rounded-xl flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <Layers size={11} className="text-accent-purple" />
              <span className="text-[10px] font-mono text-accent-purple">{activeDocs.length} docs selected</span>
            </div>
            <p className="text-[9px] text-muted font-mono mt-0.5">Querying across all selected</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between px-4 pt-1 pb-2 flex-shrink-0">
        <p className="text-[10px] font-mono text-muted uppercase tracking-widest">
          Documents {activeTagFilter ? '· filtered' : ''}
        </p>
        {documents.length > 1 && (
          <button
            onClick={async () => {
              if (multiMode) {
                useStore.setState({ multiMode: false, activeDocs: activeDoc ? [activeDoc.id] : [] })
                if (activeDoc) { await loadHistory(activeDoc.id); generateSuggestions(activeDoc) }
              } else {
                useStore.setState({ multiMode: true, activeDocs: documents.map(d => d.id), messages: [] })
              }
            }}
            className="text-[9px] font-mono text-muted hover:text-accent-purple transition-colors"
          >
            {multiMode ? 'single' : 'multi'}
          </button>
        )}
      </div>

      {/* Doc list */}
      <div className="flex-1 overflow-y-auto px-2 flex flex-col gap-1">
        {loadingDocs ? (
          <DocSkeleton />
        ) : filteredDocs.length === 0 ? (
          <p className="text-xs text-muted text-center mt-4 px-4 leading-relaxed">
            {activeTagFilter ? 'No documents with this tag.' : 'No documents yet.'}
          </p>
        ) : (
          <AnimatePresence>
            {filteredDocs.map((doc) => {
              const isActive = multiMode ? activeDocs.includes(doc.id) : activeDoc?.id === doc.id
              const isRenaming = renamingId === doc.id
              const isTagging = taggingDocId === doc.id

              return (
                <div key={doc.id}>
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    onClick={() => !isRenaming && handleSelect(doc)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-2.5 group transition-colors cursor-pointer
                      ${isActive ? 'bg-accent-purple/10 border border-accent-purple/30' : 'hover:bg-bg-tertiary border border-transparent'}`}
                  >
                    <FileText size={14} className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-accent-purple' : 'text-muted'}`} />
                    <div className="flex-1 min-w-0">
                      {isRenaming ? (
                        <input ref={renameInputRef} value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => commitRename(doc.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(doc.id); if (e.key === 'Escape') setRenamingId(null); e.stopPropagation() }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-xs bg-bg-tertiary border border-accent-purple/50 rounded px-1.5 py-0.5 outline-none text-[var(--text-color)] font-medium"
                        />
                      ) : (
                        <p className="text-xs font-medium truncate">{doc.filename}</p>
                      )}
                      <p className="text-[10px] text-muted font-mono mt-0.5">{doc.chunk_count} chunks · {formatSize(doc.file_size)}</p>
                      {doc.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {doc.tags.map(tag => (
                            <span key={tag.id} className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                              style={{ background: tag.color + '20', color: tag.color }}>
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      <button id={`tag-btn-${doc.id}`}
                        onClick={(e) => { e.stopPropagation(); setTaggingDocId(isTagging ? null : doc.id) }}
                        className={`opacity-0 group-hover:opacity-100 transition-all ${isTagging ? 'text-accent-purple !opacity-100' : 'text-muted hover:text-accent-purple'}`}>
                        <Tag size={11} />
                      </button>
                      <button onClick={(e) => startRename(e, doc)} className="opacity-0 group-hover:opacity-100 text-muted hover:text-accent-purple transition-all">
                        <Pencil size={11} />
                      </button>
                      <button onClick={(e) => handleDelete(e, doc)} className="hover-red opacity-0 group-hover:opacity-100 text-muted transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </motion.div>

                  {isTagging && <TagManagerPortal doc={doc} onClose={() => setTaggingDocId(null)} />}
                </div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Suggested questions */}
      <AnimatePresence>
        {!multiMode && (suggestions.length > 0 || loadingSuggestions) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-3 pb-3 border-t border-border pt-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles size={11} className="text-accent-teal" />
                <p className="text-[10px] font-mono text-muted uppercase tracking-widest">Suggested</p>
              </div>
              <button
                onClick={() => setSuggestionsOpen(s => !s)}
                className="text-muted hover:text-accent-purple transition-colors"
              >
                <motion.div animate={{ rotate: suggestionsOpen ? 0 : -90 }} transition={{ duration: 0.2 }}>
                  {suggestionsOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </motion.div>
              </button>
            </div>
            <AnimatePresence initial={false}>
              {suggestionsOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {loadingSuggestions ? <SuggestionSkeleton /> : (
                    <div className="flex flex-col gap-1.5">
                      {suggestions.map((q, i) => (
                        <motion.button key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                          onClick={() => sendMessage(q)}
                          className="text-left text-[11px] text-muted hover:text-accent-purple border border-border hover:border-accent-purple/40 rounded-lg px-2.5 py-1.5 transition-all leading-snug hover:bg-accent-purple/5">
                          {q}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="p-3 border-t border-border flex-shrink-0">
        <button onClick={logout} className="hover-red w-full flex items-center gap-2 px-3 py-2 text-xs text-muted rounded-lg transition-colors">
          <LogOut size={13} />
          Sign out
        </button>
      </div>

      {/* Drag handle — desktop only */}
      <div
        onMouseDown={handleDragStart}
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize z-10 hover:bg-accent-purple/40 transition-colors hidden md:block"
        title="Drag to resize"
      />
    </aside>
  )

  // ── Mobile: overlay + backdrop ───────────────────────────────────────────────
  return (
    <>
      {/* Desktop sidebar — always in flow */}
      <div className="hidden md:flex h-full" style={{ width: collapsed ? 0 : sidebarWidth, flexShrink: 0, transition: isDraggingState ? 'none' : 'width 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        {sidebarContent}
      </div>

      {/* Collapse/expand button — always rendered, switches direction */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => setCollapsed(s => !s)}
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 z-30
          w-5 h-10 items-center justify-center
          bg-bg-secondary border border-border border-l-0
          rounded-r-lg text-muted hover:text-accent-purple
          hover:border-accent-purple/50 transition-all"
          style={{
            left: collapsed ? 0 : sidebarWidth - 1,
            transition: isDraggingState ? 'none' : 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
          }}        
          title={collapsed ? 'Expand sidebar (⌘B)' : 'Collapse sidebar (⌘B)'}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          {collapsed
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          }
        </svg>
      </motion.button>

      {/* Mobile sidebar — fixed overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            />
            {/* Slide-in panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed top-0 left-0 h-full z-50 md:hidden"
              style={{ width: DEFAULT_WIDTH }}
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}