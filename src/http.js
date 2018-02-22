import cors from 'cors'
import express from 'express'
import bodyParser from 'body-parser'
import logger from 'winston'

import { TransactionBroadcaster } from './server'

const HEADERS = { 'Content-Type': 'application/json' }

function jsonError(res) {
  res.writeHead(409, HEADERS)
  res.write(JSON.stringify(
    { status: false,
      message: 'Failed to parse your registration request: expected a JSON body' }))
  res.end()
}

export function makeHTTPServer(config) {
  const app = express()
  const server = new TransactionBroadcaster(config)

  app.use(cors())
  app.use(bodyParser.json())
  
  app.get('/v1/status', (req, res) => {
    res.status(200).json(JSON.stringify({"status": "OK"}))
    res.end()
  })

  app.post('/v1/broadcast/registration', (req, res) => {
    const request = req.body
    if (!request) {
      return jsonError(res)
    }

    let preorderTx, registerTx

    const confirmations = request.confirmations || 4
    server.broadcastNow(request.preorderTransaction)
      .then((txidPreorder) => {
        preorderTx = txidPreorder
        logger.info(`Queueing register to follow tx ${txidPreorder}`)
        return server.queueTransactionToBroadcast(
          request.registerTransaction, txidPreorder, confirmations)
      })
      .then((txidRegister) => {
        registerTx = txidRegister
        return server.queueZoneFileBroadcast(request.zoneFile, txidRegister)
      })
      .then(() => {
        res.writeHead(202, HEADERS)
        res.write(JSON.stringify(
          { status: true,
            message: 'Preorder and Register queued for broadcast.',
            preorderTxHash: preorderTx,
            registerTxHash: registerTx }))
        res.end()
      })
      .catch((err) => {
        logger.error(err)
        logger.error(err.stack)
        res.writeHead(409, HEADERS)
        res.write(JSON.stringify(
          { status: false,
            message: 'Error queueing the given transaction for broadcast.' }))
        res.end()
      })
  })

  app.post('/v1/broadcast/transaction', (req, res) => {
    const request = req.body
    if (!request) {
      return jsonError(res)
    }
    let broadcastPromise
    if (request.confirmations === 0) {
      broadcastPromise = server.broadcast(request.transaction)
    } else {
      broadcastPromise = server.queueTransactionToBroadcast(
        request.transaction, request.transactionToWatch, request.confirmations)
    }

    broadcastPromise
      .then((TxHash) => {
        logger.info(`Queued txhash ${TxHash} for broadcast.`)
        res.writeHead(202, HEADERS)
        res.write(JSON.stringify(
          { status: true,
            message: 'Transaction queued for broadcast.',
            TxHash }))
        res.end()
      })
      .catch((err) => {
        logger.error(err)
        logger.error(err.stack)
        res.writeHead(409, HEADERS)
        res.write(JSON.stringify(
          { status: false,
            message: 'Error queueing the given transaction for broadcast.' }))
        res.end()
      })
  })

  app.post('/v1/broadcast/zone-file', (req, res) => {
    const request = req.body
    if (!request) {
      return jsonError(res)
    }

    server.queueZoneFileBroadcast(request.zoneFile, request.transactionToWatch)
      .then(() => {
        logger.info(`Queued zonefile to broadcast for ${request.transactionToWatch}`)
        res.writeHead(202, HEADERS)
        res.write(JSON.stringify(
          { status: true,
            message: 'Zonefile queued for broadcast once announced.' }))
        res.end()
      })
      .catch((err) => {
        logger.error(err)
        logger.error(err.stack)
        res.writeHead(409, HEADERS)
        res.write(JSON.stringify(
          { status: false,
            message: 'Error queueing the given zonefile for broadcast.' }))
        res.end()
      })
  })

  const transactionDelay = Math.min(2147483647,
                                    Math.floor(60000 * config.checkTransactionPeriod))

  return server.initializeServer()
    .then(() => {
      // schedule timers
      setInterval(() => {
        logger.debug('Waking up to check transactions')
        server.checkWatchlist()
          .catch((err) => {
            logger.error(`Error checking transactions: ${err}`)
            logger.error(err.stack)
          })
      }, transactionDelay)
      return app
    })
}
