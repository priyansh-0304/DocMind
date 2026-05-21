import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { motion, useAnimation } from 'framer-motion'

export default function ChatInput({ onSend, disabled }) {
  const [value, setValue] = useState('')
  const textareaRef = useRef(null)
  const controls = useAnimation()

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '44px'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [value])

  const handleSend = async () => {
    const trimmed = value.trim()
    if (disabled) return
    if (!trimmed) {
      await controls.start({
        x: [0, -8, 8, -8, 8, 0],
        transition: { duration: 0.4 }
      })
      return
    }
    onSend(trimmed)
    setValue('')
  }

  // Prefill input handler for follow-up questions
  useEffect(() => {
    const handler = (e) => {
      setValue(e.detail)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
    window.addEventListener('prefill-input', handler)
    return () => window.removeEventListener('prefill-input', handler)
  }, [])

  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <motion.div animate={controls} className="flex gap-3 items-end">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={disabled ? 'Select a document to start chatting…' : 'Ask anything about your document…'}
        rows={1}
        className="flex-1 bg-bg-tertiary border border-border rounded-xl px-4 py-3 text-sm text-[var(--text-color)]
          placeholder:text-muted resize-none outline-none focus:border-accent-purple transition-colors
          font-syne leading-snug disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ height: '44px', overflow: 'hidden' }}
      />
      <motion.button
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        className="w-11 h-11 bg-accent-purple rounded-xl flex items-center justify-center
          flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Send size={16} color="#fff" />
      </motion.button>
    </motion.div>
  )
}