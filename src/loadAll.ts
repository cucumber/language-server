import { LanguageName, Source } from '@cucumber/language-service'
import fg from 'fast-glob'
import fs from 'fs/promises'
import { extname } from 'path'

export const extByLanguage: Record<LanguageName, string> = {
  typescript: '.ts',
  java: '.java',
  c_sharp: '.cs',
  php: '.php',
  ruby: '.rb',
}

const languageByExt = Object.fromEntries<LanguageName>(
  Object.entries(extByLanguage).map(([language, ext]) => [ext, language as LanguageName])
)
const extensions = Array.from(Object.values(extByLanguage)).concat('.feature')

export async function loadAll(globs: readonly string[]): Promise<readonly Source[]> {
  const filePromises = globs.reduce<readonly Promise<string[]>[]>((prev, glob) => {
    return prev.concat(fg(glob, { caseSensitiveMatch: false }))
  }, [])
  const fileArrays = await Promise.all(filePromises)

  return Promise.all(
    fileArrays
      .flatMap((paths) => paths)
      .filter((path) => extensions.includes(extname(path)))
      .map<Promise<Source>>(
        (path) =>
          new Promise<Source>((resolve) => {
            const language = languageByExt[extname(path)]
            return fs.readFile(path, 'utf-8').then((content) =>
              resolve({
                language,
                content,
                path,
              })
            )
          })
      )
  )
}
