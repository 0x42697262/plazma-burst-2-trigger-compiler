import { buildSite } from './build.ts';

process.stdout.write(await buildSite());
