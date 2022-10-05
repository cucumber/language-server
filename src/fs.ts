import { LanguageName, Source } from '@cucumber/language-service'

import { extname, Files } from './Files.js'

export const glueExtByLanguageName: Record<LanguageName, string[]> = {
  tsx: ['.ts', '.tsx'],
  java: ['.java'],
  c_sharp: ['.cs'],
  php: ['.php'],
  ruby: ['.rb'],
  python: ['.py'],
  rust: ['.rs'],
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

export async function findUris(files: Files, globs: readonly string[]): Promise<readonly string[]> {
  // Run all the globs in parallel
  const urisPromises = globs.reduce<readonly Promise<readonly string[]>[]>((prev, glob) => {
    const urisPromise = files.findUris(glob)
    return prev.concat(urisPromise)
  }, [])
  const uriArrays = await Promise.all(urisPromises)
  // Flatten them all
  const uris = uriArrays.flatMap((paths) => paths)
  return [...new Set(uris).values()].sort()
}

async function loadSources<L>(
  files: Files,
  globs: readonly string[],
  extensions: Set<string>,
  languageNameByExt: LanguageNameByExt<L>
): Promise<readonly Source<L>[]> {
  const uris = await findUris(files, globs)

  return Promise.all(
    uris
      .filter((uri) => extensions.has(extname(uri)))
      .map<Promise<Source<L>>>(
        (uri) =>
          new Promise<Source<L>>((resolve) => {
            const languageName = languageNameByExt[extname(uri)]
            return files.readFile(uri).then((content) =>
              resolve({
                languageName,
                content,
                uri,
              })
            )
          })
      )
  )
}
