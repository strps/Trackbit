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

          console.log(`.fade-${dirName}${fadeName} : ${gradient}`)

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


// import plugin from 'tailwindcss/plugin'

// export default {
//   content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
//   plugins: [
//     plugin(({ addUtilities }) => {
//       const directions = {
//         top: 'to top',
//         bottom: 'to bottom',
//         left: 'to left',
//         right: 'to right',
//       }

//       const fractions = {
//         '': ['0%', '100%'],
//         '-1/4': ['25%', '100%'],
//         '-1/3': ['33%', '100%'],
//         '-1/2': ['50%', '100%'],
//         '-2/3': ['66%', '100%'],
//       }

//       const utilities = {}

//       for (const [dirName, dirValue] of Object.entries(directions)) {
//         for (const [fracName, [solid, end]] of Object.entries(fractions)) {
//           const gradient = `linear-gradient(${dirValue}, black ${solid}, transparent ${end})`
//           console.log(`.fade-${dirName}${fracName} : ${gradient}`)
//           utilities[`.fade-${dirName}${fracName}`] = {
//             maskImage: gradient,
//             WebkitMaskImage: gradient,
//           }
//         }
//       }

//       addUtilities(utilities)
//     }),
//   ],
// }
