// tailwind.config.js

// tailwind.config.js
import plugin from 'tailwindcss/plugin'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  plugins: [
    plugin(({ addUtilities }) => {
      const directions = {
        top: '0deg',
        bottom: '180deg',
        left: '270deg',
        right: '90deg',
      }

      // fade length = how much of the element is used for fading
      const fades = {
        '': "0",
        '-1/4': "75%",
        '-1/3': "66%",
        '-1/2': "50%",
        '-2/3': "33%",
        '-3/4': "25%",
      }

      const utilities = {}

      for (const [dirName, dirValue] of Object.entries(directions)) {
        for (const [fadeName, fadePos] of Object.entries(fades)) {

          const gradient = `
            linear-gradient(
              ${dirValue},
              rgba(255, 255, 255, 1) 0%,
              rgba(255, 255, 255, 1) ${fadePos},
              rgba(0, 0, 0, 0) 100%
            )
          `.replace(/\s+/g, ' ')

          utilities[`.fade-${dirName}${fadeName}`] = {
            maskImage: gradient,
            WebkitMaskImage: gradient,
          }
        }
      }

      addUtilities(utilities)
    }),
  ],
}


