#!/usr/bin/env node
'use strict';

const chalk = require('chalk');
const { loadConfig } = require('./config');
const { Miner } = require('./miner');
const { formatHashrate, formatTime } = require('./utils');

function showHelp() {
  console.log(`
${chalk.bold.cyan('JAY Network CLI Miner')}

${chalk.bold('Usage:')}
  node src/index.js [options]

${chalk.bold('Options:')}
  --wallet=<address>    Wallet address (must start with "yjay")
  --threads=<n>         Number of mining threads (default: CPU count)
  --miner-id=<id>       Custom miner ID (default: auto-generated)
  --help, -h            Show this help message

${chalk.bold('Environment Variables (.env):')}
  WALLET_ADDRESS        Wallet address
  THREADS               Number of threads
  MINER_ID              Miner ID

${chalk.bold('Examples:')}
  node src/index.js --wallet=yjay162huaz2qdsdpnjs5qlhtqcqnesr2ru0s0dy9wd
  node src/index.js --wallet=yjay162huaz2qdsdpnjs5qlhtqcqnesr2ru0s0dy9wd --threads=4
`);
}

function showBanner(config) {
  console.log(chalk.cyan(`
   ╔══════════════════════════════════════╗
   ║      JAY Network CLI Miner v1.0     ║
   ╚══════════════════════════════════════╝
  `));
  console.log(chalk.white(`  Wallet:   ${chalk.green(config.wallet)}`));
  console.log(chalk.white(`  Threads:  ${chalk.green(config.threads)}`));
  console.log(chalk.white(`  Miner ID: ${chalk.green(config.minerId || 'auto-generate')}`));
  console.log('');
}

function main() {
  const config = loadConfig();

  if (config.help) {
    showHelp();
    process.exit(0);
  }

  showBanner(config);

  const miner = new Miner(config);
  let hashrateInterval = null;

  // Status messages
  miner.on('status', (msg) => {
    console.log(chalk.gray(`[${timestamp()}]`) + chalk.white(` ${msg}`));
  });

  // Connected
  miner.on('connected', (url) => {
    console.log(chalk.gray(`[${timestamp()}]`) + chalk.green(` Connected to pool: ${url}`));
  });

  // Disconnected
  miner.on('disconnected', (reason) => {
    console.log(chalk.gray(`[${timestamp()}]`) + chalk.yellow(` Disconnected: ${reason}`));
  });

  // New work received
  miner.on('new_work', (payload) => {
    console.log(chalk.gray(`[${timestamp()}]`) + chalk.cyan(` New work: job=${payload.jobId} difficulty=${payload.difficulty} height=${payload.networkHeight}`));
  });

  // Share found
  miner.on('share_found', (share) => {
    console.log(chalk.gray(`[${timestamp()}]`) + chalk.magenta(` Share found: nonce=${share.nonce} hash=${share.hash.substring(0, 16)}...`));
  });

  // Share accepted
  miner.on('share_accepted', (payload) => {
    console.log(chalk.gray(`[${timestamp()}]`) + chalk.green(` Share accepted! Total shares: ${payload.shares} | Pool miners: ${payload.poolMiners}`));
  });

  // Pool stats
  miner.on('pool_stats', (payload) => {
    console.log(chalk.gray(`[${timestamp()}]`) + chalk.cyan(` Pool stats: hashrate=${payload.totalHashrate.toFixed(2)} H/s | miners=${payload.miners} | efficiency=${payload.efficiency}%`));
  });

  // Network block
  miner.on('network_block', (payload) => {
    console.log(chalk.gray(`[${timestamp()}]`) + chalk.yellow(` New block: height=${payload.height} hash=${payload.hash.substring(0, 16)}...`));
  });

  // Errors
  miner.on('error', (msg) => {
    console.log(chalk.gray(`[${timestamp()}]`) + chalk.red(` Error: ${msg}`));
  });

  // Hashrate display every 5 seconds
  hashrateInterval = setInterval(() => {
    const rate = miner.getHashrate();
    const uptime = formatTime(Date.now() - miner.startTime);
    console.log(chalk.gray(`[${timestamp()}]`) + chalk.white(` Hashrate: ${chalk.bold.green(formatHashrate(rate))} | Shares: ${miner.totalShares}/${miner.acceptedShares} | Uptime: ${uptime}`));
  }, 5000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.gray(`\n[${timestamp()}]`) + chalk.yellow(' Shutting down...'));
    clearInterval(hashrateInterval);
    miner.stop();
    setTimeout(() => {
      console.log(chalk.green('Goodbye!'));
      process.exit(0);
    }, 500);
  });

  // Start mining
  miner.start();
}

function timestamp() {
  return new Date().toLocaleTimeString();
}

main();
