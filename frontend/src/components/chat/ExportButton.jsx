import { useState, useRef, useEffect } from 'react'
import { Download, Loader2, ChevronDown, FileText, FileCode } from 'lucide-react'
import { useStore } from '../../store/useStore'
import jsPDF from 'jspdf'
import { motion, AnimatePresence } from 'framer-motion'

export default function ExportButton({ id }) {
  const { messages, activeDoc } = useStore()
  const [exporting, setExporting] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const exportPDF = async () => {
    setShowDropdown(false)
    if (!messages.length || !activeDoc) return
    setExporting(true)
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const margin = 16
      const maxW = pageW - margin * 2
      let y = 20

      // Title
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(18)
      doc.setTextColor(124, 106, 247)
      doc.text('DocMind — Chat Export', margin, y)
      y += 8

      // Subtitle
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(136, 136, 136)
      doc.text(`Document: ${activeDoc.filename}`, margin, y)
      y += 5
      doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y)
      y += 5
      doc.text(`Total messages: ${messages.length}`, margin, y)
      y += 10

      // Divider
      doc.setDrawColor(46, 46, 46)
      doc.line(margin, y, pageW - margin, y)
      y += 8

      // Messages
      for (const msg of messages) {
        if (msg.streaming) continue

        if (y > 270) {
          doc.addPage()
          y = 20
        }

        const isUser = msg.role === 'user'

        // Role label
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9)
        doc.setTextColor(isUser ? 124 : 94, isUser ? 106 : 234, isUser ? 247 : 212)
        doc.text(isUser ? 'YOU' : 'DOCMIND', margin, y)
        y += 5

        // Message content
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
          doc.text(line, margin, y)
          y += 5
        }
        y += 6

        // Divider between messages
        doc.setDrawColor(220, 220, 220)
        doc.line(margin, y, pageW - margin, y)
        y += 6
      }

      doc.save(`docmind-${activeDoc.filename.replace('.pdf', '')}-chat.pdf`)
    } finally {
      setExporting(false)
    }
  }

  const exportMarkdown = () => {
    setShowDropdown(false)
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
      lines.push(`${role}`)
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

  if (!messages.length || !activeDoc) return null

  return (
    <div ref={dropdownRef} className="relative">
      <motion.button
        id={id}
        onClick={() => setShowDropdown(s => !s)}
        disabled={exporting}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-muted
          border border-border rounded-lg hover:border-accent-purple/50 hover:text-accent-purple
          transition-all disabled:opacity-50"
      >
        {exporting
          ? <Loader2 size={12} className="animate-spin" />
          : <Download size={12} />
        }
        {exporting ? 'Exporting...' : 'Export chat'}
        <ChevronDown size={11} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1.5 w-44 bg-bg-secondary border border-border
              rounded-xl shadow-xl overflow-hidden z-50"
          >
            <button
              onClick={exportPDF}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-mono text-muted
                hover:text-accent-purple hover:bg-accent-purple/5 transition-all"
            >
              <FileText size={12} />
              Export as PDF
            </button>
            <button
              onClick={exportMarkdown}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-mono text-muted
                hover:text-accent-teal hover:bg-accent-teal/5 transition-all border-t border-border"
            >
              <FileCode size={12} />
              Export as Markdown
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}