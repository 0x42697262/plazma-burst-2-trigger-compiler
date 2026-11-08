export const TEXT = Object.freeze({
  noUploadForm: (mapId: string): string => `The settings page of ${mapId} has no replace form: the map is not yours, or the site changed.`,
  siteError: (message: string): string => `The site said: ${message}`,
  challenge: 'The site answered with a Cloudflare check; try again later.',
  httpStatus: (status: number, path: string): string => `The site answered ${status} for ${path}.`,
});
