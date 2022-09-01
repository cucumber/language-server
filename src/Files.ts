import { DocumentUri } from 'vscode-languageserver-types'

export interface Files {
  exists(uri: DocumentUri): Promise<boolean>
  readFile(path: string): Promise<string>
  findFiles(cwd: string, glob: string): Promise<readonly string[]>
}

export function extname(path: string): string {
  // Roughly-enough implements https://nodejs.org/dist/latest-v18.x/docs/api/path.html#pathextnamepath
  return path.substring(path.lastIndexOf('.'), path.length) || ''
}
