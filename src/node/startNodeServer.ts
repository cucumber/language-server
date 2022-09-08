import { NodeParserAdapter } from '@cucumber/language-service/node'

import { startServer } from '../startServer.js'
import { NodeFiles } from './NodeFiles'

export function startNodeServer() {
  startServer(new NodeParserAdapter(), (rootUri) => new NodeFiles(rootUri))
}
