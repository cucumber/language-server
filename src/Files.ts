export interface Files {
  exists(uri: string): Promise<boolean>
  readFile(path: string): Promise<string>
  findFiles(glob: string): Promise<readonly string[]>
  join(...paths: string[]): string
  relative(uri: string): string
  toUri(path: string): string
}

export function extname(path: string): string {
  // Roughly-enough implements https://nodejs.org/dist/latest-v18.x/docs/api/path.html#pathextnamepath
  return path.substring(path.lastIndexOf('.'), path.length) || ''
}
