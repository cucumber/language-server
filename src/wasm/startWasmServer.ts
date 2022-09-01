import { WasmParserAdapter } from '@cucumber/language-service/wasm'

import { Files } from '../Files'
import { startServer } from '../startServer.js'

export function startWasmServer(wasmBaseUrl: string, files: Files) {
  startServer(new WasmParserAdapter(wasmBaseUrl), files)
}
