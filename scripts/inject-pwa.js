#!/usr/bin/env node
// Post-export script: injects PWA tags into dist/index.html

const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf-8');

const pwaTags = `
    <link rel="manifest" href="/manifest.json" />
    <meta name="theme-color" content="#1a0533" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="RepVault" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />`;

const swScript = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js');
        });
      }
    </script>`;

// Inject PWA tags before </head>
html = html.replace('</head>', pwaTags + '\n  </head>');

// Inject SW registration before </body>
html = html.replace('</body>', swScript + '\n  </body>');

// Update viewport for PWA
html = html.replace(
  'content="width=device-width, initial-scale=1, shrink-to-fit=no"',
  'content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"'
);

fs.writeFileSync(indexPath, html);
console.log('✓ PWA tags injected into dist/index.html');
