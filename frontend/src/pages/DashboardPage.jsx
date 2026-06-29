import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import api from '../lib/api'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar,
  PieChart, Pie, Cell
} from 'recharts'
import { motion } from 'framer-motion'
import {
  Brain, FileText, MessageSquare, ArrowLeft, Zap,
  Sun, Moon, HardDrive, RefreshCw, MessageCircle,
  Clock, Tag
} from 'lucide-react'

function getCSSVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim()
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function StatCard({ icon: Icon, label, value, sub, delay, onClick, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      className={`bg-bg-secondary border border-border rounded-2xl p-5 flex items-center gap-4
        ${onClick ? 'cursor-pointer hover:border-accent-purple/40 transition-all' : ''}`}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: (color || '#7c6af7') + '20' }}>
        <Icon size={18} style={{ color: color || '#7c6af7' }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-[var(--text-color)]">{value}</p>
        <p className="text-xs text-muted font-mono">{label}</p>
        {sub && <p className="text-[10px] text-muted font-mono mt-0.5 opacity-70">{sub}</p>}
      </div>
    </motion.div>
  )
}

const PIE_COLORS = ['#7c6af7', '#5eead4', '#f97316', '#ec4899', '#84cc16', '#f59e0b', '#3b82f6', '#8b5cf6']

