'use strict';

const { parentPort } = require('worker_threads');
const crypto = require('crypto');

let running = false;
let currentJobId = null;

const BATCH_SIZE = 50000;

function mine(job) {
  const { jobId, prevHash, timestamp, difficulty, nonceStart, nonceEnd } = job;

  // Compute target: 2^256 / difficulty
  const target = (BigInt(2) ** BigInt(256)) / BigInt(difficulty);

  running = true;
  currentJobId = jobId;

  const tsStr = timestamp.toString();
  let nonce = nonceStart;

  function mineBatch() {
    if (!running || currentJobId !== jobId) {
      return;
    }

    const batchEnd = Math.min(nonce + BATCH_SIZE, nonceEnd);
    let batchCount = 0;

    for (; nonce < batchEnd; nonce++) {
      if (!running || currentJobId !== jobId) {
        // Report partial batch hashcount
        if (batchCount > 0) {
          parentPort.postMessage({ type: 'hashcount', count: batchCount });
        }
        return;
      }

      const input = prevHash + jobId + nonce.toString() + tsStr;
      const hash = crypto.createHash('sha256').update(input).digest('hex');
      batchCount++;

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

    // Report hashcount for this batch
    if (batchCount > 0) {
      parentPort.postMessage({ type: 'hashcount', count: batchCount });
    }

    // If more nonces remain, yield to event loop then continue
    if (nonce < nonceEnd && running && currentJobId === jobId) {
      setImmediate(mineBatch);
    } else if (running && currentJobId === jobId) {
      // All nonces exhausted
      parentPort.postMessage({ type: 'job_done', jobId });
      running = false;
    }
  }

  mineBatch();
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
