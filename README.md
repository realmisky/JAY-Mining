# JAY Network CLI Miner

A command-line Proof-of-Work miner for the JAY Network. Connects to the JAY mining pool via WebSocket, performs multi-threaded SHA-256 mining, and submits valid shares.

## Features

- Multi-threaded SHA-256 mining using Node.js worker_threads
- WebSocket connection to JAY Network mining pool
- Automatic reconnection with exponential backoff
- Colored CLI output with live hashrate display
- Configurable via CLI arguments or .env file
- Graceful shutdown on Ctrl+C

## Requirements

- Node.js 18 or higher
- npm

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure your wallet address. Either copy `.env.example` to `.env` and edit it:

```bash
cp .env.example .env
# Edit .env and set WALLET_ADDRESS=yjay1yourwalletaddress
```

Or pass it directly via CLI argument.

3. Start mining:

```bash
npm start
```

## CLI Usage

```bash
node src/index.js --wallet=yjay162huaz2qdsdpnjs5qlhtqcqnesr2ru0s0dy9wd --threads=4
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--wallet=<address>` | JAY wallet address (must start with "yjay") | Required |
| `--threads=<n>` | Number of mining threads | CPU core count |
| `--miner-id=<id>` | Custom miner identifier | Auto-generated |
| `--help, -h` | Show help message | - |

### Environment Variables

Set these in a `.env` file in the project root:

| Variable | Description |
|----------|-------------|
| `WALLET_ADDRESS` | JAY wallet address |
| `THREADS` | Number of mining threads |
| `MINER_ID` | Custom miner ID |

## How It Works

1. The miner fetches a WebSocket token from the JAY Network mining API
2. It connects to the mining pool via WebSocket
3. When a new work message arrives, the miner distributes the nonce range across worker threads
4. Each worker computes SHA-256 hashes and checks them against the difficulty target
5. Valid shares (hashes below the target) are submitted to the pool
6. The pool responds with share acceptance and periodically broadcasts pool stats and new blocks

## Dependencies

- [ws](https://www.npmjs.com/package/ws) - WebSocket client
- [dotenv](https://www.npmjs.com/package/dotenv) - Environment variable loading
- [chalk](https://www.npmjs.com/package/chalk) (v4) - Terminal color output

## License

MIT
