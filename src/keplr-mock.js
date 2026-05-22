'use strict';

/**
 * Generates a self-contained JavaScript string that can be injected into a page
 * via page.evaluateOnNewDocument() to provide a mock window.keplr implementation.
 *
 * @param {Object} walletInfo - Wallet information derived from mnemonic
 * @param {string} walletInfo.address - Bech32 wallet address (yjay...)
 * @param {string} walletInfo.pubKey - Hex-encoded public key
 * @param {string} walletInfo.algo - Key algorithm (secp256k1)
 * @returns {string} JavaScript code to inject
 */
function createKeplrMockScript(walletInfo) {
  const pubKeyBase64 = Buffer.from(walletInfo.pubKey, 'hex').toString('base64');

  return `
    (function() {
      function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
          bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
      }

      const walletAddress = '${walletInfo.address}';
      const pubKeyHex = '${walletInfo.pubKey}';
      const pubKeyBase64 = '${pubKeyBase64}';
      const algo = '${walletInfo.algo}';
      const pubKeyBytes = hexToBytes(pubKeyHex);

      const offlineSigner = {
        getAccounts: async function() {
          return [{
            address: walletAddress,
            algo: algo,
            pubkey: pubKeyBytes
          }];
        },
        signAmino: async function(signerAddress, signDoc) {
          return {
            signed: signDoc,
            signature: {
              pub_key: { type: 'tendermint/PubKeySecp256k1', value: pubKeyBase64 },
              signature: ''
            }
          };
        },
        signDirect: async function(signerAddress, signDoc) {
          return {
            signed: signDoc,
            signature: {
              pub_key: { type: 'tendermint/PubKeySecp256k1', value: pubKeyBase64 },
              signature: ''
            }
          };
        }
      };

      window.keplr = {
        enable: async function(chainId) {
          return;
        },
        experimentalSuggestChain: async function(chainInfo) {
          return;
        },
        getKey: async function(chainId) {
          return {
            name: 'JAY Miner',
            algo: algo,
            pubKey: pubKeyBytes,
            address: new TextEncoder().encode(walletAddress),
            bech32Address: walletAddress,
            isNanoLedger: false,
            isKeystone: false
          };
        },
        getOfflineSigner: function(chainId) {
          return offlineSigner;
        },
        getOfflineSignerOnlyAmino: function(chainId) {
          return offlineSigner;
        },
        getOfflineSignerAuto: async function(chainId) {
          return offlineSigner;
        },
        signArbitrary: async function(chainId, signer, data) {
          return {
            pub_key: { type: 'tendermint/PubKeySecp256k1', value: pubKeyBase64 },
            signature: ''
          };
        },
        signAmino: async function(chainId, signer, signDoc) {
          return {
            signed: signDoc,
            signature: {
              pub_key: { type: 'tendermint/PubKeySecp256k1', value: pubKeyBase64 },
              signature: ''
            }
          };
        }
      };

      window.getOfflineSigner = function(chainId) { return window.keplr.getOfflineSigner(chainId); };
      window.getOfflineSignerOnlyAmino = function(chainId) { return window.keplr.getOfflineSigner(chainId); };
      window.getOfflineSignerAuto = function(chainId) { return window.keplr.getOfflineSigner(chainId); };
    })();
  `;
}

module.exports = { createKeplrMockScript };
