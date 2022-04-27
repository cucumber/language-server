import { NodeParserAdapter } from '@cucumber/language-service/node'

import { startServer } from '../startServer'

export function startNodeServer() {
  startServer(new NodeParserAdapter())
}
