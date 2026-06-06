/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,jsx,html}'],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: '#0f1117',
          elevated: '#12151c'
        },
        card: {
          DEFAULT: '#1a1d26',
          hover: '#1f2430'
        },
        border: {
          DEFAULT: '#2a2f3a',
          muted: '#232830'
        },
        accent: {
          DEFAULT: '#22d3ee',
          muted: '#0891b2',
          glow: 'rgba(34, 211, 238, 0.12)'
        },
        success: {
          DEFAULT: '#34d399',
          muted: '#065f46'
        },
        warning: {
          DEFAULT: '#fbbf24',
          muted: '#78350f'
        },
        danger: {
          DEFAULT: '#f87171',
          muted: '#7f1d1d'
        },
        muted: {
          DEFAULT: '#9ca3af',
          dim: '#6b7280'
        }
      },
      fontFamily: {
        sans: ['"Segoe UI Variable"', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['"Segoe UI Variable"', 'Segoe UI', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 48px rgba(34, 211, 238, 0.1)',
        card: '0 4px 24px rgba(0, 0, 0, 0.35)'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'glow-drift': {
          '0%, 100%': { transform: 'translate(0%, 0%) scale(1)' },
          '50%': { transform: 'translate(4%, -3%) scale(1.05)' }
        },
        'xp-pop': {
          '0%': { opacity: '0', transform: 'scale(0.92) translateY(8px)' },
          '40%': { opacity: '1', transform: 'scale(1.04) translateY(0)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.45s ease-out forwards',
        'glow-drift': 'glow-drift 18s ease-in-out infinite',
        'xp-pop': 'xp-pop 0.6s ease-out forwards'
      }
    }
  },
  plugins: []
}
