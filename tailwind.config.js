export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {
    fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
    colors: { ink: { 950: '#0a0a0b', 900: '#121214', 800: '#1b1b1f', 700: '#26262c' }, accent: '#f5b83d' },
    keyframes: { fadeUp: { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } } },
    animation: { fadeUp: 'fadeUp .35s ease-out both' },
  } },
  plugins: [],
}
