import fg from 'fast-glob'
import fs from 'fs/promises'
import { relative } from 'path'
import url from 'url'

import { Files } from '../Files'

export class NodeFiles implements Files {
  constructor(private readonly rootUri: string) {
    console.log(`*** new NodeFiles('${rootUri}')`)
  }

  async exists(uri: string): Promise<boolean> {
    try {
      console.log(`*** exists('${uri}')`)
      await fs.stat(new URL(uri))
      return true
    } catch {
      return false
    }
  }

  readFile(uri: string): Promise<string> {
    console.log(`*** readFile('${uri}')`)
    const path = url.fileURLToPath(uri)
    return fs.readFile(path, 'utf-8')
  }

  async findUris(glob: string): Promise<readonly string[]> {
    const cwd = url.fileURLToPath(this.rootUri)
    console.log(`*** findFiles('${glob}') in cwd: ${cwd}`)
    const paths = await fg(glob, { cwd, caseSensitiveMatch: false, onlyFiles: true })
    const uris = paths.map((path) => url.pathToFileURL(path).href)
    console.log(`****** ==> ${uris}`)
    return uris
  }

  relativePath(uri: string): string {
    const path = relative(new URL(this.rootUri).pathname, new URL(uri).pathname)
    console.log(`*** relative('${uri}') => ${path}`)
    return path
  }
}
