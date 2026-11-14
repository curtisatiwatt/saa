import { mkdir, rm, copyFile, cp } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'core.js', 'i18n.js', 'ui-en.js', 'sync-ui.js', 'sync-client.js', 'sync-crypto.js', 'sync-merge.js', 'sync-config.js', 'favicon.svg']) await copyFile(file, `dist/${file}`);
await cp('data', 'dist/data', { recursive: true });
await copyFile('.nojekyll', 'dist/.nojekyll');
console.log('Built static website in dist/');
