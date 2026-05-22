'use strict';

const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function parseArgs(argv) {
  const args = {};
  for (const arg of argv.slice(2)) {
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg.startsWith('--wallet=')) {
      args.wallet = arg.split('=')[1];
    } else if (arg.startsWith('--threads=')) {
      args.threads = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--miner-id=')) {
      args.minerId = arg.split('=')[1];
    }
  }
  return args;
}

function loadConfig() {
  const args = parseArgs(process.argv);

  if (args.help) {
    return { help: true };
  }

  const wallet = args.wallet || process.env.WALLET_ADDRESS || '';
  const threads = args.threads || (process.env.THREADS ? parseInt(process.env.THREADS, 10) : os.cpus().length);
  const minerId = args.minerId || process.env.MINER_ID || '';

  if (!wallet) {
    console.error('Error: Wallet address is required. Use --wallet=yjay... or set WALLET_ADDRESS in .env');
    process.exit(1);
  }

  if (!wallet.startsWith('yjay')) {
    console.error('Error: Wallet address must start with "yjay"');
    process.exit(1);
  }

  return {
    help: false,
    wallet,
    threads,
    minerId
  };
}

module.exports = { loadConfig, parseArgs };
