import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/documents/Sidebar'
import ChatMessage from '../components/chat/ChatMessage'
import ChatInput from '../components/chat/ChatInput'
import KeyboardShortcuts from '../components/ui/KeyboardShortcuts'
import jsPDF from 'jspdf'
import {
  FileSearch, Download, LayoutDashboard, Sun, Moon, Keyboard,
  Trash2, X, Loader2, Search, ChevronUp, ChevronDown,
  Pin, MoreHorizontal, FileCode, FileText, Menu, Brain
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

function ThinkingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex flex-col gap-2 items-start"
    >
      <span className="text-[10px] font-mono text-muted px-1">docmind</span>
      <div className="bg-bg-tertiary border border-border rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: 'var(--muted-color)',
            }}
            animate={{ y: [0, -6, 0, 6, 0] }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

function ClearChatModal({ onConfirm, onCancel }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-auto w-full max-w-sm mx-4 bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-bold text-sm">Clear chat history?</h2>
            <p className="text-[11px] text-muted font-mono mt-0.5">this action is irreversible</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-muted leading-relaxed">
              All messages in this conversation will be permanently cleared.
              You won't be able to recover them.
            </p>
          </div>
          <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs font-mono text-muted border border-border rounded-lg
                hover:border-accent-purple/50 hover:text-accent-purple transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-3 py-1.5 text-xs font-mono text-white bg-red-500 hover:bg-red-600
                rounded-lg transition-all"
            >
              Clear chat
            </button>
          </div>
        </motion.div>
      </div>
    </>
  )
}