export default function DashboardPage() {
  const { theme, toggleTheme } = useStore()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const accent        = getCSSVar('--accent-color') || '#7c6af7'
  const gridColor     = getCSSVar('--border-color')
  const tickColor     = getCSSVar('--muted-color')
  const tooltipBg     = getCSSVar('--bg-secondary')
  const tooltipBorder = getCSSVar('--border-color')
  const tooltipLabel  = getCSSVar('--text-color')

  useEffect(() => { loadStats() }, [])

  const loadStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [docsRes, activityRes, chatStatsRes] = await Promise.all([
        api.get('/docs/'),
        api.get('/chat/activity'),
        api.get('/chat/stats'),
      ])

      const docs = docsRes.data
      const dailyActivity = activityRes.data
      const chatStats = chatStatsRes.data

      let totalMessages = 0
      let totalChunks = 0
      let totalSize = 0
      const docStats = []
      const recentActivity = []

      const histories = await Promise.all(
        docs.map(doc => api.get(`/chat/history/${doc.id}`).then(r => ({ doc, history: r.data })))
      )

      for (const { doc, history } of histories) {
        const isCleared = localStorage.getItem(`chat_cleared_${doc.id}`) === 'true'
        const msgCount = isCleared ? 0 : history.length
        totalMessages += msgCount
        totalChunks += doc.chunk_count
        totalSize += doc.file_size || 0

        docStats.push({
          name: doc.filename.replace(/\.(pdf|txt|md)$/i, '').slice(0, 15),
          fullName: doc.filename,
          messages: msgCount,
          chunks: doc.chunk_count,
          id: doc.id,
        })

        if (!isCleared) {
          const userMsgs = history.filter(m => m.role === 'user').slice(-2)
          for (const m of userMsgs) {
            recentActivity.push({
              doc: doc.filename.replace(/\.(pdf|txt|md)$/i, '').slice(0, 20),
              docId: doc.id,
              question: m.content.slice(0, 80) + (m.content.length > 80 ? '…' : ''),
              time: m.created_at + 'Z',
            })
          }
        }
      }

      recentActivity.sort((a, b) => new Date(b.time) - new Date(a.time))

      const mostActiveDoc = [...docStats].sort((a, b) => b.messages - a.messages)[0]
      const totalQuestions = Math.ceil(totalMessages / 2)

      setStats({
        totalDocs: docs.length,
        totalMessages,
        totalQuestions,
        totalChunks,
        totalSize,
        docStats,
        dailyActivity,
        recentActivity: recentActivity.slice(0, 6),
        mostActiveDoc,
        avgResponseLength: chatStats?.avg_response_length || 0,
      })
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false) }
  }

  return (
    <div className="min-h-screen bg-bg-primary p-6 font-syne">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent-purple to-accent-teal flex items-center justify-center">
            <Brain size={16} color="#fff" />
          </div>
          <span className="font-bold text-lg text-[var(--text-color)]">DocMind</span>
          <span className="text-xs font-mono text-muted bg-bg-secondary border border-border px-2 py-0.5 rounded-full">
            Dashboard
          </span>
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => loadStats(true)}
            disabled={refreshing}
            title="Refresh stats"
            className="w-8 h-8 flex items-center justify-center text-muted border border-border
              rounded-lg hover:border-accent-purple/50 hover:text-accent-purple transition-all disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center text-muted border border-border
              rounded-lg hover:border-accent-purple/50 hover:text-accent-purple transition-all"
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </motion.button>

          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-2 text-sm text-muted hover:text-accent-purple transition-colors"
          >
            <ArrowLeft size={14} />
            Back to app
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-accent-purple border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Stat cards — row 1 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard
                icon={FileText} label="documents indexed"
                value={stats.totalDocs} delay={0} color="#7c6af7"
              />
              <StatCard
                icon={MessageSquare} label="total messages"
                value={stats.totalMessages} delay={0.05} color="#5eead4"
              />
              <StatCard
                icon={MessageCircle} label="questions asked"
                value={stats.totalQuestions} delay={0.1} color="#f97316"
              />
              <StatCard
                icon={Zap} label="chunks embedded"
                value={stats.totalChunks} delay={0.15} color="#ec4899"
              />
            </div>

            {/* Stat cards — row 2 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <StatCard
                icon={HardDrive} label="total storage used"
                value={formatSize(stats.totalSize)} delay={0.2} color="#84cc16"
              />
              <StatCard
                icon={Tag} label="most active document"
                value={stats.mostActiveDoc?.name || '—'}
                sub={stats.mostActiveDoc ? `${stats.mostActiveDoc.messages} messages` : ''}
                delay={0.25} color="#f59e0b"
              />
              <StatCard
                icon={Clock} label="avg response length"
                value={stats.avgResponseLength ? `${stats.avgResponseLength} chars` : '—'}
                delay={0.3} color="#3b82f6"
              />
            </div>

            {/* Charts row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Daily activity */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                className="bg-bg-secondary border border-border rounded-2xl p-5"
              >
                <h3 className="text-sm font-bold mb-1 text-[var(--text-color)]">Daily Activity</h3>
                <p className="text-xs text-muted font-mono mb-4">questions asked — last 7 days</p>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={stats.dailyActivity}>
                    <defs>
                      <linearGradient id="colorQ" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#7c6af7" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7c6af7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="day" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} />
                    <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8 }}
                      labelStyle={{ color: tooltipLabel }}
                      itemStyle={{ color: '#7c6af7' }}
                    />
                    <Area type="monotone" dataKey="questions" stroke="#7c6af7" fill="url(#colorQ)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Activity donut */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="bg-bg-secondary border border-border rounded-2xl p-5"
              >
                <h3 className="text-sm font-bold mb-1 text-[var(--text-color)]">Chat Distribution</h3>
                <p className="text-xs text-muted font-mono mb-4">% of activity per document</p>
                {stats.docStats.every(d => d.messages === 0) ? (
                  <div className="h-[180px] flex items-center justify-center">
                    <p className="text-xs text-muted font-mono">No chat history yet</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={180}>
                      <PieChart>
                        <Pie
                          data={stats.docStats.filter(d => d.messages > 0)}
                          dataKey="messages"
                          nameKey="name"
                          cx="50%" cy="50%"
                          innerRadius={45} outerRadius={75}
                          paddingAngle={3}
                        >
                          {stats.docStats.filter(d => d.messages > 0).map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8 }}
                          labelStyle={{ color: tooltipLabel }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                      {stats.docStats.filter(d => d.messages > 0).map((d, i) => (
                        <div key={i} className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <div className="flex-1 min-w-0 overflow-hidden group/label">
                            <div className="text-[11px] text-muted font-mono whitespace-nowrap group-hover/label:animate-marquee">
                              {d.fullName}
                            </div>
                          </div>
                          <span className="text-[11px] font-mono ml-auto flex-shrink-0" style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>{d.messages}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Charts row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Messages per doc bar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
                className="bg-bg-secondary border border-border rounded-2xl p-5"
              >
                <h3 className="text-sm font-bold mb-1 text-[var(--text-color)]">Messages per Document</h3>
                <p className="text-xs text-muted font-mono mb-4">total Q&A per file</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={stats.docStats} margin={{ bottom: 30, left: 0, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      interval={0}
                      tick={({ x, y, payload }) => (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0} y={0} dy={12}
                            textAnchor="end"
                            fill={tickColor}
                            fontSize={9}
                            transform="rotate(-25)"
                          >
                            {payload.value.length > 8 ? payload.value.slice(0, 8) + '…' : payload.value}
                          </text>
                        </g>
                      )}
                    />
                    <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8 }}
                      labelStyle={{ color: tooltipLabel }}
                      itemStyle={{ color: '#5eead4' }}
                      labelFormatter={(label) => {
                        const doc = stats.docStats.find(d => d.name === label)
                        return doc?.fullName || label
                      }}
                    />
                    <Bar dataKey="messages" fill="#5eead4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Storage per doc */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                className="bg-bg-secondary border border-border rounded-2xl p-5"
              >
                <h3 className="text-sm font-bold mb-1 text-[var(--text-color)]">Storage Usage</h3>
                <p className="text-xs text-muted font-mono mb-4">file size per document</p>
                <div className="flex flex-col gap-3 mt-2">
                  {stats.docStats.map((d, i) => {
                    const doc = stats.docStats[i]
                    const pct = stats.totalSize > 0
                      ? Math.round(((doc.chunks * 500 * 5) / stats.totalSize) * 100)
                      : 0
                    const color = PIE_COLORS[i % PIE_COLORS.length]
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-mono text-muted truncate max-w-[70%]">{d.name}</span>
                          <span className="text-[11px] font-mono" style={{ color }}>{d.chunks} chunks</span>
                        </div>
                        <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(pct, 100)}%` }}
                            transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                            className="h-full rounded-full"
                            style={{ background: color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            </div>

            {/* Recent activity feed */}
            {stats.recentActivity.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
                className="bg-bg-secondary border border-border rounded-2xl p-5"
              >
                <h3 className="text-sm font-bold mb-1 text-[var(--text-color)]">Recent Questions</h3>
                <p className="text-xs text-muted font-mono mb-4">latest questions across all documents</p>
                <div className="flex flex-col gap-2">
                  {stats.recentActivity.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + i * 0.05 }}
                      onClick={() => {
                        const docStat = stats.docStats.find(d => d.fullName?.startsWith(item.doc) || d.name === item.doc)
                        if (docStat) {
                          localStorage.setItem('activeDocId', String(docStat.id))
                          localStorage.setItem('highlightQuestion', item.question)
                        }
                        navigate('/app')
                      }}
                      className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-tertiary
                        transition-colors cursor-pointer group"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-accent-purple mt-1.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--text-color)] leading-relaxed truncate group-hover:text-accent-purple transition-colors">
                          {item.question}
                        </p>
                        <p className="text-[10px] text-muted font-mono mt-0.5">{item.doc}</p>
                      </div>
                      <span className="text-[10px] font-mono text-muted flex-shrink-0">
                        {new Date(item.time).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
                        })}                      
                      </span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  )
}