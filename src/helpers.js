var defaultDistKey = "";
var latestRound = -1;

// fetchLatest fetches the latest randomness from the node described by identity
function fetchLatest(identity) {
  var fullPath = identity.Address + "/api/public";
  if (identity.TLS == false) {
    fullPath = "http://" + fullPath;
  } else  {
    fullPath = "https://" + fullPath;
  }
  return fetch(fullPath).then(resp => Promise.resolve(resp.json()));
}

// fetchRound fetches the randomness at given round
function fetchRound(identity, round) {
  var fullPath = identity.Address + "/api/public/" + round;
  if (identity.TLS == false) {
    fullPath = "http://" + fullPath;
  } else  {
    fullPath = "https://" + fullPath;
  }
  return fetch(fullPath).then(resp => Promise.resolve(resp.json()));
}

// fetchKey fetches the public key
function fetchKey(identity) {
  var fullPath = identity.Address + "/api/info/distkey";
  if (identity.TLS == false) {
    fullPath = "http://" + fullPath;
  } else  {
    fullPath = "https://" + fullPath;
  }
  return fetch(fullPath).then(resp => Promise.resolve(resp.json()));
}

// fetchGroup fetches the group file
function fetchGroup(identity) {
  var fullPath = identity.Address + "/api/info/group";
  if (identity.TLS == false) {
    fullPath = "http://" + fullPath;
  } else  {
    fullPath = "https://" + fullPath;
  }
  return fetch(fullPath).then(resp => Promise.resolve(resp.json()));
}

// hexToBytes converts hex string to bytes array
function hexToBytes(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

// int64ToBytes converts int to bytes array
function int64ToBytes(int) {
    var bytes = [];
    var i = 8;
    do {
    bytes[--i] = int & (255);
    int = int>>8;
    } while ( i )
    return bytes;
}

// length of the message to pass to verification routine
const LENGTH_MSG = 32; 

// sha256 function used to hash input to bls verify / sign
let sha256;
if (typeof window == "object" && "crypto" in window) {
    sha256 = async (message) => {
        const buffer = await window.crypto.subtle.digest("SHA-256", message.buffer);
        return new Uint8Array(buffer);
    };
}
else if (typeof process === "object" && ("node" in process.versions || process.browser)) {
    const { createHash } = require("crypto");
    sha256 = async (message) => {
        const hash = createHash("sha256");
        hash.update(message);
        return Uint8Array.from(hash.digest());
    };
}
else {
    throw new Error("The environment doesn't have sha256 function");
}

// message returns the message to verify / signed by drand nodes given the round
// number and the previous hashed randomness.
async function message(prev, round) {
    const message = new Uint8Array(LENGTH_MSG);
    const bprev = hexToBytes(prev);
    const bround = int64ToBytes(round);
    message.set(bround);
    message.set(bprev, bround.length);
    return sha256(message);
}

// verifyDrand formats previous and round into the signed message, verifies the
// signature against the distributed key and checks that the randomness hash
// matches
async function verifyDrand(previous, signature, randomness, round, distkey) {
  try {
    var msg = message(previous, round);
    var p = new kyber.pairing.point.BN256G2Point();
    p.unmarshalBinary(hexToBytes(distkey));
    var sig = hexToBytes(signature);
    var ver_sig = kyber.sign.bls.verify(msg, p, sig);
    var ver_rand = false;
    await sha512(new Uint8Array(sig)).then(freshRand => {
      if (freshRand === randomness) {
        ver_rand = true;
      }
    });
    return ver_rand && ver_sig;
  } catch (e) {
    console.error('Could not verify:', e);
    return false;
  }
}

function sha512(str) {
  return crypto.subtle.digest("SHA-512", str).then(buf => {
    return Array.prototype.map.call(new Uint8Array(buf), x=>(('00'+x.toString(16)).slice(-2))).join('');
  });
}

module.exports.message = message;