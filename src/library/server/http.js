const fs = require('fs');
const https = require('https');
const express = require('express');

const consts = require('@src/common/consts');
const config = require('@src/common/config');
const logger = require('@src/common/logger');
const Router = require('@src/library/router');

class Http {
  #engine = /** @type {express.Express} */ (null);
  #packet = /** @type {Router} */ (null);
  #option = /** @type {(Array|Object)} */ (null);
  #port = /** @type {number} */ (null);
  #session = null;
  #running = false;

  /**
   * @see the best way to put compression in place is to implement it at a reverse proxy level
   * @link https://expressjs.com/en/advanced/best-practice-performance.html#use-gzip-compression
   */
  constructor() {
    this.#engine = express();
    this.#engine.use(express.json()); // client send data with { Content-Type: "application/json", Body: "raw, JSON type" }
    this.#engine.use(express.urlencoded({ extended: true }));
  }

  isRunning() {
    return this.#running;
  }

  setPort(port) {
    if (this.#port == null) {
      this.#port = port;
    }
  }

  setOption(options = null) {
    if (this.#option == null) {
      this.#option = [
        // express.json(),
        // express.urlencoded({ extended: true }),
      ];

      if (options != null) {
        this.#option = this.#option.concat(Object.values(options));
      }
      if (this.#option != null && Object.keys(this.#option).length > 0) {
        this.#engine.use(this.#option);
      }
    }
  }

  setPacket(packet) {
    if (this.#packet == null) {
      this.#packet = packet;
    }
  }

  setSession(session) {
    this.#session = session;
  }

  start() {
    if (this.#running == false) {
      if (this.#session != null) {
        this.#engine.use(this.#session);
      }

      this.#packet.processForHttp(this.#engine);

      if (config.ssl.key != null && config.ssl.cert != null) {
        const options = {
          key: fs.readFileSync(config.ssl.key),
          cert: fs.readFileSync(config.ssl.cert),
        };

        https
          .createServer(options, this.#engine)
          .listen(this.#port)
          .on('error', (err) => {
            throw err;
          });
      } else {
        this.#engine.listen(this.#port).on('error', (err) => {
          throw err;
        });
      }

      this.#running = true;
    }
  }

  async destroy(signal) {}
}

module.exports = Http;
