'use strict';

const puppeteer = require('puppeteer');
const chalk = require('chalk');
const { createKeplrMockScript } = require('./keplr-mock');
const { formatHashrate, formatTime } = require('./utils');

const MINING_URL = 'https://mining.thejaynetwork.com/';
const CHALLENGE_TIMEOUT = 60000;
const PAGE_LOAD_TIMEOUT = 30000;

class BrowserMiner {
  constructor(options) {
    this.walletInfo = options.walletInfo;
    this.headless = options.headless !== false;
    this.threads = options.threads || 4;
    this.browser = null;
    this.page = null;
    this.running = false;
    this.startTime = Date.now();
    this.statsInterval = null;
    this.wsMessages = [];
  }

  async start() {
    this.running = true;
    this.startTime = Date.now();

    try {
      await this.launchBrowser();
      await this.injectKeplrAndNavigate();
      await this.waitForChallenge();
      await this.connectWallet();
      await this.monitorMining();
    } catch (err) {
      if (this.running) {
        console.log(chalk.red(`\n[Error] ${err.message}`));
        if (err.message.includes('Could not find Chrome') || err.message.includes('Failed to launch')) {
          console.log(chalk.yellow('\nPuppeteer could not find a Chrome installation.'));
          console.log(chalk.yellow('Try running: npx puppeteer browsers install chrome'));
        }
      }
      await this.stop();
    }
  }

  async launchBrowser() {
    console.log(chalk.cyan('[*] Launching browser...'));

    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1280,720'
    ];

    this.browser = await puppeteer.launch({
      headless: this.headless ? 'new' : false,
      args: launchArgs,
      defaultViewport: { width: 1280, height: 720 }
    });

