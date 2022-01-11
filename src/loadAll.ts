import fg from 'fast-glob'
import fs from 'node:fs/promises'

export async function loadAll(globs: readonly string[]): Promise<readonly string[]> {
  const pathPromises = globs.reduce<Promise<string[]>[]>((prev, glob) => {
    const paths = fg(glob)
    return prev.concat(paths)
  }, [])
  const pathArrays = await Promise.all(pathPromises)
  const paths = pathArrays.flatMap((files) => files)
  return await Promise.all(paths.map((path) => fs.readFile(path, 'utf-8')))
}
