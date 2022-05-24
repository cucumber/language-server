import { LocationLink, Range } from 'vscode-languageserver-types'

export async function guessStepDefinitionSnippetLink(
  links: readonly LocationLink[]
): Promise<LocationLink | undefined> {
  if (links.length > 0) {
    // TODO: Find the most relevant one by looking at the words in the expression
    // If none found, use the most recently modified
    const link = links[links.length - 1]

    // Insert right after the last step definition
    const targetRange = Range.create(
      link.targetRange.end.line + 1,
      0,
      link.targetRange.end.line + 1,
      0
    )
    return {
      targetUri: link.targetUri,
      targetRange,
      targetSelectionRange: targetRange,
    }
  } else {
    return undefined
  }

  // const paths = await findPaths(glueGlobs)
  // if (paths.length > 0) {
  //   return resolve(paths[0])
  // } else if (glueGlobs.length > 0) {
  //   const glob0 = glueGlobs[0]
  //   const tasks = fg.generateTasks(glob0)
  //   const globPath = tasks[0].positive[0].replace('**/', '')
  //   let globExt = extname(globPath)
  //   if (globExt === '') {
  //     globExt = await guessExtension()
  //   }
  //   const dir = dirname(globPath)
  //   const path = join(dir, `stepdefs${globExt}`)
  //   return resolve(path)
  // } else {
  //   throw new Error(
  //     'The glue globs are empty. Cannot determine where to write the step definition snippet'
  //   )
  // }
}

// const fileAssociations = {
//   '.ts': ['tsconfig.json'],
//   '.js': ['package.json'],
//   '.java': ['pom.xml', '*.gradle'],
//   '.php': ['composer.json'],
//   '.cs': ['*.sln'],
//   '.rb': ['Rakefile', 'Gemfile', '*.gemspec'],
// }
//
// async function guessExtension(): Promise<string> {
//   let allGlobs: string[] = []
//   for (const [ext, globs] of Object.entries(fileAssociations)) {
//     allGlobs = allGlobs.concat(...globs)
//     const files = await findPaths(globs)
//     if (files.length > 0) return ext
//   }
//   throw new Error(
//     `Unable to determine extension for new step definition. Couldn't find any files matching these globs: ${JSON.stringify(
//       allGlobs,
//       null,
//       2
//     )}`
//   )
// }
