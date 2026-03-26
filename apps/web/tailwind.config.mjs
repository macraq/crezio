/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        crezio: {
          violet: '#6C5CE7',
          mint: '#00E2BE',
          neonPink: '#FF3DA0',
          ink: '#2D3436',
        },
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        crezio: {
          primary: '#6C5CE7',
          secondary: '#00E2BE',
          accent: '#FF3DA0',
          neutral: '#111315',
          'base-100': '#15181A',
          'base-200': '#1F2427',
          'base-300': '#2D3436',
          'base-content': '#F5F7FF',
          info: '#38BDF8',
          success: '#22C55E',
          warning: '#FBBF24',
          error: '#F43F5E',
        },
      },
    ],
  },
};
