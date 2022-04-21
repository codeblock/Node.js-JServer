const consts = require('@src/common/consts');
const config = require('@src/common/config');
const logger = require('@src/common/logger');

const Http = require('@src/library/server/http');
const Socket = require('@src/library/server/socket');

const db = require('@src/library/db');
const cache = require('@src/library/cache');

class Server {
  /**
   * @see config.json `config.ssl[key, cert]` property should be kept null and used for testing purposes or when unavoidable.
   * @see Otherwise use the proxy server or common load-balancing solutions for expired certificate renewal.
   * @see Or implement an expired certificate renewal on nodejs without restarting node server
   * @link https://socket.io/docs/v4/using-multiple-nodes/#enabling-sticky-session
   * @link https://github.com/nodejs/node/issues/15115
   */
  constructor(mode) {
    switch (mode) {
      case consts.SERVERTYPE.HTTP:
        this.#instance = new Http();
        break;
      case consts.SERVERTYPE.SOCKET:
        this.#instance = new Socket();
        break;
    }
  }

  #instance = /** @type {Http|Socket} */ (null);
  #port = /**@type {number} */ (null);

  isRunning() {
    return this.#instance.isRunning();
  }

  withSSL() {
    if (config.ssl.key != null && config.ssl.cert != null) {
      return true;
    }
    return false;
  }

  setPort(port) {
    this.#port = port;
    this.#instance.setPort(port);
    return this.#instance;
  }

  setOption(options = null) {
    this.#instance.setOption(options);
    return this.#instance;
  }

  setPacket(packet) {
    this.#instance.setPacket(packet);
    return this.#instance;
  }

  setSession(session) {
    this.#instance.setSession(session);
    return this.#instance;
  }

  start() {
    this.#instance.start();
    const withssl = this.withSSL() == true ? ' with SSL' : '';
    logger.info(consts.PREFIX.LOG_LIB + ' Server Started: ' + config.getName() + ' on port ' + this.#port + withssl);
  }

  /**
   * destroy instance Gracefully
   *
   * @param {any} signal
   * @returns {Promise<(Http|Socket)>}
   */
  async destroy(signal) {
    await this.#instance.destroy(signal);
    await cache.destroy(signal);
    await db.destroy(signal);
    return this.#instance;
  }
}

module.exports = Server;
