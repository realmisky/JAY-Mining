'use strict';

const { Worker } = require('worker_threads');
const path = require('path');
const WebSocket = require('ws');
const EventEmitter = require('events');
const { generateSessionId, generateDeviceId, generateMinerId } = require('./utils');

class Miner extends EventEmitter {
  constructor(config) {
    super();
    this.wallet = config.wallet;
    this.threads = config.threads;
    this.minerId = config.minerId || generateMinerId();
    this.sessionId = generateSessionId();
    this.deviceId = generateDeviceId();

    this.ws = null;
    this.workers = [];
    this.currentJob = null;
    this.pingInterval = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.shouldRun = false;
    this.hashCount = 0;
    this.lastHashTime = Date.now();
    this.totalShares = 0;
    this.acceptedShares = 0;
    this.startTime = Date.now();
  }

  async start() {
    this.shouldRun = true;
    this.startTime = Date.now();
    this.emit('status', 'Fetching WebSocket token...');

    try {
      const tokenData = await this.fetchToken();
      this.emit('status', `Token received. Connecting to pool...`);
      this.connect(tokenData);
    } catch (err) {
      this.emit('error', `Failed to fetch token: ${err.message}`);
      this.scheduleReconnect();
    }
  }

  async fetchToken() {
    const response = await fetch('https://mining.thejaynetwork.com/api/ws-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`Token request failed with status ${response.status}`);
    }

    return response.json();
  }

  connect(tokenData) {
    const wsUrl = tokenData.wsUrl;
    this.emit('status', `Connecting to ${wsUrl}...`);

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      this.reconnectDelay = 1000;
      this.emit('connected', wsUrl);

      // Send status message
      this.sendMessage('status', {
        sessionId: this.sessionId,
        deviceId: this.deviceId,
        status: 'online',
        wallet: this.wallet
      });

      // Start ping interval
      this.startPing();
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleMessage(msg);
      } catch (err) {
        this.emit('error', `Failed to parse message: ${err.message}`);
      }
    });

    this.ws.on('close', (code, reason) => {
      this.emit('disconnected', `Connection closed (code: ${code})`);
      this.cleanup();
      if (this.shouldRun) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      this.emit('error', `WebSocket error: ${err.message}`);
    });
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'new_work':
        this.handleNewWork(msg.payload);
        break;
      case 'share_accepted':
        this.acceptedShares++;
        this.emit('share_accepted', msg.payload);
        break;
      case 'pool_stats':
        this.emit('pool_stats', msg.payload);
        break;
      case 'network_block':
        this.emit('network_block', msg.payload);
        break;
      case 'pong':
        // Pong received, connection alive
        break;
      default:
        this.emit('unknown_message', msg);
    }
  }

  handleNewWork(payload) {
    this.currentJob = payload;
    this.emit('new_work', payload);

    // Stop existing workers
    this.stopWorkers();

    // Spawn workers with nonce range split
    const totalNonces = 0xFFFFFFFF; // 2^32 - 1
    const noncesPerWorker = Math.floor(totalNonces / this.threads);

    for (let i = 0; i < this.threads; i++) {
      const nonceStart = i * noncesPerWorker;
      const nonceEnd = (i === this.threads - 1) ? totalNonces : (i + 1) * noncesPerWorker;

      const worker = new Worker(path.join(__dirname, 'worker.js'));

      worker.on('message', (msg) => {
        if (msg.type === 'share_found') {
          this.handleShareFound(msg);
        } else if (msg.type === 'hashcount') {
          this.hashCount += msg.count;
        }
      });

      worker.on('error', (err) => {
        this.emit('error', `Worker error: ${err.message}`);
      });

      worker.postMessage({
        type: 'new_job',
        jobId: payload.jobId,
        prevHash: payload.prevHash,
        timestamp: payload.timestamp,
        difficulty: payload.difficulty,
        nonceStart,
        nonceEnd
      });

      this.workers.push(worker);
    }
  }

  handleShareFound(share) {
    this.totalShares++;
    this.emit('share_found', share);

    // Submit share to pool
    this.sendMessage('submit_share', {
      nonce: share.nonce,
      hash: share.hash,
      timestamp: Date.now(),
      jobId: share.jobId,
      difficulty: this.currentJob ? this.currentJob.difficulty : 1000000,
      sessionId: this.sessionId,
      deviceId: this.deviceId,
      minerId: this.minerId
    });
  }

  sendMessage(type, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.sendMessage('ping', {
        sessionId: this.sessionId,
        deviceId: this.deviceId,
        timestamp: Date.now()
      });
    }, 30000);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  stopWorkers() {
    for (const worker of this.workers) {
      try {
        worker.postMessage({ type: 'stop' });
        worker.terminate();
      } catch (e) {
        // Worker may already be terminated
      }
    }
    this.workers = [];
  }

  cleanup() {
    this.stopPing();
    this.stopWorkers();
  }

  scheduleReconnect() {
    if (!this.shouldRun) return;

    this.emit('status', `Reconnecting in ${this.reconnectDelay / 1000}s...`);
    setTimeout(async () => {
      if (!this.shouldRun) return;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      try {
        const tokenData = await this.fetchToken();
        this.connect(tokenData);
      } catch (err) {
        this.emit('error', `Reconnect failed: ${err.message}`);
        this.scheduleReconnect();
      }
    }, this.reconnectDelay);
  }

  getHashrate() {
    const now = Date.now();
    const elapsed = (now - this.lastHashTime) / 1000;
    const rate = elapsed > 0 ? this.hashCount / elapsed : 0;
    this.hashCount = 0;
    this.lastHashTime = now;
    return rate;
  }

  stop() {
    this.shouldRun = false;
    this.cleanup();
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // Ignore close errors
      }
      this.ws = null;
    }
  }
}

module.exports = { Miner };
