import fs from 'fs/promises'
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
}
