import nock from 'nock'
import test from 'tape'

import { TransactionBroadcaster } from '../../lib/server'

nock.disableNetConnect()

function testServer() {
  nock.cleanAll()

  nock('https://node.blockstack.org:6263')
    .post('/RPC2')
    .reply(200, '<string>{"saved": [1]}</string>')

  nock('https://blockchain.info')
    .post('/pushtx?cors=true')
    .reply(200, 'transaction Submitted')

  nock('https://blockchain.info')
    .persist()
    .get('/latestblock')
    .reply(200, { height: 300 })

  let txs = [{hash: 'to-watch-1', height: 294},
             {hash: 'to-watch-2', height: 293},
             {hash: 'to-watch-3', height: 300}]

  txs.forEach( x => nock('https://blockchain.info')
               .persist()
               .get(`/rawtx/${x.hash}`)
               .reply(200, { block_height: x.height }) )

  test('queueRegistration', (t) => {
    t.plan(3)

    let s = new TransactionBroadcaster({ dbLocation: ':memory:',
                                         stalenessDeadline: 60 })
    s.initializeServer()
      .then(
        () =>
          s.queueTransactionToBroadcast('to-broadcast-1',
                                        'to-watch-1',
                                        0))
      .then(
        () => t.ok(false, 'should have thrown exception when confirmations == 0'))
      .catch(
        () => t.ok(true, 'should throw exception when confirmations == 0'))
      .then(
        () => {
          console.log('queueing transaction 1')
          return s.queueTransactionToBroadcast('01000000000000000000', 'to-watch-1', 7)
        })
      .then(
        () => {
          console.log('queueing zonefile 1')
          return s.queueZoneFileBroadcast('zonefile-broadcast-1', 'to-watch-2')
        })
      .then(
        () => {
          console.log('queueing zonefile 2')
          return s.queueZoneFileBroadcast('zonefile-broadcast-2', 'to-watch-3')
        })
      .then(
        () =>
          s.db.getTrackedTransactions()
          .then(entries => t.equal(entries.length, 3)))
      .then(() => s.checkWatchlist())
      .then(() => {
        s.db.getTrackedTransactions()
          .then(entries => t.equal(entries.length, 1))
      })
      .catch((err) => {
        console.error(err)
        console.error(err.stack)
      })
  })
}


testServer()

