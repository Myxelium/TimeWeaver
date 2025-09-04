/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@spartan-ng/brain/hlm-tailwind-preset')],
  content: [
    "./src/**/*.{html,ts}",
    "./node_modules/@spartan-ng/**/*.{html,ts,js,mjs}"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
