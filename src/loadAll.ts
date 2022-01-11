import fg from 'fast-glob'
import fs from 'fs/promises'
import path from 'path'

import { Extension, LanguageName, Source } from './tree-sitter/types.js'

export const languageByExt: Record<Extension, LanguageName> = {
  '.ts': 'typescript',
  '.java': 'java',
}

const extensions = Array.from(Object.keys(languageByExt)).concat('.feature')

export async function loadAll(globs: readonly string[]): Promise<readonly Source[]> {
  const filePromises = globs.reduce<readonly Promise<string[]>[]>((prev, glob) => {
    return prev.concat(fg(glob))
  }, [])
  const fileArrays = await Promise.all(filePromises)

  return Promise.all(
    fileArrays
      .flatMap((files) => files)
      .filter((file) => extensions.includes(path.extname(file)))
      .map<Promise<Source>>(
        (file) =>
          new Promise<Source>((resolve) => {
            const language = languageByExt[path.extname(file) as Extension]
            return fs.readFile(file, 'utf-8').then((content) =>
              resolve({
                language,
                content,
              })
            )
          })
      )
  )
}
