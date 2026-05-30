export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand:  '#F5C518',
        dark:   '#111111',
        card:   '#1A1A1A',
        light:  '#F5F5F5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fadeIn':  'fadeInUp 0.25s ease both',
        'pop':     'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        'barGrow': 'barGrow 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
      },
      keyframes: {
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%':   { transform: 'scale(0.5)', opacity: '0' },
          '70%':  { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        barGrow: {
          '0%':   { transform: 'scaleY(0)', opacity: '0' },
          '100%': { transform: 'scaleY(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
