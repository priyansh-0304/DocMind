import { create } from 'zustand'
import api from '../lib/api'

export const useStore = create((set, get) => ({
  // ── Theme ────────────────────────────────────────────────────────────────────
  theme: localStorage.getItem('theme') || 'dark',

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', next)
    if (next === 'light') document.body.classList.add('light')
    else document.body.classList.remove('light')
    set({ theme: next })
  },

  // ── Auth ────────────────────────────────────────────────────────────────────
  user: null,
  token: localStorage.getItem('token') || null,

  login: async (email, password) => {
    const form = new URLSearchParams({ username: email, password })
    const res = await api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    localStorage.setItem('token', res.data.access_token)
    set({ token: res.data.access_token })
  },

  register: async (email, password) => {
    await api.post('/auth/register', { email, password })
  },

  logout: () => {
    localStorage.removeItem('token')
    localStorage.removeItem('activeDocId')
    set({ token: null, user: null, documents: [], activeDoc: null, activeDocs: [], messages: [], tags: [] })
  },

  // ── Tags ─────────────────────────────────────────────────────────────────────
  tags: [],
  activeTagFilter: null,

  fetchTags: async () => {
    const res = await api.get('/docs/tags')
    set({ tags: res.data })
  },

  createTag: async (name, color) => {
    const res = await api.post('/docs/tags', { name, color })
    set((s) => ({ tags: [...s.tags, res.data] }))
    return res.data
  },

  deleteTag: async (tagId) => {
    await api.delete(`/docs/tags/${tagId}`)
    set((s) => ({
      tags: s.tags.filter(t => t.id !== tagId),
      activeTagFilter: s.activeTagFilter === tagId ? null : s.activeTagFilter,
      documents: s.documents.map(d => ({
        ...d,
        tags: d.tags?.filter(t => t.id !== tagId) || [],
      })),
    }))
  },

  assignTag: async (docId, tagId) => {
    await api.post(`/docs/${docId}/tags`, { tag_id: tagId })
    const tag = get().tags.find(t => t.id === tagId)
    if (!tag) return
    set((s) => ({
      documents: s.documents.map(d =>
        d.id === docId && !d.tags?.find(t => t.id === tagId)
          ? { ...d, tags: [...(d.tags || []), tag] }
          : d
      ),
    }))
  },

  removeTagFromDoc: async (docId, tagId) => {
    await api.delete(`/docs/${docId}/tags/${tagId}`)
    set((s) => ({
      documents: s.documents.map(d =>
        d.id === docId
          ? { ...d, tags: d.tags?.filter(t => t.id !== tagId) || [] }
          : d
      ),
    }))
  },

  setActiveTagFilter: (tagId) => {
    set({ activeTagFilter: tagId })
  },

  // ── Documents ───────────────────────────────────────────────────────────────
  documents: [],
  activeDoc: null,
  activeDocs: [],
  multiMode: false,
  uploading: false,
  uploadProgress: [],

  fetchDocuments: async () => {
    const res = await api.get('/docs/')
    const docs = res.data
    set({ documents: docs })

    const savedId = localStorage.getItem('activeDocId')
    if (savedId) {
      const doc = docs.find(d => d.id === parseInt(savedId))
      if (doc) {
        set({ activeDoc: doc, activeDocs: [doc.id] })
        await get().loadHistory(doc.id)
      }
    }
  },

  uploadDocument: async (file) => {
    set({
      uploading: true,
      uploadProgress: [
        { step: 'Reading file…', done: false },
        { step: 'Extracting text…', done: false },
        { step: 'Chunking document…', done: false },
        { step: 'Embedding vectors…', done: false },
        { step: 'Saving to database…', done: false },
      ]
    })

    const progressInterval = setInterval(() => {
      set((s) => {
        const prog = [...s.uploadProgress]
        const nextIdx = prog.findIndex(p => !p.done)
        if (nextIdx !== -1 && nextIdx < prog.length - 1) {
          prog[nextIdx] = { ...prog[nextIdx], done: true }
        }
        return { uploadProgress: prog }
      })
    }, 800)

    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/docs/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      clearInterval(progressInterval)
      localStorage.setItem('activeDocId', res.data.id)
      set((s) => ({
        documents: [res.data, ...s.documents],
        activeDoc: res.data,
        activeDocs: [res.data.id],
        messages: [],
        uploading: false,
        uploadProgress: [],
      }))
      return res.data
    } catch (e) {
      clearInterval(progressInterval)
      set({ uploading: false, uploadProgress: [] })
      throw e
    }
  },

  deleteDocument: async (docId) => {
    await api.delete(`/docs/${docId}`)
    localStorage.removeItem(`chat_cleared_${docId}`)
    if (localStorage.getItem('activeDocId') === String(docId)) {
      localStorage.removeItem('activeDocId')
    }
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== docId),
      activeDoc: s.activeDoc?.id === docId ? null : s.activeDoc,
      activeDocs: s.activeDocs.filter(id => id !== docId),
      messages: s.activeDoc?.id === docId ? [] : s.messages,
    }))
  },

  renameDocument: async (docId, newName) => {
    const res = await api.patch(`/docs/${docId}/rename`, { filename: newName })
    set((s) => ({
      documents: s.documents.map((d) => d.id === docId ? res.data : d),
      activeDoc: s.activeDoc?.id === docId ? res.data : s.activeDoc,
    }))
  },

  setActiveDoc: (doc) => {
    localStorage.setItem('activeDocId', doc.id)
    set({ activeDoc: doc, activeDocs: [doc.id], messages: [], multiMode: false })
  },

  toggleDocSelection: (docId) => {
    set((s) => {
      const already = s.activeDocs.includes(docId)
      const next = already
        ? s.activeDocs.filter(id => id !== docId)
        : [...s.activeDocs, docId]
      return {
        activeDocs: next,
        multiMode: next.length > 1,
        messages: [],
      }
    })
  },

  searchDocuments: async (query) => {
    const res = await api.get(`/docs/search?q=${encodeURIComponent(query)}`)
    return res.data
  },

  // ── Chat ────────────────────────────────────────────────────────────────────
  messages: [],
  isThinking: false,

  clearChat: () => {
    const { activeDoc } = get()
    if (activeDoc) {
      localStorage.setItem(`chat_cleared_${activeDoc.id}`, 'true')
    }
    set({ messages: [] })
  },

  loadHistory: async (docId) => {
    if (localStorage.getItem(`chat_cleared_${docId}`) === 'true') {
      set({ messages: [] })
      return
    }

    const res = await api.get(`/chat/history/${docId}`)
    set({
      messages: res.data.map((m) => ({
        role: m.role,
        content: m.content,
        sources: [],
        timestamp: m.created_at,
        pinId: `${docId}-${m.created_at}`,
        pinned: false,
      })),
    })

    const stored = JSON.parse(localStorage.getItem(`pins_${docId}`) || '[]')
    if (stored.length) {
      set((s) => ({
        messages: s.messages.map(m => ({
          ...m,
          pinned: stored.includes(m.pinId),
        }))
      }))
    }
  },

  sendMessage: async (query) => {
    const { activeDoc, activeDocs, multiMode, messages } = get()
    if (!activeDoc && activeDocs.length === 0) return

    if (activeDoc) {
      localStorage.removeItem(`chat_cleared_${activeDoc.id}`)
    }

    const userMsg = {
      role: 'user',
      content: query,
      sources: [],
      timestamp: new Date().toISOString(),
      pinned: false,
      pinId: `new-user-${Date.now()}`,
    }
    set((s) => ({ messages: [...s.messages, userMsg], isThinking: true }))

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const token = localStorage.getItem('token')
      const endpoint = multiMode ? '/chat/stream/multi' : '/chat/stream'
      const body = multiMode
        ? { doc_ids: activeDocs, query, history }
        : { doc_id: activeDoc.id, query, history }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let sources = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.sources) sources = data.sources
            if (data.text) {
              set((s) => {
                const msgs = [...s.messages]
                const last = msgs[msgs.length - 1]
                if (last?.streaming) {
                  const updated = { ...last }
                  updated.content += data.text
                  updated.sources = sources
                  msgs[msgs.length - 1] = updated
                  return { messages: msgs }
                } else {
                  return {
                    messages: [...msgs, {
                      role: 'assistant',
                      content: data.text,
                      sources,
                      streaming: true,
                      timestamp: new Date().toISOString(),
                      pinned: false,
                      pinId: `new-assistant-${Date.now()}`,
                    }]
                  }
                }
              })
            }
            if (data.done) {
              set((s) => {
                const msgs = [...s.messages]
                const last = { ...msgs[msgs.length - 1] }
                last.streaming = false
                msgs[msgs.length - 1] = last
                return { messages: msgs, isThinking: false }
              })
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      set((s) => ({
        messages: [
          ...s.messages,
          {
            role: 'assistant',
            content: 'Error: Could not get a response.',
            sources: [],
            streaming: false,
            timestamp: new Date().toISOString(),
          },
        ],
        isThinking: false,
      }))
    }
  },

  retryMessage: async () => {
    const { messages } = get()
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === 'assistant' && lastMsg.content.startsWith('Error:')) {
      set((s) => ({ messages: s.messages.slice(0, -1) }))
    }
    await get().sendMessage(lastUserMsg.content)
  },

  togglePinMessage: (pinId) => {
    const { activeDoc, messages } = get()
    const updated = messages.map(m =>
      m.pinId === pinId ? { ...m, pinned: !m.pinned } : m
    )
    set({ messages: updated })
    if (activeDoc) {
      const pinned = updated.filter(m => m.pinned).map(m => m.pinId)
      localStorage.setItem(`pins_${activeDoc.id}`, JSON.stringify(pinned))
    }
  },
}))