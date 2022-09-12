import fg from 'fast-glob'
import fs from 'fs/promises'
import path, { relative, resolve as resolvePath } from 'path'
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

  readFile(path: string): Promise<string> {
    console.log(`*** readFile('${path}')`)
    return fs.readFile(path, 'utf-8')
  }

  async findFiles(glob: string): Promise<readonly string[]> {
    console.log(`*** findFiles('${glob}')`)
    const result = await fg(glob, { cwd: this.rootUri, caseSensitiveMatch: false, onlyFiles: true })
    console.log(`****** ==> ('${result}')`)
    return result
  }

  join(...paths: string[]): string {
    console.log(`*** join('${paths}')`)
    const result = path.join(this.rootUri, ...paths)
    console.log(`****** jresult: '${paths}'`)
    return result
  }

  relative(uri: string): string {
    const result = relative(this.rootUri, new URL(uri).pathname)
    console.log(`*** relative('${uri}') => ${result}`)
    return result
  }

  toUri(path: string): string {
    const result = url.pathToFileURL(resolvePath(path)).href
    console.log(`*** toUri('${path}') => ${result}`)
    return result
  }
}
