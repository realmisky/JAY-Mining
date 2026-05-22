'use strict';

const crypto = require('crypto');

function randomAlphanumeric(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

function generateSessionId() {
  return `session_${Date.now()}_${randomAlphanumeric(11)}`;
}

function generateDeviceId() {
  return `device_${Date.now()}_${randomAlphanumeric(11)}`;
}

function generateMinerId() {
  return crypto.randomBytes(8).toString('hex');
}

function formatHashrate(hashesPerSecond) {
  if (hashesPerSecond >= 1000000) {
    return `${(hashesPerSecond / 1000000).toFixed(2)} MH/s`;
  } else if (hashesPerSecond >= 1000) {
    return `${(hashesPerSecond / 1000).toFixed(2)} KH/s`;
  }
  return `${hashesPerSecond.toFixed(2)} H/s`;
}

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
  generateSessionId,
  generateDeviceId,
  generateMinerId,
  formatHashrate,
  formatTime
};
