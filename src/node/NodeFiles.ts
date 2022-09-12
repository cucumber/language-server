import fg from 'fast-glob'
import fs from 'fs/promises'
import path, { relative, resolve as resolvePath } from 'path'
import url from 'url'

import { Files } from '../Files'

export class NodeFiles implements Files {
  constructor(private readonly rootUri: string) {}

  async exists(uri: string): Promise<boolean> {
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

  findFiles(glob: string): Promise<readonly string[]> {
    return fg(glob, { cwd: this.rootUri, caseSensitiveMatch: false, onlyFiles: true })
  }

  join(...paths: string[]): string {
    return path.join(this.rootUri, ...paths)
  }

  relative(uri: string): string {
    return relative(this.rootUri, new URL(uri).pathname)
  }

  toUri(path: string): string {
    return url.pathToFileURL(resolvePath(path)).href
  }
}
