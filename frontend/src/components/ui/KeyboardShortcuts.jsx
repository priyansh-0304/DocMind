import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const SHORTCUTS = [
  { keys: ['⌘', 'K'], description: 'Focus chat input' },
  { keys: ['⌘', 'Enter'], description: 'Send message' },
  { keys: ['⌘', 'Shift', 'C'], description: 'Clear chat' },
  { keys: ['⌘', 'E'], description: 'Export chat as PDF' },
  { keys: ['⌘', 'D'], description: 'Go to dashboard' },
  { keys: ['⌘', 'L'], description: 'Toggle dark/light mode' },
  { keys: ['/'], description: 'Show this help panel' },
  { keys: ['Esc'], description: 'Close this panel' },
]

function Key({ k }) {
  return (
    <kbd className="px-2 py-0.5 rounded-md text-[11px] font-mono border border-border bg-bg-tertiary text-muted">
      {k}
    </kbd>
  )
}

export default function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return

      if (e.key === '/' || (e.shiftKey && e.key === '/')) {
        setOpen(o => !o)
        return
      }
      if (e.key === 'Escape') { setOpen(false); return }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Also listen for programmatic trigger from header button
  useEffect(() => {
    const handler = () => setOpen(o => !o)
    window.addEventListener('open-shortcuts', handler)
    return () => window.removeEventListener('open-shortcuts', handler)
  }, [])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Panel — centered with flex on the fixed overlay */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-md mx-4 bg-bg-secondary border border-border rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h2 className="font-bold text-sm">Keyboard Shortcuts</h2>
                  <p className="text-[11px] text-muted font-mono mt-0.5">press / to toggle</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted hover:text-red-400 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Shortcuts list */}
              <div className="p-4 flex flex-col gap-2">
                {SHORTCUTS.map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-bg-tertiary transition-colors"
                  >
                    <span className="text-xs text-muted">{s.description}</span>
                    <div className="flex items-center gap-1">
                      {s.keys.map((k, j) => <Key key={j} k={k} />)}
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="px-5 py-3 border-t border-border">
                <p className="text-[10px] font-mono text-muted text-center">
                  shortcuts work anywhere outside of text inputs
                </p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}