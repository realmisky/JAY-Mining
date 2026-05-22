# JAY Network Browser Miner

A CLI tool that automates browser-based mining on the JAY Network using Puppeteer with an injected Keplr wallet mock.

## How It Works

1. Derives your wallet address from your mnemonic phrase (BIP44 path `m/44'/118'/0'/0/0`, bech32 prefix `yjay`)
2. Launches a headless Chrome browser with Puppeteer
3. Injects a mock Keplr wallet provider into the page before any scripts run
4. Navigates to `https://mining.thejaynetwork.com/`
5. Waits for the Vercel security challenge to resolve
6. Connects the wallet (the mock Keplr responds to the site's requests)
7. Mining starts automatically in the browser
8. Monitors mining stats via WebSocket frame interception (CDP) and DOM polling

The browser itself handles all the Proof-of-Work computation. This tool simply automates the wallet connection flow that would normally require the Keplr browser extension.

## Setup

```bash
# Install dependencies
npm install

# Copy the example env file and add your mnemonic
cp .env.example .env
# Edit .env and set your MNEMONIC
```

## Configuration

Set these in your `.env` file:

| Variable   | Description                                | Required |
|------------|--------------------------------------------|----------|
| `MNEMONIC` | Your 12 or 24 word mnemonic phrase         | Yes      |
| `THREADS`  | Thread count hint (default: 4)             | No       |

## Usage

```bash
# Start mining (headless mode)
node src/index.js

# Start with visible browser window (for debugging)
node src/index.js --headless=false

# Show help
node src/index.js --help
```

## CLI Options

| Option            | Description                          |
|-------------------|--------------------------------------|
| `--headless=false`| Show the browser window for debugging|
| `--help`, `-h`   | Show help message                    |

## Security

- Your mnemonic phrase is never logged or displayed
- The mnemonic is only used locally to derive wallet keys
- Keys never leave your machine
- Never share your mnemonic phrase with anyone

## Dependencies

- `puppeteer` - Headless Chrome browser automation
- `@cosmjs/amino` - Cosmos SDK wallet derivation
- `@cosmjs/crypto` - Cryptographic primitives for key derivation
- `@cosmjs/encoding` - Encoding utilities
- `chalk@4` - Colored terminal output
- `dotenv` - Environment variable loading

## Chain Configuration

- Chain ID: `thejaynetwork-mainnet`
- RPC: `https://rpc-jayn.winnode.xyz`
- REST: `https://api-jayn.winnode.xyz`
- Bech32 Prefix: `yjay`
- Coin Type: 118
- Currency: JAY (ujay, 6 decimals)

## Troubleshooting

**Chrome not found**: Run `npx puppeteer browsers install chrome` to download the Chrome binary.

**Security challenge timeout**: The Vercel challenge can take up to 60 seconds. If it consistently fails, try running with `--headless=false` to see what is happening.

**Wallet not connecting**: Use `--headless=false` to watch the browser. The site may have changed its UI, requiring selector updates.

## License

MIT
