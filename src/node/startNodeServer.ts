import { NodeParserAdapter } from '@cucumber/language-service/node'

import { startServer } from '../startServer.js'

export function startNodeServer() {
  startServer(new NodeParserAdapter())
}
