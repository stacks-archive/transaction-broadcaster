import { config as bskConfig, network as bskNetwork } from 'blockstack'
import winston from 'winston'
import fs from 'fs'

const configDevelopDefaults = {
  winstonConsoleTransport: {
      level: 'info',
      handleExceptions: false,
      timestamp: true,
      stringify: true,
      colorize: true,
      json: false
  },
  checkTransactionPeriod: 0.1,
  dbLocation: '/tmp/transaction_broadcaster.db',
  regtest: true,
  stalenessDeadline: 10*60,
  port: 16269
}

const configDefaults = {
  winstonConsoleTransport: {
      level: 'info',
      handleExceptions: false,
      timestamp: true,
      stringify: true,
      colorize: true,
      json: false
  },
  checkTransactionPeriod: 5,
  dbLocation: '/root/transaction_broadcaster.db',
  regtest: false,
  stalenessDeadline: 2*60*60,
  port: 3000
}


export function getConfig() {
  let config = Object.assign({}, configDefaults)
  if (process.env.BSK_TRANSACTION_BROADCAST_DEVELOP) {
    config = Object.assign({}, configDevelopDefaults)
  }
  if (process.env.BSK_TRANSACTION_BROADCAST_CONFIG) {
    const configFile = process.env.BSK_TRANSACTION_BROADCAST_CONFIG
    Object.assign(config, JSON.parse(fs.readFileSync(configFile)))
  }

  if (config.regtest) {
    bskConfig.network = bskNetwork.defaults.LOCAL_REGTEST
    if (process.env.BLOCKSTACK_TEST_CLIENT_RPC_PORT) {
      const port = process.env.BLOCKSTACK_TEST_CLIENT_RPC_PORT
      bskConfig.network.blockstackAPIUrl = `http://localhost:${port}`
    }
  }

  config.winstonConfig = { transports: [
    new winston.transports.Console(config.winstonConsoleTransport)
  ] }

  return config
}
