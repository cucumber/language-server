export interface Files {
  exists(uri: string): Promise<boolean>
  readFile(uri: string): Promise<string>
  findUris(glob: string): Promise<readonly string[]>
  relativePath(uri: string): string
}

export function extname(uri: string): string {
  // Roughly-enough implements https://nodejs.org/dist/latest-v18.x/docs/api/path.html#pathextnamepath
  return uri.substring(uri.lastIndexOf('.'), uri.length) || ''
}
