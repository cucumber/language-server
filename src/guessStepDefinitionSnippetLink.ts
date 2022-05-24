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
    // TODO: try to guess extension and path by looking for package.json, pom.xml etc
    return undefined
  }
}
