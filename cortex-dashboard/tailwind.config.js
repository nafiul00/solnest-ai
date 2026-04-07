/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Backgrounds — warm off-white hierarchy
        'bg-base':    '#FAFAF9',
        'bg-surface': '#FFFFFF',
        'bg-card':    '#FFFFFF',
        'bg-card-2':  '#F5F4F1',
        // Accents — muted professional
        'gold':       '#B8860B',
        'gold-hi':    '#C4940D',
        'sage':       '#2C6E49',
        'mist':       '#3B7A57',
        'terracotta': '#B5541E',
        'cream':      '#F5EDD8',
        'red':        '#C0392B',
        'amber':      '#B8860B',
        'green':      '#2C6E49',
        'purple':     '#6D4C8E',
        'pink':       '#A0456A',
        'orange':     '#B5541E',
        'cyan':       '#3B7A57',   // legacy alias
        // Text
        't1': '#0F0F0E',
        't2': '#3D3D39',
        't3': '#7A7A72',
        // Legacy aliases (keep for existing components)
        'bg-primary':    '#FAFAF9',
        'bg-secondary':  '#FFFFFF',
        'accent-cyan':   '#3B7A57',
        'accent-amber':  '#B8860B',
        'accent-green':  '#2C6E49',
        'accent-red':    '#C0392B',
        'text-primary':  '#0F0F0E',
        'text-secondary':'#3D3D39',
        'text-muted':    '#7A7A72',
      },
      fontFamily: {
        sans:    ['DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        serif:   ['Cormorant Garamond', 'Georgia', 'serif'],
        script:  ['Dancing Script', 'cursive'],
        mono:    ['JetBrains Mono', 'Courier New', 'monospace'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
      fontSize: {
        'xxs': ['11px', { lineHeight: '16px' }],
        'xs':  ['12px', { lineHeight: '18px' }],
        'sm':  ['13px', { lineHeight: '19px' }],
        'base':['14px', { lineHeight: '21px' }],
        'md':  ['15px', { lineHeight: '22px' }],
        'lg':  ['17px', { lineHeight: '25px' }],
        'xl':  ['19px', { lineHeight: '27px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
      },
      borderRadius: {
        'sm': '6px',
        'DEFAULT': '10px',
        'lg': '14px',
        'xl': '18px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      boxShadow: {
        'glow-sm': '0 1px 4px rgba(15,15,15,0.08), 0 2px 8px rgba(15,15,15,0.04)',
        'glow':    '0 2px 12px rgba(15,15,15,0.10), 0 4px 20px rgba(15,15,15,0.06)',
        'glow-lg': '0 4px 24px rgba(15,15,15,0.12), 0 8px 40px rgba(15,15,15,0.08)',
        'card':    '0 1px 3px rgba(15,15,15,0.06), 0 1px 8px rgba(15,15,15,0.04)',
      },
    },
  },
  plugins: [],
}
