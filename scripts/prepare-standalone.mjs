import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = process.cwd();
const standaloneRoot = join(projectRoot, '.next', 'standalone');

if (!existsSync(standaloneRoot))
  throw new Error('Run `next build` before preparing standalone output.');

const staticSource = join(projectRoot, '.next', 'static');
const staticTarget = join(standaloneRoot, '.next', 'static');
mkdirSync(join(standaloneRoot, '.next'), { recursive: true });
cpSync(staticSource, staticTarget, { recursive: true, force: true });

const publicSource = join(projectRoot, 'public');
if (existsSync(publicSource))
  cpSync(publicSource, join(standaloneRoot, 'public'), {
    recursive: true,
    force: true,
  });

console.log('Standalone runtime assets prepared.');
