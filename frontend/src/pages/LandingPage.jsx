import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'

const FEATURES = [
  {
    icon: '⬡',
    title: 'Vector Search',
    desc: 'Semantic similarity search using pgvector — finds relevant context even when you phrase it differently.',
  },
  {
    icon: '◈',
    title: 'Streaming Responses',
    desc: 'Answers stream token by token via LLaMA 3.1. No waiting. Grounded entirely in your document.',
  },
  {
    icon: '⊕',
    title: 'Multi-Document',
    desc: 'Select multiple PDFs and query across all of them simultaneously with a single question.',
  },
  {
    icon: '◎',
    title: 'Smart Suggestions',
    desc: 'AI-generated questions appear instantly after upload so you know exactly where to start.',
  },
  {
    icon: '⟁',
    title: 'Export to PDF',
    desc: 'Download your entire Q&A session as a formatted PDF report with one click.',
  },
  {
    icon: '◫',
    title: 'JWT Auth',
    desc: 'Secure per-user document isolation. Your documents are private and only accessible to you.',
  },
]

const STEPS = [
  { num: '01', title: 'Upload', desc: 'Drop any PDF or text file. DocMind extracts, chunks, and embeds it into a vector database.' },
  { num: '02', title: 'Ask', desc: 'Type any question. The RAG pipeline retrieves the most relevant chunks and sends them to the LLM.' },
  { num: '03', title: 'Get answers', desc: 'Receive grounded, accurate answers streamed in real time — with source citations.' },
]

const DEMO_MESSAGES = [
  { role: 'user', text: 'What are the key responsibilities mentioned?' },
  { role: 'ai', text: 'Based on **Source 1**, the key responsibilities include leading cross-functional teams, architecting scalable backend systems, and driving quarterly OKR planning sessions with stakeholders.' },
  { role: 'user', text: 'What tech stack is required?' },
  { role: 'ai', text: 'The document specifies **Python**, **FastAPI**, **PostgreSQL**, and experience with vector databases. Familiarity with LLM APIs is listed as a bonus.' },
]

function FloatingOrb({ style }) {
  return (
    <div
      className="absolute rounded-full blur-3xl opacity-20 pointer-events-none"
      style={style}
    />
  )
}

