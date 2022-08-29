import { WasmParserAdapter } from '@cucumber/language-service/wasm'

import { startServer } from '../startServer.js'

export function startWasmServer(wasmBaseUrl: string) {
  startServer(new WasmParserAdapter(wasmBaseUrl))
}
