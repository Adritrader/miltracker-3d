/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'hud-bg': '#0a0e1a',
        'hud-panel': '#0d1117',
        'hud-border': '#1e2a3a',
        'hud-green': '#00ff88',
        'hud-amber': '#ffaa00',
        'hud-red': '#ff3b3b',
        'hud-blue': '#00aaff',
        'hud-text': '#8899aa',
      },
      fontFamily: {
        mono: ['"Share Tech Mono"', 'Consolas', 'monospace'],
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink':       'blink 1.2s step-end infinite',
        'slide-in':    'slideIn 0.3s ease-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'fade-in':     'fadeIn 0.4s ease-out',
        'slide-left':  'slideInLeft 0.25s ease-out',
        'slide-right': 'slideInRight 0.25s ease-out',
        'spin-slow':   'spin 12s linear infinite',
        'glow-green':  'glowGreen 2s ease-in-out infinite',
      },
      keyframes: {
        blink:        { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } },
        slideIn:      { from: { transform: 'translateX(100%)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
        slideUp:      { from: { transform: 'translateY(100%)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        fadeIn:       { from: { opacity: 0 }, to: { opacity: 1 } },
        slideInLeft:  { from: { transform: 'translateX(-20px)', opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
        slideInRight: { from: { transform: 'translateX(20px)',  opacity: 0 }, to: { transform: 'translateX(0)', opacity: 1 } },
        glowGreen:    {
          '0%, 100%': { boxShadow: '0 0 4px rgba(0,255,136,0.2)' },
          '50%':       { boxShadow: '0 0 14px rgba(0,255,136,0.5), 0 0 28px rgba(0,255,136,0.15)' },
        },
      },
    },
  },
  plugins: [],
};
