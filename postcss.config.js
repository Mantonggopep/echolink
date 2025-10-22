/**
 * @type {import('postcss-load-config').Config}
 *
 * This configuration uses CommonJS syntax (module.exports and require())
 * to resolve the "Failed to load the ES module" warning caused by
 * having "type": "commonjs" in package.json.
 */
module.exports = {
  plugins: [
    require('tailwindcss'),
    require('autoprefixer'),
  ],
};
