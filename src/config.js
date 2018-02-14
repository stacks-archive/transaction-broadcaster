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
  dbLocation: '/tmp/subdomain_registrar.db',
  regtest: true,
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
  dbLocation: '/root/subdomain_registrar.db',
  regtest: false,
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

  config.winstonConfig = { transports: [
    new winston.transports.Console(config.winstonConsoleTransport)
  ] }

  return config
}
