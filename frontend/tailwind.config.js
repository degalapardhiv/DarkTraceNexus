/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#0a0a0f',
          900: '#0f1117',
          850: '#141620',
          800: '#1a1d2e',
          700: '#242840',
          600: '#2e3352',
          500: '#3d4266',
        },
        cyber: {
          blue: '#00d4ff',
          cyan: '#00e5ff',
          green: '#00ff88',
          orange: '#ff8800',
          red: '#ff3366',
          purple: '#8855ff',
          yellow: '#ffcc00',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
