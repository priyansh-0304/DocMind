import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { motion } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { BookOpen, Copy, Check, RefreshCw, Pin, PinOff } from 'lucide-react'

function HighlightedText({ text, query, isCurrentMatch }) {
  if (!query.trim() || query.trim().length < 2) return <>{text}</>
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  let matchCount = -1
  return (
    <>
      {parts.map((part, i) => {
        if (regex.test(part)) {
          matchCount++
          return (
            <mark
              key={i}
              className="rounded-sm px-0.5"
              style={{
                background: isCurrentMatch ? '#7c6af7' : '#7c6af740',
                color: isCurrentMatch ? '#fff' : 'inherit',
              }}
            >
              {part}
            </mark>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default function ChatMessage({ message, index, searchQuery = '', isCurrentMatch = false, onTogglePin }) {
  const isUser = message.role === 'user'
  const isStreaming = message.streaming
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formattedTime = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    : ''

  const hasMatch = searchQuery && message.content.toLowerCase().includes(searchQuery.toLowerCase())

  return (
    <motion.div
      data-msg-index={index}
      id={`msg-${index}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`flex flex-col gap-2 group/msg ${isUser ? 'items-end' : 'items-start'}`}
    >
      {/* Role + timestamp */}
      <div className={`flex items-center gap-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <span className="text-[10px] font-mono text-muted">
          {isUser ? 'you' : 'docmind'}
        </span>
        <span className="text-[10px] font-mono text-muted/0 group-hover/msg:text-muted/60 transition-colors duration-200">
          {formattedTime}
        </span>
      </div>

      {/* Bubble */}
      <div
        className={`relative group max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed transition-all duration-200
          ${isUser
            ? 'bg-accent-purple text-white rounded-br-sm'
            : 'bg-bg-tertiary border border-border text-[var(--text-color)] rounded-bl-sm'
          }
          ${hasMatch && isCurrentMatch ? 'ring-2 ring-accent-purple/60' : ''}
          ${hasMatch && !isCurrentMatch ? 'ring-1 ring-accent-purple/20' : ''}
        `}
      >
        {isUser ? (
          <p>
            {searchQuery
              ? <HighlightedText text={message.content} query={searchQuery} isCurrentMatch={isCurrentMatch} />
              : message.content
            }
          </p>
        ) : (
          <div className="prose-dark">
            {searchQuery ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                <HighlightedText text={message.content} query={searchQuery} isCurrentMatch={isCurrentMatch} />
              </p>
            ) : (
              <ReactMarkdown>{message.content || ' '}</ReactMarkdown>
            )}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-accent-purple ml-0.5 animate-pulse rounded-sm" />
            )}
          </div>
        )}

        {/* Copy button */}
        {!isStreaming && message.content && (
          <button
            onClick={handleCopy}
            className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity
              bg-bg-secondary border border-border rounded-lg p-1.5 text-muted hover:text-accent-purple"
          >
            {copied
              ? <Check size={11} className="text-accent-teal" />
              : <Copy size={11} />
            }
          </button>
        )}

        {/* Pin button — only on assistant messages */}
        {!isUser && !isStreaming && onTogglePin && (
          <button
            onClick={() => onTogglePin(message.pinId)}
            title={message.pinned ? 'Unpin' : 'Pin this answer'}
            className={`absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity
              bg-bg-secondary border border-border rounded-lg p-1.5
              ${message.pinned ? 'opacity-100 text-accent-purple border-accent-purple/40' : 'text-muted hover:text-accent-purple'}`}
          >
            {message.pinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>
        )}
      </div>

      {/* Source badges + action buttons */}
      {!isUser && !isStreaming && message.content && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center gap-1.5 max-w-[80%]"
        >
          {message.sources?.map((src, i) => {
            const score = src?.similarity_score
            const pct = score != null ? Math.round(score * 100) : null
            const color = pct == null ? null
              : pct >= 80 ? '#5eead4'   // teal — high confidence
              : pct >= 55 ? '#f59e0b'   // amber — medium
              : '#f97316'                // orange — low

            return (
              <span
                key={i}
                className="flex items-center gap-1.5 text-[10px] font-mono bg-bg-secondary border border-border text-muted px-2 py-1 rounded-md"
              >
                <BookOpen size={9} />
                chunk {i + 1}
                {pct != null && (
                  <>
                    <span className="w-px h-3 bg-border" />
                    <span style={{ color }} className="font-mono">{pct}%</span>
                  </>
                )}
              </span>
            )
          })}

          <button
            onClick={() => useStore.getState().retryMessage(index)}
            className="flex items-center gap-1 text-[10px] font-mono text-muted
              hover:text-accent-purple border border-border hover:border-accent-purple/40
              bg-bg-secondary rounded-md px-2 py-1 transition-all hover:bg-accent-purple/5
              opacity-0 group-hover/msg:opacity-100"
          >
            <RefreshCw size={9} />
            regenerate
          </button>

          <button
            onClick={() => useStore.getState().sendMessage('Explain that in simpler terms')}
            className="flex items-center gap-1 text-[10px] font-mono text-muted
              hover:text-accent-teal border border-border hover:border-accent-teal/40
              bg-bg-secondary rounded-md px-2 py-1 transition-all hover:bg-accent-teal/5
              opacity-0 group-hover/msg:opacity-100"
          >
            simpler ↓
          </button>

          <button
            onClick={() => useStore.getState().sendMessage('Give me more detail on that')}
            className="flex items-center gap-1 text-[10px] font-mono text-muted
              hover:text-accent-orange border border-border hover:border-accent-orange/40
              bg-bg-secondary rounded-md px-2 py-1 transition-all hover:bg-accent-orange/5
              opacity-0 group-hover/msg:opacity-100"
          >
            more detail ↑
          </button>
        </motion.div>
      )}
    </motion.div>
  )
}