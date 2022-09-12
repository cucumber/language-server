import { LanguageName, Source } from '@cucumber/language-service'

import { extname, Files } from './Files'

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
  files: Files,
  globs: readonly string[]
): Promise<readonly Source<LanguageName>[]> {
  return loadSources(files, globs, glueExtensions, glueLanguageNameByExt)
}

export function getLanguage(ext: string): LanguageName | undefined {
  return glueLanguageNameByExt[ext]
}

export async function loadGherkinSources(
  files: Files,
  globs: readonly string[]
): Promise<readonly Source<'gherkin'>[]> {
  return loadSources(files, globs, new Set(['.feature']), { '.feature': 'gherkin' })
}

type LanguageNameByExt<L> = Record<string, L>

export async function findPaths(
  files: Files,
  globs: readonly string[]
): Promise<readonly string[]> {
  // Run all the globs in parallel
  const pathsPromises = globs.reduce<readonly Promise<readonly string[]>[]>((prev, glob) => {
    const pathsPromise = files.findFiles(glob)
    return prev.concat(pathsPromise)
  }, [])
  const pathArrays = await Promise.all(pathsPromises)
  // Flatten them all
  const paths = pathArrays.flatMap((paths) => paths)
  return [...new Set(paths).values()].sort()
}

async function loadSources<L>(
  files: Files,
  globs: readonly string[],
  extensions: Set<string>,
  languageNameByExt: LanguageNameByExt<L>
): Promise<readonly Source<L>[]> {
  const paths = await findPaths(files, globs)

  return Promise.all(
    paths
      .filter((path) => extensions.has(extname(path)))
      .map<Promise<Source<L>>>(
        (path) =>
          new Promise<Source<L>>((resolve) => {
            const languageName = languageNameByExt[extname(path)]
            return files.readFile(path).then((content) =>
              resolve({
                languageName,
                content,
                uri: files.toUri(path),
              })
            )
          })
      )
  )
}
