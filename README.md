# Blockstack Transaction Broadcaster Service

This service buffers up signed `NAME_PREORDER` and `NAME_REGISTRATION`
Blockstack transactions and zonefiles from the
Browser and sends them to the blockchain and Blockstack peer network 
at the right times.

To install from source:

```bash
$ git clone https://github.com/blockstack/transaction-broadcaster transaction-broadcaster
$ cd transaction-broadcaster
$ npm i
$ npm start
```

You can install this service as a program with:

```bash
$ sudo npm i -g  # or, "sudo npm link"
$ which blockstack-transaction-broadcaster
/usr/bin/blockstack-transaction-broadcaster
```

Installing this service is required if you intend to run integration tests.

## Deploying

This service should not require any advanced configuration.  You just run it
as-is.  It will listen on `0.0.0.0:3000` by default.

You can override configuration settings by creating a file `config.json` and
passing it via the `BSK_TRANSACTION_BROADCAST_CONFIG` environment variable.

```
$ cat ./config.json
{
   "dbLocation": "/var/blockstack/transactions.db",
   "port": 12345
}
$ BSK_TRANSACTION_BROADCAST_CONFIG=./config.json blockstack-transaction-broadcaster
```

