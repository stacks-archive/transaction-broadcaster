import logger from 'winston'
import btc from 'bitcoinjs-lib'
import { config as bskConfig } from 'blockstack'
import ReadWriteLock from 'rwlock'
import fetch from 'node-fetch'

import { TransactionQueueDB } from './db'

function transactionToTxId(transaction: String) {
  return btc.Transaction.fromHex(transaction)
    .getHash()
    .reverse()
    .toString('hex')
}

function checkTransactions(entries: Array<{txToWatch: String, confirmations: Number}>) {
  return bskConfig.network.getBlockHeight().then(
    blockHeight => Promise.all(entries.map(
      entry => {
        return bskConfig.network.getTransactionInfo(entry.txToWatch)
          .then(txInfo => {
            if (!txInfo.block_height) {
              logger.info(`Failed to get block_height for ${entry.txToWatch} --- probably still unconfirmed.`)
              return false
            } else if (1 + blockHeight - txInfo.block_height < entry.confirmations) {
              logger.info(`${entry.txToWatch}: has ${1 + blockHeight - txInfo.block_height} confirmations.`)
              return false
            } else {
              return true
            }
          })
          .then(status => Object.assign({}, entry, { status }))
      })))
}

// this is a hack -- this is a stand-in while we roll out support for
//   publishing zonefiles via core.blockstack
export function directlyPublishZonefile(zonefile: string) {
  // speak directly to node.blockstack

  const b64Zonefile = Buffer.from(zonefile).toString('base64')

  const postData = '<?xml version=\'1.0\'?>' +
        '<methodCall><methodName>put_zonefiles</methodName>' +
        `<params><param><array><data><value>
         <string>${b64Zonefile}</string></value>
         </data></array></param></params>` +
        '</methodCall>'
  return fetch('https://node.blockstack.org:6263/RPC2',
               { method: 'POST',
                 body: postData })
    .then(resp => {
      if (resp.status >= 200 && resp.status <= 299){
        return resp.text()
      } else {
        logger.error(`Publish zonefile error: Response code from node.blockstack: ${resp.status}`)
        resp.text().then(
          (text) => logger.error(`Publish zonefile error: Response from node.blockstack: ${text}`))
        throw new Error('Failed to publish zonefile. Bad response from node.blockstack')
      }
    })
    .then(respText => {
      const start = respText.indexOf('<string>') + '<string>'.length
      const stop = respText.indexOf('</string>')
      const dataResp = respText.slice(start, stop)
      let jsonResp
      try {
        jsonResp = JSON.parse(dataResp)
      } catch (err) {
        logger.error(`Failed to parse JSON response from node.blockstack: ${respText}`)
        throw err
      }
      if ('error' in jsonResp) {
        logger.error(`Error in publishing zonefile: ${JSON.stringify(jsonResp)}`)
        throw new Error(jsonResp.error)
      }

      if (!jsonResp.saved || jsonResp.saved.length < 1) {
        throw new Error('Invalid "saved" response from node.blockstack')
      }

      if (jsonResp.saved[0] === 1) {
        return true
      } else if (jsonResp.saved[0] === 0) {
        throw new Error('Zonefile not saved')
      }

      throw new Error('Invalid "saved" response from node.blockstack')
    })
}

export class TransactionBroadcaster {
  constructor(config: {dbName: String}) {
    this.db = new TransactionQueueDB(config.dbLocation)
    this.lock = new ReadWriteLock()
  }

  initializeServer() {
    return this.db.initialize()
  }

  withLock(cb) {
    return new Promise((resolve, reject) => {
      this.lock.writeLock((release) => {
        cb()
          .then((response) => {
            release()
            resolve(response)
          })
          .catch((err) => {
            logger.error(`Caught error ${err}, releasing lock and rejecting promise`)
            release()
            reject(err)
          })
      })
    })
  }

  queueTransactionToBroadcast(toBroadcast: String,
                              txidToWatch: String,
                              confirmations: Number) {
    if (confirmations < 1 || confirmations > 10) {
      return Promise.reject(new Error('Confirmations must be between 1 and 10'))
    }
    return this.withLock(
      () => this.db.queueTransactionToBroadcast(toBroadcast, txidToWatch, confirmations)
        .then(() => transactionToTxId(toBroadcast)))
  }

  queueZoneFileBroadcast(zoneFile: String, txidToWatch: String) {
    return this.withLock(
      () => this.db.queueZoneFileBroadcast(zoneFile, txidToWatch))
  }

  broadcastNow(txHex: String) {
    return bskConfig.network.broadcastTransaction(txHex)
      .then(() => transactionToTxId(txHex))
  }

  broadcastZoneFile(zonefile: String) {
    if (bskConfig.network.blockstackAPIUrl === 'https://core.blockstack.org') {
      return directlyPublishZonefile(zonefile)
    } else {
      return bskConfig.network.broadcastZoneFile(zonefile)
    }
  }

  checkWatchlist() {
    return this.withLock(() => {
      return this.db.getTrackedTransactions()
        .then(entries => {
          if (entries.length > 0) {
            logger.info(`${entries.length} watched transactions, not fully confirmed`)
          }
          return checkTransactions(entries)
        })
        .then(transactionsComplete => Promise.all(
          transactionsComplete.map(
            entry => {
              if (entry.status === false) {
                return { status: false }
              }
              let broadcastPromise
              if (entry.type === 'zoneFile') {
                broadcastPromise = this.broadcastZoneFile(entry.zoneFile)
              } else if (entry.type === 'transaction') {
                broadcastPromise = this.broadcastNow(entry.transaction)
              }
              return broadcastPromise
                .then(() => ({ txToWatch: entry.txToWatch, type: entry.type, status: true }))
                .catch((err) => {
                  logger.error(`Error processing broadcast while watching ${entry.txToWatch}: ${err}`)
                  logger.error(err.stack)
                  return { status: false }
                })
            })))
        .then(broadcastsComplete => Promise.all(
          broadcastsComplete
            .filter(x => x.status)
            .map(entry => this.db.clearWatchedTransaction(entry))))
    })
  }
}
