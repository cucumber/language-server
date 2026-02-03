import { LanguageName, Source } from '@cucumber/language-service'
import { createHash } from 'crypto'

import { extname, Files } from './Files.js'

export const glueExtByLanguageName: Record<LanguageName, string[]> = {
  javascript: ['.js', '.cjs', '.mjs', '.jsx'],
  tsx: ['.ts', '.cts', '.mts', '.tsx'],
  java: ['.java'],
  c_sharp: ['.cs'],
  php: ['.php'],
  ruby: ['.rb'],
  python: ['.py'],
  rust: ['.rs'],
  go: ['.go'],
  scala: ['.scala'],
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
  globs: readonly string[],
  cache: SourceCache<LanguageName> = new Map()
  // changedFile?: TextDocument
): Promise<readonly Source<LanguageName>[]> {
  return loadSources(files, globs, glueExtensions, glueLanguageNameByExt, cache)
}

export function getLanguage(ext: string): LanguageName | undefined {
  return glueLanguageNameByExt[ext]
}

export async function loadGherkinSources(
  files: Files,
  globs: readonly string[],
  cache: SourceCache<'gherkin'> = new Map()
): Promise<readonly Source<'gherkin'>[]> {
  return loadSources(files, globs, new Set(['.feature']), { '.feature': 'gherkin' }, cache)
}

type LanguageNameByExt<L> = Record<string, L>

export interface SourceCacheEntry<L> {
  source: Source<L>
  digest: string
}

export type SourceCache<L = unknown> = Map<string, SourceCacheEntry<L>>

function computeDigest(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

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

export interface TextDocument {
  uri: string
  content: string
}

async function updateSourceInternal<L>(
  document: TextDocument,
  files: Files,
  sourcesCacheMap: SourceCache<L>,
  languageName: L
): Promise<Source<L>> {
  const content = await files.readFile(document.uri)
  const digest = computeDigest(content)

  if (sourcesCacheMap.has(document.uri)) {
    const cached = sourcesCacheMap.get(document.uri)
    if (cached && cached.digest === digest) {
      return cached.source
    }
  }

  const source: Source<L> = {
    languageName,
    uri: document.uri,
    content,
  }

  sourcesCacheMap.set(document.uri, { source, digest })
  return source
}

export async function updateGherkinSource(
  document: TextDocument,
  files: Files,
  sourcesCacheMap: SourceCache<'gherkin'>
): Promise<Source<'gherkin'>> {
  return updateSourceInternal(document, files, sourcesCacheMap, 'gherkin')
}

export async function updateGlueSource(
  document: TextDocument,
  files: Files,
  sourcesCacheMap: SourceCache<LanguageName>
): Promise<Source<LanguageName>> {
  const ext = extname(document.uri)
  const languageName = getLanguage(ext)
  if (!languageName) {
    throw new Error(`Unsupported glue file extension: ${ext} for ${document.uri}`)
  }

  return updateSourceInternal(document, files, sourcesCacheMap, languageName)
}

async function loadSources<L>(
  files: Files,
  globs: readonly string[],
  extensions: Set<string>,
  languageNameByExt: LanguageNameByExt<L>,
  cache: SourceCache<L>
): Promise<readonly Source<L>[]> {
  const uris = await findUris(files, globs)

  const sources = await Promise.all(
    uris
      .filter((uri) => extensions.has(extname(uri)))
      .map<Promise<Source<L>>>(
        (uri) =>
          new Promise<Source<L>>((resolve) => {
            const languageName = languageNameByExt[extname(uri)]
            return files.readFile(uri).then((content) => {
              const source: Source<L> = {
                languageName,
                content,
                uri,
              }

              // Compute digest and store in cache
              const digest = computeDigest(content)
              cache.set(uri, { source, digest })

              resolve(source)
            })
          })
      )
  )

  return sources
}
