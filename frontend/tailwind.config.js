export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'bg-primary':   'var(--bg-primary)',
        'bg-secondary': 'var(--bg-secondary)',
        'bg-tertiary':  'var(--bg-tertiary)',
        border:         'var(--border-color)',
        muted:          'var(--muted-color)',
        accent: {
          purple: '#1a6fa8',
          teal:   '#5eead4',
          orange: '#f97316',
        },
      },
    },
  },
  plugins: [],
}