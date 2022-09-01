import fg from 'fast-glob'
import fs from 'fs/promises'
import path from 'path'
import { DocumentUri } from 'vscode-languageserver-types'

import { Files } from '../Files'

export class NodeFiles implements Files {
  async exists(uri: DocumentUri): Promise<boolean> {
    try {
      await fs.stat(new URL(uri))
    } catch {
      return false
    }

    return Promise.resolve(false)
  }

  readFile(path: string): Promise<string> {
    return fs.readFile(path, 'utf-8')
  }

  findFiles(cwd: string, glob: string): Promise<readonly string[]> {
    return fg(glob, { cwd, caseSensitiveMatch: false, onlyFiles: true })
  }

  join(...paths: string[]): string {
    return path.join(...paths)
  }
}
