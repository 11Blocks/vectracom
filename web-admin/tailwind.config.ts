import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /* VECTRACOM Design System */
        background: '#0a0f0d',
        foreground: '#e8ede9',
        card: { DEFAULT: '#111916', foreground: '#e8ede9' },
        popover: { DEFAULT: '#111916', foreground: '#e8ede9' },
        primary: { DEFAULT: '#0f9d70', foreground: '#ffffff' },
        secondary: { DEFAULT: '#1a2420', foreground: '#e8ede9' },
        muted: { DEFAULT: '#1a2420', foreground: '#7a8f80' },
        accent: { DEFAULT: '#172019', foreground: '#e8ede9' },
        destructive: { DEFAULT: '#C0392B', foreground: '#ffffff' },
        border: '#1e2e25',
        input: '#1e2e25',
        ring: '#0f9d70',
        /* VECTRACOM custom */
        'vc-mint': '#0f9d70',
        'vc-mint-hover': '#0d8a62',
        'vc-amber': '#f5a623',
        'vc-amber-hover': '#d9911f',
        'vc-red': '#C0392B',
        'vc-red-hover': '#a93226',
        'vc-orange': '#D9822B',
        'vc-surface': '#111916',
        'vc-surface-light': '#172019',
        'vc-border': '#1e2e25',
        'vc-sidebar': '#0d1210',
        'vc-sidebar-foreground': '#c5d1c8',
        'vc-text': '#e8ede9',
        'vc-text-muted': '#7a8f80',
        /* Charts */
        'chart-1': '#0f9d70',
        'chart-2': '#f5a623',
        'chart-3': '#3b82f6',
        'chart-4': '#C0392B',
        'chart-5': '#D9822B',
      },
      borderRadius: {
        lg: '0.625rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
