const BufferList        = require('bl/BufferList');
const VersionDowngrader = require('./version');
const StringDowngrader  = require('./string');
const CRGBDowngrader    = require('./crgb');
const MtxmDowngrader    = require('./mtxm');
const { Version }       = require('../common');
const { uint32 }        = require('../../util/alloc');

/**
 * Runs all applicable chunk downgraders against a parsed CHK chunk list
 * and reassembles the output buffer.
 */
class Orchestrate {
  constructor(chunks, opts) {
    this.chunks = Object.freeze(chunks);

    const versionDowngrader = new VersionDowngrader();
    this.downgraders = [
      versionDowngrader,
      new StringDowngrader(),
      new CRGBDowngrader(),
    ];

    if (opts.mtxm) {
      this.downgraders.push(new MtxmDowngrader(this._getChunk.bind(this)));
    }

    const version = versionDowngrader.read(this._getChunk(versionDowngrader.chunkName)[1]);
    this.isSCR = version === Version.SCR || version === Version.BroodwarRemastered;
  }

  _getChunk(chunkName) {
    return this.chunks.find(([name]) => name === chunkName);
  }

  downgrade() {
    const omit = [];
    const add  = [];

    for (const downgrader of this.downgraders) {
      console.log(`Downgrading ${downgrader.chunkName}`);
      const chunk = this._getChunk(downgrader.chunkName);

      if (!chunk) continue;

      omit.push(downgrader.chunkName);
      const newChunk = downgrader.downgrade(chunk[1]);

      if (newChunk) {
        omit.push(newChunk[0]); // also drop any existing chunk with the new name
        add.push(newChunk);
      }
    }

    const outChunks = [
      ...this.chunks.filter(([name]) => !omit.includes(name)),
      ...add,
    ];

    const out = new BufferList();
    for (const [name, buffer] of outChunks) {
      out.append(Buffer.from(name));
      out.append(uint32(buffer.length));
      out.append(buffer);
    }

    return out.slice(0);
  }
}

module.exports = Orchestrate;
