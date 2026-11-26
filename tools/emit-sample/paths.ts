import path from 'node:path';

export const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
export const OUTPUT_DIRECTORY = path.resolve(REPOSITORY_ROOT, 'out');
export const GAME_MAPS_DIRECTORY = path.resolve(REPOSITORY_ROOT, '..', 'plazma-burst-2', 'data', 'maps');
export const SAMPLE_NAME = 'ptc-hello';
export const XML_FILE = `${SAMPLE_NAME}.xml`;
export const TEXT_FILE = `${SAMPLE_NAME}.txt`;
export const MAP_FILE = `${SAMPLE_NAME}-map.xml`;
