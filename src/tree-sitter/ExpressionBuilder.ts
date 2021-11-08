import Parser, { Language } from 'web-tree-sitter'

import { buildExpressions, TreeSitterQueries } from './buildExpressions.js'
import { javaQueries } from './javaQueries.js'
import { typeScriptQueries } from './typeScriptQueries.js'

const treeSitterQueriesByLanguageName: Record<LanguageName, TreeSitterQueries> = {
  java: javaQueries,
  typescript: typeScriptQueries,
}

export type LanguageName = 'java' | 'typescript'

export type WasmUrls = Record<LanguageName, string>

export class ExpressionBuilder {
  private parser: Parser
  private languages: Record<LanguageName, Language>

  async init(wasmUrls: WasmUrls) {
    await Parser.init()
    this.parser = new Parser()
    this.languages = {
      java: await Parser.Language.load(wasmUrls['java']),
      typescript: await Parser.Language.load(wasmUrls['typescript']),
    }
  }

  build(languageName: LanguageName, sources: string[]) {
    if (!this.parser) throw new Error(`Please call init() first`)
    const language = this.languages[languageName]
    const treeSitterQueries = treeSitterQueriesByLanguageName[languageName]
    return buildExpressions(this.parser, language, treeSitterQueries, sources)
  }
}
