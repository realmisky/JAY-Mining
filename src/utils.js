'use strict';

/**
 * Format a hashrate value into a human-readable string.
 */
function formatHashrate(hashesPerSecond) {
  if (hashesPerSecond >= 1000000) {
    return `${(hashesPerSecond / 1000000).toFixed(2)} MH/s`;
  } else if (hashesPerSecond >= 1000) {
    return `${(hashesPerSecond / 1000).toFixed(2)} KH/s`;
  }
  return `${hashesPerSecond.toFixed(2)} H/s`;
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
function formatTime(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000) % 60;
  const hours = Math.floor(ms / 3600000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

module.exports = {
  formatHashrate,
  formatTime
};
