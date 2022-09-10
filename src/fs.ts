import { LanguageName, Source } from '@cucumber/language-service'
import fg from 'fast-glob'
import fs from 'fs/promises'
import { extname, resolve as resolvePath } from 'path'
import url from 'url'

export const glueExtByLanguageName: Record<LanguageName, string[]> = {
  tsx: ['.ts', '.tsx'],
  java: ['.java'],
  c_sharp: ['.cs'],
  php: ['.php'],
  ruby: ['.rb'],
  python: ['.py'],
}

type ExtLangEntry = [string, LanguageName]

const entries = Object.entries(glueExtByLanguageName).reduce<ExtLangEntry[]>((prev, entry) => {
  const newEntries: ExtLangEntry[] = entry[1].map((ext) => [ext, entry[0] as LanguageName])
  return prev.concat(newEntries)
}, [])

const glueLanguageNameByExt = Object.fromEntries<LanguageName>(entries)

const glueExtensions = new Set(Object.keys(glueLanguageNameByExt))

export async function loadGlueSources(
  globs: readonly string[]
): Promise<readonly Source<LanguageName>[]> {
  return loadSources(globs, glueExtensions, glueLanguageNameByExt)
}

export function getLanguage(ext: string): LanguageName | undefined {
  return glueLanguageNameByExt[ext]
}

export async function loadGherkinSources(
  globs: readonly string[]
): Promise<readonly Source<'gherkin'>[]> {
  return loadSources(globs, new Set(['.feature']), { '.feature': 'gherkin' })
}

type LanguageNameByExt<L> = Record<string, L>

export async function findPaths(globs: readonly string[]): Promise<readonly string[]> {
  const pathPromises = globs.reduce<readonly Promise<string[]>[]>((prev, glob) => {
    return prev.concat(fg(glob, { caseSensitiveMatch: false, onlyFiles: true }))
  }, [])
  const pathArrays = await Promise.all(pathPromises)
  const paths = pathArrays.flatMap((paths) => paths)
  return [...new Set(paths).values()].sort()
}

async function loadSources<L>(
  globs: readonly string[],
  extensions: Set<string>,
  languageNameByExt: LanguageNameByExt<L>
): Promise<readonly Source<L>[]> {
  const paths = await findPaths(globs)

  return Promise.all(
    paths
      .filter((path) => extensions.has(extname(path)))
      .map<Promise<Source<L>>>(
        (path) =>
          new Promise<Source<L>>((resolve) => {
            const languageName = languageNameByExt[extname(path)]
            return fs.readFile(path, 'utf-8').then((content) =>
              resolve({
                languageName,
                content,
                uri: url.pathToFileURL(resolvePath(path)).href,
              })
            )
          })
      )
  )
}
