const types = require('@src/common/types');
const config = require('@src/common/config');
const logger = require('@src/common/logger');
const utils = require('@src/common/utils');

const InterfaceData = require('@src/library/data/idata');
const redislib = require('@src/library/cache/redis');

/**
 * Layer for NoSQL like systems
 *
 * @implements {InterfaceData}
 */
class Cache {
  constructor() {
    const vendor = config.cache.vendor;
    if (vendor == 'redis') {
      this.#instance = redislib;
    }
  }

  #instance = /** @type {InterfaceData} */ (null);

  /**
   * @param {string} label
   * @returns {Promise<void>}
   */
  async connection(label) {}

  /**
   * @param {types.QuerySet} args
   * @returns {Promise<Array<Object>>}
   */
  async rows(args) {
    return await this.#instance.rows(args);
  }

  /**
   * @param {types.QuerySet} args
   * @returns {Promise<(Object|null)>}
   */
  async row(args) {
    return await this.#instance.row(args);
  }

  /**
   * @param {Array<types.QuerySet>} args
   * @returns {Promise<Array<Object>>}
   */
  async execute(args) {
    return await this.#instance.execute(args);
  }

  /**
   * @param {any} signal
   * @returns {Promise<void>}
   */
  async destroy(signal) {
    await this.#instance.destroy(signal);
  }
}

module.exports = new Cache();
