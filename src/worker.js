'use strict';

const { parentPort } = require('worker_threads');
const crypto = require('crypto');

let running = false;
let currentJobId = null;

function mine(job) {
  const { jobId, prevHash, timestamp, difficulty, nonceStart, nonceEnd } = job;

  // Compute target: 2^256 / difficulty
  const target = (BigInt(2) ** BigInt(256)) / BigInt(difficulty);

  running = true;
  currentJobId = jobId;

  let count = 0;
  const tsStr = timestamp.toString();

  for (let nonce = nonceStart; nonce < nonceEnd; nonce++) {
    if (!running || currentJobId !== jobId) {
      break;
    }

    const input = prevHash + jobId + nonce.toString() + tsStr;
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    count++;

    // Report hashcount every 10000 hashes
    if (count % 10000 === 0) {
      parentPort.postMessage({ type: 'hashcount', count: 10000 });
    }

    // Check if hash meets target
    const hashBigInt = BigInt('0x' + hash);
    if (hashBigInt < target) {
      parentPort.postMessage({
        type: 'share_found',
        nonce,
        hash,
        jobId
      });
    }
  }

  // Report remaining hashcount
  const remainder = count % 10000;
  if (remainder > 0) {
    parentPort.postMessage({ type: 'hashcount', count: remainder });
  }

  // Notify job finished
  if (running && currentJobId === jobId) {
    parentPort.postMessage({ type: 'job_done', jobId });
  }

  running = false;
}

// Only attach listener when running as a worker thread
if (parentPort) {
  parentPort.on('message', (msg) => {
    if (msg.type === 'new_job') {
      // Stop any current work and start new job
      running = false;
      currentJobId = null;
      setImmediate(() => mine(msg));
    } else if (msg.type === 'stop') {
      running = false;
      currentJobId = null;
    }
  });
}

module.exports = { mine };
