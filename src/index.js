#!/usr/bin/node
import logger from 'winston'

import { makeHTTPServer } from './http'
import { getConfig } from './config'

const config = getConfig()

makeHTTPServer(config)
  .catch((err) => {
    logger.error(err)
    logger.error(err.stack)
    throw err
  })
  .then((server) => {
    server.listen(config.port, () => {
      console.log('Blockstack Transaction Broadcaster started.')
    })
  })
