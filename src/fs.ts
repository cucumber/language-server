import { LanguageName, Source } from '@cucumber/language-service'
import fg from 'fast-glob'
import fs from 'fs/promises'
import { extname } from 'path'

export const glueExtByLanguageName: Record<LanguageName, string> = {
  typescript: '.ts',
  java: '.java',
  c_sharp: '.cs',
  php: '.php',
  ruby: '.rb',
}

const glueLanguageNameByExt = Object.fromEntries<LanguageName>(
  Object.entries(glueExtByLanguageName).map(([language, ext]) => [ext, language as LanguageName])
)
const glueExtensions = new Set(Object.keys(glueLanguageNameByExt))

export async function loadGlueSources(
  globs: readonly string[]
): Promise<readonly Source<LanguageName>[]> {
  return loadGlobs(globs, glueExtensions, glueLanguageNameByExt)
}

export async function loadGherkinSources(
  globs: readonly string[]
): Promise<readonly Source<'gherkin'>[]> {
  return loadGlobs(globs, new Set(['.feature']), { '.feature': 'gherkin' })
}

type LanguageNameByExt<L> = Record<string, L>

async function loadGlobs<L>(
  globs: readonly string[],
  extensions: Set<string>,
  languageNameByExt: LanguageNameByExt<L>
): Promise<readonly Source<L>[]> {
  const filePromises = globs.reduce<readonly Promise<string[]>[]>((prev, glob) => {
    return prev.concat(fg(glob, { caseSensitiveMatch: false }))
  }, [])
  const fileArrays = await Promise.all(filePromises)

  return Promise.all(
    fileArrays
      .flatMap((paths) => paths)
      .filter((path) => extensions.has(extname(path)))
      .map<Promise<Source<L>>>(
        (path) =>
          new Promise<Source<L>>((resolve) => {
            const language = languageNameByExt[extname(path)]
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
