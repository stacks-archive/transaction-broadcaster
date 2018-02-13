import btc from 'bitcoinjs-lib'
import { config as bskConfig } from 'blockstack'

function transactionToTxId(transaction: String) {
  return btc.Transaction.fromHex(transaction)
    .getHash()
    .reverse()
    .toString('hex')
}


export class TransactionBroadcaster {
  constructor(config: {}) {
  }

  initializeServer() {
    return this.db.initialize()
  }

  queueTransactionToBroadcast(toBroadcastHex: String,
                              txidToWatch: String,
                              confirmations: Number) {
    if (confirmations < 1 || confirmations > 10) {
      return Promise.reject(new Error('Confirmations must be between 1 and 10'))
    }
    return this.db.queueTransactionBroadcast(toBroadcast, txidToWatch, confirmations)
      .then(() => transactionToTxId(toBroadcast))
  }

  broadcastNow(txHex: String) {
    return bskConfig.network.broadcastTransaction(txHex)
  }

  queueZoneFileBroadcast(zoneFile: String, txidToWatch: String) {
    return this.db.queueZoneFileBroadcast(zoneFile, txidToWatch)
  }

  checkWatchlist() {
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
  }
}
