/**
 * The app's own parser, loaded into Node.
 *
 * The parser is TypeScript and Node 20 cannot run that, so it is bundled in
 * memory with esbuild on each run. That way the scripts always score the code
 * the app ships, never a copy that has drifted from it.
 */

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

export async function loadParser() {
  const out = await build({
    stdin: {
      contents: `
        export { parsePostingLocal } from './src/lib/parsePosting.ts';
        export { normalizeLoc } from './src/lib/locations.ts';
        export { PARSER_VERSION } from './src/lib/extractionLog.ts';
        export { withLearned } from './src/lib/learned.ts';
      `,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  const code = Buffer.from(out.outputFiles[0].text).toString('base64');
  return import(`data:text/javascript;base64,${code}`);
}
