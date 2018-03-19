import { config as bskConfig, network as bskNetwork } from 'blockstack'
import winston from 'winston'
import fs from 'fs'
import os from 'os'
import process from 'process'

const BLOCKSTACK_TEST = process.env.BLOCKSTACK_TEST;
const DB_PATH = BLOCKSTACK_TEST ? '~/transaction_broadcaster.testnet.db' : '~/transaction_broadcaster.db';

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
  port: 16269,
  blockstack: { // right now, these are placeholders --
                // this is not actually configurable yet
    api: 'https://core.blockstack.org',
    utxo: 'https://utxo.blockstack.org'
  }
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
  dbLocation: os.homedir() ? DB_PATH.replace(/^~($|\/|\\)/, `${os.homedir()}$1`) : DB_PATH,
  regtest: false,
  stalenessDeadline: 2*60*60,
  port: 3000,
  blockstack: { // right now, these are placeholders --
                // this is not actually configurable yet
    api: 'https://core.blockstack.org',
    utxo: 'https://utxo.blockstack.org'
  }
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
