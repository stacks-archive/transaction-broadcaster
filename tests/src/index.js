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
    .persist()
    .post('/pushtx?cors=true')
    .reply(200, 'transaction Submitted')

  nock('https://blockchain.info')
    .persist()
    .get('/latestblock?cors=true')
    .reply(200, { height: 300 })

  let txs = [{hash: 'to-watch-1', height: 294},
             {hash: 'to-watch-2', height: 293},
             {hash: 'to-watch-3', height: 300}]

  const TX1 = '01000000018d5d60122a7907d46f494bcbe34d32e96fc03386ac142823f732c8dd851a98680000' +
        '000000ffffffff0000000000'
  const TX2 = '010000000327a201ffa9201abe33344f98377c3c4f87bbc294b87e3adc9a315e160883cb2b0000' +
        '000000ffffffff423ce7b56485c7ae2454987bb87ab405a22ca77bd4d8edbbea877fa4872a4f83000000' +
        '0000ffffffff8d5d60122a7907d46f494bcbe34d32e96fc03386ac142823f732c8dd851a986800000000' +
        '00ffffffff0000000000'
  const TX3 = '01000000018d5d60122a7907d46f494bcbe34d32e96fc03386ac142823f732c8dd851a98680100' +
        '000000ffffffff0000000000'

  txs.forEach( x => nock('https://blockchain.info')
               .persist()
               .get(`/rawtx/${x.hash}?cors=true`)
               .reply(200, { block_height: x.height }) )

  test('queueRegistration', (t) => {
    t.plan(4)

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
          return s.queueTransactionToBroadcast(TX1, 'to-watch-1', 7)
        })
      .then(
        () => {
          console.log('trying tx 2')
          return s.queueTransactionToBroadcast(TX2, 'to-watch-1', 7)
        })
      .then(
        () => t.ok(false, 'should throw exception when trying to re-use an input in queue'))
      .catch(
        () => t.ok(true, 'should throw exception when trying to re-use an input in queue'))
      .then(
        () => {
          console.log('trying tx 3')
          return s.queueTransactionToBroadcast(TX3, 'to-watch-1', 7)
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
          .then(entries => t.equal(entries.length, 4)))
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

