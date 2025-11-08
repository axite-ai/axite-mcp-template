import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const __dirname = dirname(fileURLToPath(import.meta.url));

const widgets = [
  'account-balances',
  'transactions',
  'spending-insights',
  'account-health'
];

// Process Tailwind CSS
async function buildCSS() {
  const css = readFileSync(resolve(__dirname, 'src/shared/styles.css'), 'utf-8');

  const result = await postcss([
    tailwindcss({
      content: ['./src/**/*.{js,jsx,ts,tsx}'],
      theme: { extend: {} },
      plugins: [],
    }),
    autoprefixer,
  ]).process(css, { from: 'src/shared/styles.css' });

  return result.css;
}

async function buildWidget(name) {
  console.log(`\nBuilding ${name}...`);

  const outDir = resolve(__dirname, `dist/${name}`);
  mkdirSync(outDir, { recursive: true });

  // Build JavaScript bundle
  await build({
    entryPoints: [resolve(__dirname, `src/${name}/index.tsx`)],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2020',
    outfile: resolve(outDir, 'widget.js'),
    jsx: 'automatic',
    jsxImportSource: 'react',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    loader: {
      '.tsx': 'tsx',
      '.ts': 'ts',
    },
  });

  // Build CSS
  const css = await buildCSS();

  // Create standalone HTML
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <style>${css}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${readFileSync(resolve(outDir, 'widget.js'), 'utf-8')}</script>
  </body>
</html>`;

  // Write bundled HTML
  mkdirSync(resolve(__dirname, 'dist/bundled'), { recursive: true });
  writeFileSync(resolve(__dirname, `dist/bundled/${name}.html`), html);

  console.log(`✓ Built ${name}.html`);
}

async function buildAll() {
  console.log('Building all widgets with esbuild + Tailwind...\n');

  for (const widget of widgets) {
    await buildWidget(widget);
  }

  console.log('\n✓ All widgets built successfully!');
  console.log('Bundled files are in: dist/bundled/');
}

buildAll().catch(console.error);
