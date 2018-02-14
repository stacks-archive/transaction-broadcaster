import logger from 'winston'

import { config as bskConfig, network as bskNetwork } from 'blockstack'
import { makeHTTPServer } from './http'
import { getConfig } from './config'

const config = getConfig()

if (config.regtest) {
  bskConfig.network = bskNetwork.defaults.LOCAL_REGTEST
}

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
