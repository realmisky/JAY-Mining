#!/usr/bin/env node
'use strict';

require('dotenv').config();
const chalk = require('chalk');
const { deriveWallet } = require('./wallet');
const { BrowserMiner } = require('./browser-miner');

function showHelp() {
  console.log(`
${chalk.bold.cyan('JAY Network Browser Miner v2.0')}

${chalk.bold('Usage:')}
  node src/index.js [options]

${chalk.bold('Options:')}
  --headless=false    Show the browser window (for debugging)
  --help, -h          Show this help message

${chalk.bold('Environment Variables (.env):')}
  MNEMONIC            Your wallet mnemonic phrase (12 or 24 words)
  THREADS             Number of threads hint (default: 4)

${chalk.bold('How it works:')}
  1. Derives your wallet address from the mnemonic (yjay prefix)
  2. Launches a browser with an injected Keplr wallet mock
  3. Navigates to the JAY mining site
  4. Connects the wallet and mining starts automatically
  5. Monitors mining stats via WebSocket interception and DOM polling

${chalk.bold('Examples:')}
  node src/index.js
  node src/index.js --headless=false
  MNEMONIC="word1 word2 ..." node src/index.js
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    help: false,
    headless: true
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--headless=false') {
      options.headless = false;
    } else if (arg === '--headless=true') {
      options.headless = true;
    }
  }

  return options;
}

function showBanner() {
  console.log(chalk.cyan(`
   +======================================+
   |    JAY Network Browser Miner v2.0    |
   +======================================+
  `));
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  showBanner();

  // Security warning
  console.log(chalk.red.bold('  WARNING: Never share your mnemonic phrase with anyone!'));
  console.log('');

  // Get mnemonic from environment
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    console.log(chalk.red('[Error] MNEMONIC not set.'));
    console.log(chalk.yellow('Set it in your .env file or as an environment variable:'));
    console.log(chalk.gray('  MNEMONIC="your twelve or twenty four word phrase" node src/index.js'));
    process.exit(1);
  }

  // Validate mnemonic word count
  const wordCount = mnemonic.trim().split(/\s+/).length;
  if (wordCount !== 12 && wordCount !== 24) {
    console.log(chalk.red(`[Error] Mnemonic must be 12 or 24 words (got ${wordCount})`));
    process.exit(1);
  }

  // Derive wallet
  console.log(chalk.cyan('[*] Deriving wallet from mnemonic...'));
  let walletInfo;
  try {
    walletInfo = await deriveWallet(mnemonic);
  } catch (err) {
    console.log(chalk.red(`[Error] Failed to derive wallet: ${err.message}`));
    process.exit(1);
  }

  console.log(chalk.green(`[+] Wallet address: ${walletInfo.address}`));
  console.log(chalk.gray(`    Algorithm: ${walletInfo.algo}`));
  console.log('');

  const threads = parseInt(process.env.THREADS, 10) || 4;
  console.log(chalk.white(`  Mode:     ${options.headless ? 'Headless' : 'Visible browser'}`));
  console.log(chalk.white(`  Threads:  ${threads} (hint for display)`));
  console.log('');

  // Launch browser miner
  const miner = new BrowserMiner({
    walletInfo,
    headless: options.headless,
    threads
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n[*] Shutting down...'));
    await miner.stop();
    console.log(chalk.green('Goodbye!'));
    process.exit(0);
  });

  await miner.start();
}

main().catch((err) => {
  console.error(chalk.red(`[Fatal] ${err.message}`));
  process.exit(1);
});
