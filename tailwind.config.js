/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      // NativeWind preset maps Android `mono` → "mono", which RN treats as a custom font
      // (fonts/mono.ttf). Use platform-generic families instead.
      fontFamily: {
        sans: "sans-serif",
        mono: "monospace",
      },
    },
  },
  plugins: [],
};
