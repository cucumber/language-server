import { LanguageName, Source } from '@cucumber/language-service'

import { extname, Files } from './Files'

const glueExtByLanguageName: Record<LanguageName, string> = {
  typescript: '.ts',
  java: '.java',
  c_sharp: '.cs',
  php: '.php',
  ruby: '.rb',
  python: '.py',
}

const glueLanguageNameByExt = Object.fromEntries<LanguageName>(
  Object.entries(glueExtByLanguageName).map(([language, ext]) => [ext, language as LanguageName])
)
const glueExtensions = new Set(Object.keys(glueLanguageNameByExt))

export async function loadGlueSources(
  files: Files,
  cwd: string,
  globs: readonly string[]
): Promise<readonly Source<LanguageName>[]> {
  return loadSources(files, cwd, globs, glueExtensions, glueLanguageNameByExt)
}

export function getLanguage(ext: string): LanguageName | undefined {
  return glueLanguageNameByExt[ext]
}

export async function loadGherkinSources(
  files: Files,
  cwd: string,
  globs: readonly string[]
): Promise<readonly Source<'gherkin'>[]> {
  return loadSources(files, cwd, globs, new Set(['.feature']), { '.feature': 'gherkin' })
}

type LanguageNameByExt<L> = Record<string, L>

export async function findPaths(
  files: Files,
  cwd: string,
  globs: readonly string[]
): Promise<readonly string[]> {
  const pathPromises = globs.reduce<readonly Promise<readonly string[]>[]>((prev, glob) => {
    const pathsPromise = files.findFiles(cwd, glob)
    return prev.concat(pathsPromise)
  }, [])
  const pathArrays = await Promise.all(pathPromises)
  const paths = pathArrays.flatMap((paths) => paths)
  return [...new Set(paths).values()].sort().map((path) => files.join(cwd, path))
}

async function loadSources<L>(
  files: Files,
  cwd: string,
  globs: readonly string[],
  extensions: Set<string>,
  languageNameByExt: LanguageNameByExt<L>
): Promise<readonly Source<L>[]> {
  const paths = await findPaths(files, cwd, globs)

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
