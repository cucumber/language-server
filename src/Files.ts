import { DocumentUri } from 'vscode-languageserver-types'

export interface Files {
  exists(uri: DocumentUri): Promise<boolean>
  readFile(path: string): Promise<string>
  findFiles(cwd: string, glob: string): Promise<readonly string[]>
}
