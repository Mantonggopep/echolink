const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');
const fs = require('fs'); // Include if needed, though often unused in clean config

module.exports = defineConfig({
  plugins: [
    react({
      // Ensure JSX runtime is compatible with React 18
      jsxRuntime: 'automatic',
      babel: {
        presets: [
          ['@babel/preset-react', { runtime: 'automatic' }],
        ],
      },
      // Ensures .js files are processed as JSX if they contain it
      include: '**/*.js', 
    }),
  ],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  server: {
    port: 5173,
    hmr: {
      overlay: true,
    },
  },
  // Ensure the server can correctly resolve modules in the CommonJS setup
  resolve: {
    // This often helps older setups resolve .js and .jsx extensions reliably
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
  }
});
