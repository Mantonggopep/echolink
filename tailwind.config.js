/**
 * @type {import('tailwindcss').Config}
 *
 * This configuration uses CommonJS syntax (module.exports and require())
 * to match the package.json "type": "commonjs" setting.
 */
module.exports = {
  // CRITICAL: This content array must list all files where you use Tailwind classes.
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