export default function AppPage() {
  const {
    activeDoc, messages, isThinking,
    sendMessage, fetchDocuments, theme, toggleTheme, clearChat, togglePinMessage
  } = useStore()
  const bottomRef = useRef(null)
  const searchInputRef = useRef(null)
  const navigate = useNavigate()
  const [showClearModal, setShowClearModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef(null)

  // Mobile sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Summary state
  const [summary, setSummary] = useState('')
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [summaryDocId, setSummaryDocId] = useState(null)
  const [summaryDismissed, setSummaryDismissed] = useState(false)

  // Search state
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)

  // Pinned flyout
  const [showPinned, setShowPinned] = useState(false)

  const matchingIndices = searchQuery.trim().length >= 2
    ? messages.reduce((acc, msg, i) => {
        const content = msg.content.toLowerCase()
        const query = searchQuery.toLowerCase()
        let pos = content.indexOf(query)
        while (pos !== -1) {
          acc.push({ msgIndex: i, occurrencePos: pos })
          pos = content.indexOf(query, pos + 1)
        }
        return acc
      }, [])
    : []

  const totalMatches = matchingIndices.length
  const pinnedMessages = messages.filter(m => m.pinned)

  const openSearch = () => {
    setShowSearch(true)
    setSearchQuery('')
    setSearchMatchIndex(0)
    setTimeout(() => searchInputRef.current?.focus(), 50)
  }

  const closeSearch = () => {
    setShowSearch(false)
    setSearchQuery('')
    setSearchMatchIndex(0)
  }

  const goToMatch = (idx) => {
    const match = matchingIndices[idx]
    if (!match) return
    const el = document.getElementById(`msg-${match.msgIndex}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const nextMatch = () => {
    const next = (searchMatchIndex + 1) % totalMatches
    setSearchMatchIndex(next)
    goToMatch(next)
  }

  const prevMatch = () => {
    const prev = (searchMatchIndex - 1 + totalMatches) % totalMatches
    setSearchMatchIndex(prev)
    goToMatch(prev)
  }

  useEffect(() => {
    if (searchQuery && totalMatches > 0) {
      setSearchMatchIndex(0)
      goToMatch(0)
    }
  }, [searchQuery])

  const handleExportPDF = async () => {
    setShowMenu(false)
    if (!messages.length || !activeDoc) return
    setExporting(true)
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 16
      const maxW = pageW - margin * 2
      let y = 20

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(124, 106, 247)
      doc.text('DocMind — Chat Export', margin, y)
      y += 8

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(136, 136, 136)
      doc.text(`Document: ${activeDoc.filename}`, margin, y); y += 5
      doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y); y += 5
      doc.text(`Total messages: ${messages.length}`, margin, y); y += 10

      doc.setDrawColor(46, 46, 46)
      doc.line(margin, y, pageW - margin, y); y += 8

      for (const msg of messages) {
        if (msg.streaming) continue
        if (y > 270) { doc.addPage(); y = 20 }

        const isUser = msg.role === 'user'
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(isUser ? 124 : 94, isUser ? 106 : 234, isUser ? 247 : 212)
        doc.text(isUser ? 'YOU' : 'DOCMIND', margin, y); y += 5

        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(50, 50, 50)

        const clean = msg.content
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`(.*?)`/g, '$1')
          .replace(/#{1,6}\s/g, '')

        const lines = doc.splitTextToSize(clean, maxW)
        for (const line of lines) {
          if (y > 275) { doc.addPage(); y = 20 }
          doc.text(line, margin, y); y += 5
        }
        y += 6

        doc.setDrawColor(220, 220, 220)
        doc.line(margin, y, pageW - margin, y); y += 6
      }

      doc.save(`docmind-${activeDoc.filename.replace('.pdf', '')}-chat.pdf`)
    } finally {
      setExporting(false)
    }
  }

  const handleExportMarkdown = () => {
    setShowMenu(false)
    if (!messages.length || !activeDoc) return

    const lines = [
      `# DocMind — Chat Export`,
      ``,
      `**Document:** ${activeDoc.filename}`,
      `**Exported:** ${new Date().toLocaleString()}`,
      `**Total messages:** ${messages.length}`,
      ``,
      `---`,
      ``,
    ]

    for (const msg of messages) {
      if (msg.streaming) continue
      const role = msg.role === 'user' ? '**You**' : '**DocMind**'
      lines.push(role)
      lines.push(``)
      lines.push(msg.content)
      lines.push(``)
      lines.push(`---`)
      lines.push(``)
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `docmind-${activeDoc.filename.replace('.pdf', '')}-chat.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const generateSummary = async (doc) => {
    if (summaryDocId === doc.id && summary) return
    setSummary('')
    setSummaryDocId(doc.id)
    setSummaryDismissed(false)
    setLoadingSummary(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/docs/${doc.id}/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.text) setSummary(s => s + data.text)
          } catch (_) {}
        }
      }
    } catch (_) {}
    finally { setLoadingSummary(false) }
  }

  useEffect(() => { fetchDocuments() }, [])

  useEffect(() => {
    if (activeDoc) {
      window.dispatchEvent(new CustomEvent('regenerate-suggestions', { detail: activeDoc }))
      generateSummary(activeDoc)
    } else {
      setSummary('')
      setSummaryDocId(null)
      setSummaryDismissed(false)
    }
  }, [activeDoc?.id])

  const prevMessageCount = useRef(0)
  useEffect(() => {
    if (messages.length > prevMessageCount.current || isThinking) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessageCount.current = messages.length
  }, [messages, isThinking])

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        if (messages.length > 0) openSearch()
        return
      }
      if (e.key === 'Escape') {
        if (showSearch) { closeSearch(); return }
        if (sidebarOpen) { setSidebarOpen(false); return }
      }
      if (e.metaKey && e.key === 'k') { e.preventDefault(); document.querySelector('textarea')?.focus(); return }
      if (e.metaKey && e.key === 'l') { e.preventDefault(); toggleTheme(); return }
      if (e.metaKey && e.key === 'd') { e.preventDefault(); navigate('/dashboard'); return }
      if (e.metaKey && e.shiftKey && e.key === 'c') { e.preventDefault(); if (messages.length > 0) setShowClearModal(true); return }
      if (e.metaKey && e.key === 'e') { e.preventDefault(); handleExportPDF(); return }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('toggle-sidebar'))
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleTheme, navigate, messages.length, showSearch, sidebarOpen])

  const handleConfirmClear = () => {
    clearChat()
    setShowClearModal(false)
  }

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
        setShowPinned(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const highlight = localStorage.getItem('highlightQuestion')
    if (!highlight || !messages.length) return

    const idx = messages.findIndex(m =>
      m.role === 'user' && m.content.startsWith(highlight.replace('…', '').slice(0, 60))
    )
    if (idx === -1) return

    localStorage.removeItem('highlightQuestion')

    setTimeout(() => {
      const msgEls = document.querySelectorAll('[data-msg-index]')
      const el = msgEls[idx]
      if (!el) return

      el.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Target the bubble div inside, not the full-width wrapper
      const bubble = el.querySelector('div[class*="rounded-2xl"]')
      if (!bubble) return

      bubble.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease'
      bubble.style.boxShadow = '0 0 0 2px #7c6af7, 0 0 20px rgba(124, 106, 247, 0.3)'
      bubble.style.transform = 'scale(1.01)'

      setTimeout(() => {
        bubble.style.boxShadow = 'none'
        bubble.style.transform = 'scale(1)'
      }, 2000)
    }, 300)
  }, [messages])

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden relative">

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <KeyboardShortcuts />

      <AnimatePresence>
        {showClearModal && (
          <ClearChatModal onConfirm={handleConfirmClear} onCancel={() => setShowClearModal(false)} />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-4 md:px-6 py-4 border-b border-border bg-bg-secondary flex items-center justify-between relative z-40"
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden flex items-center justify-center w-8 h-8 text-muted border border-border
                rounded-lg hover:border-accent-purple/50 hover:text-accent-purple transition-all flex-shrink-0"
            >
              <Menu size={14} />
            </button>

            <div className="min-w-0">
              {activeDoc ? (
                <>
                  <h1 className="font-bold text-sm truncate max-w-[160px] md:max-w-md">{activeDoc.filename}</h1>
                  <p className="text-[11px] text-muted font-mono mt-0.5">
                    {activeDoc.chunk_count} chunks indexed · ready to chat
                  </p>
                </>
              ) : (
                <h1 className="font-bold text-sm text-muted">No document selected</h1>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={menuRef}>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => { setShowMenu(s => !s); setShowPinned(false) }}
                className={`w-8 h-8 flex items-center justify-center text-muted border border-border
                  rounded-lg hover:border-accent-purple/50 hover:text-accent-purple transition-all
                  ${showMenu ? 'border-accent-purple/50 text-accent-purple' : ''}`}
              >
                <MoreHorizontal size={14} />
              </motion.button>

              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-10 z-50 w-48 bg-bg-secondary border border-border rounded-xl shadow-2xl py-1"
                  >
                    {activeDoc && messages.length > 0 && (
                      <>
                        <button onClick={handleExportPDF} disabled={exporting}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono text-muted hover:text-accent-purple hover:bg-bg-tertiary transition-all disabled:opacity-50">
                          {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                          Export as PDF
                        </button>
                        <button onClick={handleExportMarkdown}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono text-muted hover:text-accent-teal hover:bg-bg-tertiary transition-all">
                          <FileCode size={12} />
                          Export as Markdown
                        </button>
                        <div className="h-px bg-border mx-3 my-1" />
                      </>
                    )}

                    <div className="relative"
                      onMouseEnter={() => setShowPinned(true)}
                      onMouseLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setShowPinned(false) }}
                    >
                      <button className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono transition-all hover:bg-bg-tertiary ${showPinned ? 'text-accent-purple bg-bg-tertiary' : 'text-muted hover:text-accent-purple'}`}>
                        <Pin size={12} />
                        Pinned Messages
                        {pinnedMessages.length > 0 && (
                          <span className="text-[10px] bg-accent-purple/20 text-accent-purple rounded-full px-1.5 py-0.5 font-mono ml-1">
                            {pinnedMessages.length}
                          </span>
                        )}
                        <svg className="ml-auto w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <AnimatePresence>
                        {showPinned && (
                          <motion.div
                            initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
                            transition={{ duration: 0.12 }}
                            className="absolute right-full top-0 mr-1 w-56 bg-bg-secondary border border-border rounded-xl shadow-2xl py-1 z-[60]"
                          >
                            {pinnedMessages.length === 0 ? (
                              <p className="text-[11px] text-muted font-mono px-3 py-2 italic">No pinned messages yet</p>
                            ) : pinnedMessages.map((m, i) => (
                              <button key={i}
                                onClick={() => {
                                  const idx = messages.indexOf(m)
                                  document.getElementById(`msg-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                  setShowMenu(false); setShowPinned(false)
                                }}
                                className="w-full text-left text-[11px] text-muted hover:text-accent-purple hover:bg-bg-tertiary px-3 py-2 transition-all leading-snug truncate"
                              >
                                {m.content.slice(0, 60)}{m.content.length > 60 ? '…' : ''}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {activeDoc && messages.length > 0 && (
                      <button onClick={() => { openSearch(); setShowMenu(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono text-muted hover:text-accent-purple hover:bg-bg-tertiary transition-all">
                        <Search size={12} />
                        Search chat
                      </button>
                    )}

                    <button onClick={() => { navigate('/dashboard'); setShowMenu(false) }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono text-muted hover:text-accent-purple hover:bg-bg-tertiary transition-all">
                      <LayoutDashboard size={12} />
                      Dashboard
                    </button>

                    {activeDoc && messages.length > 0 && (
                      <>
                        <div className="h-px bg-border mx-3 my-1" />
                        <button onClick={() => { setShowClearModal(true); setShowMenu(false) }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono text-muted hover:text-red-400 hover:bg-bg-tertiary transition-all">
                          <Trash2 size={12} />
                          Clear chat
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button whileTap={{ scale: 0.9 }} onClick={toggleTheme} title="Toggle theme (⌘L)"
              className="w-8 h-8 flex items-center justify-center text-muted border border-border rounded-lg hover:border-accent-purple/50 hover:text-accent-purple transition-all">
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </motion.button>

            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => window.dispatchEvent(new CustomEvent('open-shortcuts'))}
              className="hidden md:flex w-8 h-8 items-center justify-center text-muted border border-border rounded-lg hover:border-accent-purple/50 hover:text-accent-purple transition-all">
              <Keyboard size={13} />
            </motion.button>

            {activeDoc && (
              <div className="hidden sm:flex items-center gap-1.5">
                <motion.div className="w-1.5 h-1.5 rounded-full bg-accent-teal"
                  animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                <span className="text-[10px] font-mono text-muted">indexed</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Search bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="px-4 md:px-6 py-2.5 border-b border-border bg-bg-secondary flex items-center gap-3"
            >
              <Search size={13} className="text-muted flex-shrink-0" />
              <input ref={searchInputRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') e.shiftKey ? prevMatch() : nextMatch(); if (e.key === 'Escape') closeSearch(); e.stopPropagation() }}
                placeholder="Search messages…"
                className="flex-1 bg-transparent text-sm outline-none text-[var(--text-color)] placeholder:text-muted font-mono"
              />
              {searchQuery && (
                <span className="text-[11px] font-mono text-muted flex-shrink-0">
                  {totalMatches === 0 ? 'no matches' : `${searchMatchIndex + 1} / ${totalMatches}`}
                </span>
              )}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={prevMatch} disabled={totalMatches === 0} className="p-1 text-muted hover:text-accent-purple disabled:opacity-30 transition-colors"><ChevronUp size={14} /></button>
                <button onClick={nextMatch} disabled={totalMatches === 0} className="p-1 text-muted hover:text-accent-purple disabled:opacity-30 transition-colors"><ChevronDown size={14} /></button>
                <button onClick={closeSearch} className="p-1 text-muted hover:text-[var(--text-color)] transition-colors"><X size={14} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 flex flex-col gap-5">
          <AnimatePresence>
            {!activeDoc && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center gap-6 py-20 max-w-sm mx-auto text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-purple to-accent-teal flex items-center justify-center">
                  <Brain size={26} color="#fff" />
                </div>
                <div>
                  <p className="font-bold text-base mb-1">Welcome to DocMind</p>
                  <p className="text-xs text-muted leading-relaxed font-mono">
                    Chat with any PDF or text file using AI. Upload a document from the sidebar to get started.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full">
                  {[
                    { num: '01', text: 'Upload a PDF or TXT from the sidebar' },
                    { num: '02', text: 'Ask any question about its contents' },
                    { num: '03', text: 'Get answers grounded in your document' },
                  ].map(step => (
                    <div key={step.num} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-bg-secondary text-left">
                      <span className="text-[10px] font-mono text-muted opacity-50 flex-shrink-0">{step.num}</span>
                      <span className="text-xs text-muted">{step.text}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {activeDoc && !summaryDismissed && (summary || loadingSummary) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                className="flex flex-col gap-2 items-start">
                <span className="text-[10px] font-mono text-muted px-1">TL;DR</span>
                <div className="relative group max-w-[90%] md:max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-sm text-sm leading-relaxed bg-bg-tertiary border border-accent-purple/20 text-[var(--text-color)]">
                  {loadingSummary && !summary ? (
                    <div className="flex items-center gap-2">
                      <Loader2 size={11} className="animate-spin text-muted" />
                      <span className="text-[11px] text-muted font-mono">summarizing…</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted leading-relaxed">{summary}</p>
                  )}
                  <button onClick={() => setSummaryDismissed(true)}
                    className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-bg-secondary border border-border rounded-lg p-1.5 text-muted hover:text-[var(--text-color)]">
                    <X size={11} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} index={i} searchQuery={searchQuery}
              isCurrentMatch={matchingIndices[searchMatchIndex]?.msgIndex === i} onTogglePin={togglePinMessage} />
          ))}

          <AnimatePresence>
            {isThinking && messages.filter(m => m.streaming).every(m => !m.content) && <ThinkingBubble />}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 md:px-6 py-4 border-t border-border bg-bg-secondary">
          <ChatInput onSend={sendMessage} disabled={!activeDoc || isThinking} />
          <p className="hidden md:block text-[10px] text-muted font-mono mt-2 text-center">
            Powered by LLaMA 3.1 + pgvector · press <kbd className="px-1 py-0.5 rounded border border-border bg-bg-tertiary text-[9px]">/</kbd> for shortcuts
          </p>
        </div>
      </div>
    </div>
  )
}