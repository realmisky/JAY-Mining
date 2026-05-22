'use strict';

const { Secp256k1HdWallet } = require('@cosmjs/amino');

const HD_PATH = "m/44'/118'/0'/0/0";
const BECH32_PREFIX = 'yjay';

/**
 * Derive wallet address and keys from a mnemonic phrase.
 * Uses BIP44 coin type 118 with "yjay" bech32 prefix.
 */
async function deriveWallet(mnemonic) {
  const wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic.trim(), {
    prefix: BECH32_PREFIX,
    hdPaths: [stringToHdPath(HD_PATH)]
  });
  const [account] = await wallet.getAccounts();
  return {
    address: account.address,
    pubKey: Buffer.from(account.pubkey).toString('hex'),
    algo: account.algo
  };
}

/**
 * Convert an HD path string to the format expected by cosmjs.
 */
function stringToHdPath(path) {
  const { stringToPath } = require('@cosmjs/crypto');
  return stringToPath(path);
}

module.exports = { deriveWallet };
