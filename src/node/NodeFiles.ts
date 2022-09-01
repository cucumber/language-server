import fg from 'fast-glob'
import fs from 'fs/promises'
import path, { resolve as resolvePath } from 'path'
import url from 'url'
import { DocumentUri } from 'vscode-languageserver-types'

import { Files } from '../Files'

export class NodeFiles implements Files {
  async exists(uri: DocumentUri): Promise<boolean> {
    try {
      await fs.stat(new URL(uri))
      return true
    } catch {
      return false
    }
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

  toUri(path: string): string {
    return url.pathToFileURL(resolvePath(path)).href
  }
}