    console.log(chalk.green('[+] Browser launched successfully'));
  }

  async injectKeplrAndNavigate() {
    this.page = await this.browser.newPage();

    // Set a realistic user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    );

    // Inject the Keplr mock before any page scripts run
    const keplrScript = createKeplrMockScript(this.walletInfo);
    await this.page.evaluateOnNewDocument(keplrScript);

    // Set up CDP session for WebSocket monitoring
    const client = await this.page.createCDPSession();
    await client.send('Network.enable');

    // Monitor WebSocket frames
    client.on('Network.webSocketFrameReceived', (params) => {
      this.handleWebSocketFrame('recv', params);
    });
    client.on('Network.webSocketFrameSent', (params) => {
      this.handleWebSocketFrame('send', params);
    });

    // Listen to console messages from the page
    this.page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('mining') || text.includes('hash') || text.includes('share') ||
          text.includes('connected') || text.includes('work') || text.includes('block')) {
        console.log(chalk.gray(`  [page] ${text}`));
      }
    });

    console.log(chalk.cyan(`[*] Navigating to ${MINING_URL}`));
    await this.page.goto(MINING_URL, {
      waitUntil: 'domcontentloaded',
      timeout: PAGE_LOAD_TIMEOUT
    });
  }

  async waitForChallenge() {
    console.log(chalk.yellow('[*] Waiting for security challenge to resolve...'));

    const startTime = Date.now();
    let resolved = false;

    while (!resolved && (Date.now() - startTime) < CHALLENGE_TIMEOUT) {
      const title = await this.page.title();
      if (!title.toLowerCase().includes('vercel') && !title.toLowerCase().includes('checkpoint') &&
          !title.toLowerCase().includes('just a moment')) {
        resolved = true;
        break;
      }
      await this.delay(2000);
    }

    if (resolved) {
      console.log(chalk.green('[+] Security challenge passed'));
    } else {
      console.log(chalk.yellow('[!] Challenge may still be pending, continuing anyway...'));
    }

    // Wait a bit for the page to fully render
    await this.delay(3000);
  }

  async connectWallet() {
    console.log(chalk.cyan('[*] Looking for Connect Wallet button...'));

    // Try various selectors that mining sites commonly use
    const selectors = [
      'button:has-text("Connect")',
      'button:has-text("Connect Wallet")',
      'button:has-text("connect wallet")',
      '[class*="connect"]',
      '[class*="wallet"]',
      'button[class*="Connect"]',
      'button[class*="wallet"]'
    ];

    let clicked = false;

    // First try with XPath-based text matching
    try {
      const buttons = await this.page.$$('button');
      for (const button of buttons) {
        const text = await this.page.evaluate(el => el.textContent.toLowerCase(), button);
        if (text.includes('connect')) {
          await button.click();
          clicked = true;
          console.log(chalk.green(`[+] Clicked button: "${text.trim()}"`));
          break;
        }
      }
    } catch (err) {
      // Continue to other methods
    }

    if (!clicked) {
      // Try with selectors
      for (const selector of selectors) {
        try {
          const el = await this.page.$(selector);
          if (el) {
            await el.click();
            clicked = true;
            console.log(chalk.green(`[+] Clicked element matching: ${selector}`));
            break;
          }
        } catch (err) {
          // Try next selector
        }
      }
    }

    if (!clicked) {
      console.log(chalk.yellow('[!] Could not find Connect Wallet button'));
      console.log(chalk.yellow('    The site may auto-detect Keplr or use a different flow'));
    }

    // Wait for wallet connection to process
    await this.delay(3000);

    // Check if there are additional prompts (like adding chain)
    try {
      const buttons = await this.page.$$('button');
      for (const button of buttons) {
        const text = await this.page.evaluate(el => el.textContent.toLowerCase(), button);
        if (text.includes('approve') || text.includes('confirm') || text.includes('add chain') ||
            text.includes('start') || text.includes('mine')) {
          await button.click();
          console.log(chalk.green(`[+] Clicked additional button: "${text.trim()}"`));
          await this.delay(2000);
        }
      }
    } catch (err) {
      // Non-critical
    }

    console.log(chalk.cyan(`[*] Wallet address: ${chalk.green(this.walletInfo.address)}`));
  }

  async monitorMining() {
    console.log(chalk.cyan('[*] Monitoring mining activity...'));
    console.log(chalk.gray('    Watching for WebSocket messages and DOM updates'));
    console.log('');

    this.statsInterval = setInterval(async () => {
      if (!this.running || !this.page) return;

      try {
        // Poll the page for mining stats
        const stats = await this.page.evaluate(() => {
          const body = document.body ? document.body.innerText : '';
          const result = {};

          // Look for common mining stat patterns in the page
          const hashrateMatch = body.match(/(\d+\.?\d*)\s*(H\/s|KH\/s|MH\/s|hash)/i);
          if (hashrateMatch) result.hashrate = hashrateMatch[0];

          const sharesMatch = body.match(/shares?\s*[:\s]*(\d+)/i);
          if (sharesMatch) result.shares = sharesMatch[1];

          const statusMatch = body.match(/(mining|connected|running|active)/i);
          if (statusMatch) result.status = statusMatch[0];

          // Look for any numbers that might be stats
          const minerText = document.querySelector('[class*="hash"], [class*="rate"], [class*="stat"], [class*="mining"]');
          if (minerText) result.minerElement = minerText.textContent.trim();

          return result;
        });

        const uptime = formatTime(Date.now() - this.startTime);
        let statsLine = chalk.gray(`[${new Date().toLocaleTimeString()}]`) +
          chalk.white(` Uptime: ${uptime}`);

        if (stats.hashrate) {
          statsLine += chalk.green(` | Hashrate: ${stats.hashrate}`);
        }
        if (stats.shares) {
          statsLine += chalk.cyan(` | Shares: ${stats.shares}`);
        }
        if (stats.status) {
          statsLine += chalk.yellow(` | Status: ${stats.status}`);
        }
        if (stats.minerElement) {
          statsLine += chalk.magenta(` | Info: ${stats.minerElement.substring(0, 60)}`);
        }

        console.log(statsLine);
      } catch (err) {
        // Page may have navigated or closed
        if (this.running) {
          console.log(chalk.gray(`[${new Date().toLocaleTimeString()}] Polling page...`));
        }
      }
    }, 5000);

    // Keep running until stopped
    await new Promise((resolve) => {
      this._stopResolve = resolve;
    });
  }

  handleWebSocketFrame(direction, params) {
    try {
      const data = params.response ? params.response.payloadData : params.request ? params.request.payloadData : null;
      if (!data) return;

      const arrow = direction === 'recv' ? chalk.green('<-') : chalk.blue('->');
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        // Not JSON, show raw
        if (data.length < 200) {
          console.log(chalk.gray(`  [ws ${arrow}] ${data.substring(0, 100)}`));
        }
        return;
      }

      // Display relevant mining messages
      const type = parsed.type || parsed.event || parsed.method || '';
      if (type) {
        switch (type.toLowerCase()) {
          case 'new_work':
          case 'work':
          case 'job':
            console.log(chalk.cyan(`  [ws ${arrow}] New work received: ${JSON.stringify(parsed).substring(0, 120)}`));
            break;
          case 'submit_share':
          case 'share':
            console.log(chalk.magenta(`  [ws ${arrow}] Share: ${JSON.stringify(parsed).substring(0, 120)}`));
            break;
          case 'share_accepted':
          case 'accepted':
            console.log(chalk.green(`  [ws ${arrow}] Share accepted!`));
            break;
          case 'pool_stats':
          case 'stats':
            console.log(chalk.cyan(`  [ws ${arrow}] Stats: ${JSON.stringify(parsed).substring(0, 120)}`));
            break;
          case 'network_block':
          case 'block':
            console.log(chalk.yellow(`  [ws ${arrow}] New block: ${JSON.stringify(parsed).substring(0, 120)}`));
            break;
          default:
            console.log(chalk.gray(`  [ws ${arrow}] ${type}: ${JSON.stringify(parsed).substring(0, 100)}`));
        }
      }
    } catch (err) {
      // Ignore parse errors
    }
  }

  async stop() {
    this.running = false;

    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    if (this._stopResolve) {
      this._stopResolve();
      this._stopResolve = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err) {
        // Browser may already be closed
      }
      this.browser = null;
    }

    console.log(chalk.yellow('[*] Browser miner stopped'));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { BrowserMiner };
