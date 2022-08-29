import { LanguageName, Source } from '@cucumber/language-service'
import fg from 'fast-glob'
import fs from 'fs/promises'
import { extname, join, resolve as resolvePath } from 'path'
import url from 'url'

export const glueExtByLanguageName: Record<LanguageName, string> = {
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
  cwd: string,
  globs: readonly string[]
): Promise<readonly Source<LanguageName>[]> {
  return loadSources(cwd, globs, glueExtensions, glueLanguageNameByExt)
}

export function getLanguage(ext: string): LanguageName | undefined {
  return glueLanguageNameByExt[ext]
}

export async function loadGherkinSources(
  cwd: string,
  globs: readonly string[]
): Promise<readonly Source<'gherkin'>[]> {
  return loadSources(cwd, globs, new Set(['.feature']), { '.feature': 'gherkin' })
}

type LanguageNameByExt<L> = Record<string, L>

export async function findPaths(cwd: string, globs: readonly string[]): Promise<readonly string[]> {
  const pathPromises = globs.reduce<readonly Promise<string[]>[]>((prev, glob) => {
    return prev.concat(fg(glob, { caseSensitiveMatch: false, onlyFiles: true, cwd }))
  }, [])
  const pathArrays = await Promise.all(pathPromises)
  const paths = pathArrays.flatMap((paths) => paths)
  return [...new Set(paths).values()].sort().map((path) => join(cwd, path))
}

async function loadSources<L>(
  cwd: string,
  globs: readonly string[],
  extensions: Set<string>,
  languageNameByExt: LanguageNameByExt<L>
): Promise<readonly Source<L>[]> {
  const paths = await findPaths(cwd, globs)

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
