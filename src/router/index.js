const { Server, Socket } = require('socket.io');

const logger = require('@src/common/logger');
const utils = require('@src/common/utils');
const times = require('@src/common/times');

const Router = require('@src/library/router');
const RouterApi = require('@src/router/api');
const RouterGame = require('@src/router/game');

/**
 * @typedef {function(Server, any): void} CallbackForS2S
 */

class IndexRouter {
  /**
   * @see When service launched. S2S(Server to Server) packet names will be concatenated with `config.prefixSocketPacket.s2s` prefix. Verify the Server.sockets.events
   */
  constructor(mode) {
    if (mode == 'api') {
      this.#router = new RouterApi();
    } else if (mode == 'game') {
      this.#router = new RouterGame();
    }

    Object.assign(this.#router.packetS2S, {
      synctime: /** @type {CallbackForS2S} */ async (server, data) => {
        times.sync(data.tsmilli, data.offset);
      },
      setSecondsPerDay: /** @type {CallbackForS2S} */ async (server, data) => {
        times.setSecondsPerDay(data);
      },
      // reloadBundleData: /** @type {CallbackForS2S} */ async (server, data) => {
      //   // ...
      // },
      // reloadTableData: /** @type {CallbackForS2S} */ async (server, data) => {
      //   // ...
      // },
    });
  }

  #router = /** @type {Router} */ (null);

  /**
   *
   * @returns {Router}
   */
  getRouter() {
    return this.#router;
  }
}

module.exports = IndexRouter;
