import { walkGherkinDocument } from '@cucumber/gherkin-utils'
import { parseGherkinDocument } from '@cucumber/language-service'

export function buildStepTexts(gherkinSource: string): readonly string[] {
  const { gherkinDocument } = parseGherkinDocument(gherkinSource)
  if (!gherkinDocument) {
    return []
  }
  const stepTexts: string[] = []
  walkGherkinDocument(gherkinDocument, undefined, {
    step(step) {
      stepTexts.push(step.text)
    },
  })
  return stepTexts
}