function DemoChat() {
  const [visible, setVisible] = useState(0)

  useEffect(() => {
    if (visible >= DEMO_MESSAGES.length) return
    const t = setTimeout(() => setVisible(v => v + 1), visible === 0 ? 600 : 1800)
    return () => clearTimeout(t)
  }, [visible])

  return (
    <div className="flex flex-col gap-3 p-5">
      <AnimatePresence>
        {DEMO_MESSAGES.slice(0, visible).map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'text-white rounded-br-sm'
                  : 'bg-white/5 border border-white/10 text-gray-200 rounded-bl-sm'
              }`}
              style={msg.role === 'user' ? { background: '#b82020' } : {}}
              dangerouslySetInnerHTML={{
                __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e57373">$1</strong>')
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
      {visible < DEMO_MESSAGES.length && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex gap-1 pl-1"
        >
          {[0,1,2].map(i => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#b82020' }}
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef })
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -80])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden" style={{ fontFamily: "'Syne', sans-serif" }}>

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5"
        style={{ background: 'linear-gradient(to bottom, rgba(8,8,8,0.95), transparent)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg, #b82020, #7a1010)' }}>
            ◈
          </div>
          <span className="font-bold text-base tracking-tight">DocMind</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-gray-400 hover:text-white transition-colors px-4 py-2"
          >
            Sign in
          </button>
          <button
            onClick={() => navigate('/login')}
            className="text-sm font-medium px-4 py-2 rounded-xl transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #b82020, #7a1010)' }}
          >
            Get started →
          </button>
        </div>
      </motion.nav>

      {/* Hero */}
      <section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20">
        {/* Background orbs */}
        <FloatingOrb style={{ width: 600, height: 600, background: '#b82020', top: -100, left: -200 }} />
        <FloatingOrb style={{ width: 400, height: 400, background: '#7a1010', bottom: 0, right: -100 }} />
        <FloatingOrb style={{ width: 300, height: 300, background: '#b82020', bottom: 100, left: '40%' }} />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 flex flex-col items-center text-center max-w-4xl"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
            style={{ border: '1px solid rgba(184,32,32,0.3)', background: 'rgba(184,32,32,0.1)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#e57373' }} />
            <span className="text-xs font-mono" style={{ color: '#e57373' }}>RAG · pgvector · LLaMA 3.1 · FastAPI</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7 }}
            className="text-6xl md:text-7xl font-bold leading-none tracking-tight mb-6"
          >
            Chat with any
            <br />
            <span style={{ 
              background: 'linear-gradient(135deg, #e57373, #b82020)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              display: 'inline-block'  // ← this is the key fix
            }}>
              document.
            </span>

          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-lg text-gray-400 max-w-xl leading-relaxed mb-10"
          >
            Upload a PDF. Ask anything. Get answers grounded in your document — not hallucinations.
            Powered by vector embeddings and streaming LLM responses.
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-4"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/login')}
              className="px-7 py-3.5 rounded-2xl font-semibold text-sm transition-all shadow-2xl"
              style={{ background: 'linear-gradient(135deg, #b82020, #7a1010)', boxShadow: '0 0 40px rgba(184,32,32,0.4)' }}
            >
              Start for free →
            </motion.button>
            <button
              onClick={() => document.getElementById('how').scrollIntoView({ behavior: 'smooth' })}
              className="px-7 py-3.5 rounded-2xl font-medium text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 transition-all"
            >
              See how it works
            </button>
          </motion.div>
        </motion.div>

        {/* Demo chat window */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="relative z-10 mt-20 w-full max-w-lg"
        >
          <div className="rounded-2xl border border-white/10 overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)' }}>
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs font-mono text-gray-500">job-description.pdf · 1 chunk indexed</span>
              <div className="ml-auto flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-mono text-gray-500">indexed</span>
              </div>
            </div>
            <DemoChat />
            {/* Input bar */}
            <div className="px-4 pb-4">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5">
                <span className="text-xs text-gray-500 flex-1">Ask anything about your document…</span>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
                  style={{ background: 'linear-gradient(135deg, #b82020, #7a1010)' }}>→</div>
              </div>
            </div>
          </div>

          {/* Glow under card */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-64 h-20 blur-3xl opacity-30 rounded-full"
            style={{ background: 'linear-gradient(135deg, #b82020, #7a1010)' }} />
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-px h-8 bg-gradient-to-b from-gray-600 to-transparent"
          />
        </motion.div>
      </section>

      {/* How it works */}
      <section id="how" className="py-32 px-6 relative">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: '#e57373' }}>How it works</p>
            <h2 className="text-4xl font-bold">Three steps to answers.</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative p-6 rounded-2xl border border-white/5 group transition-all duration-300"
                style={{ background: 'rgba(255,255,255,0.02)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,32,32,0.3)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
              >
                <div className="text-4xl font-bold font-mono mb-4"
                  style={{ background: 'linear-gradient(135deg, rgba(184,32,32,0.4), rgba(122,16,16,0.4))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {step.num}
                </div>
                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'radial-gradient(circle at 50% 0%, rgba(184,32,32,0.05), transparent 70%)' }} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 px-6 relative">
        <FloatingOrb style={{ width: 500, height: 500, background: '#7a1010', top: '10%', right: -200 }} />

        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: '#e57373' }}>Features</p>
            <h2 className="text-4xl font-bold">Everything you need.</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4 }}
                className="p-5 rounded-2xl border border-white/5 transition-all duration-300 group"
                style={{ background: 'rgba(255,255,255,0.02)' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(184,32,32,0.2)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
              >
                <div className="text-2xl mb-3 transition-colors" style={{ color: '#e57373' }}>
                  {f.icon}
                </div>
                <h3 className="font-bold mb-1.5 text-sm">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="py-20 px-6 border-y border-white/5">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-xs font-mono text-gray-600 uppercase tracking-widest mb-10">Built with</p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {['React', 'FastAPI', 'PostgreSQL', 'pgvector', 'LLaMA 3.1', 'Groq', 'Docker', 'JWT', 'Framer Motion', 'Tailwind'].map((tech, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="text-sm font-mono text-gray-500 hover:text-gray-300 transition-colors cursor-default"
              >
                {tech}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-40 px-6 relative overflow-hidden">
        <FloatingOrb style={{ width: 600, height: 600, background: '#b82020', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 text-center max-w-2xl mx-auto"
        >
          <h2 className="text-5xl font-bold mb-6 leading-tight">
            Stop reading.<br />
            <span style={{ 
              background: 'linear-gradient(135deg, #e57373, #b82020)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              display: 'inline-block'
            }}>
              Start asking.
            </span>
          </h2>
          <p className="text-gray-400 mb-10 leading-relaxed">
            Upload your first document and get answers in under 30 seconds.
          </p>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/login')}
            className="px-10 py-4 rounded-2xl font-bold text-base transition-all"
            style={{
              background: 'linear-gradient(135deg, #b82020, #7a1010)',
              boxShadow: '0 0 60px rgba(184,32,32,0.5)'
            }}
          >
            Get started for free →
          </motion.button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-8 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-xs"
            style={{ background: 'linear-gradient(135deg, #b82020, #7a1010)' }}>◈</div>
          <span className="text-sm font-bold text-gray-500">DocMind</span>
        </div>
        <p className="text-xs text-gray-600 font-mono">
          Built by Priyansh Arora · RAG + pgvector + LLaMA 3.1
        </p>
      </footer>
    </div>
  )
}