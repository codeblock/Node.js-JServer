const types = require('@src/common/types');

/**
 * @interface
 */
class InterfaceData {
  constructor() {}

  /**
   * pick a connection in internal(private) connections container
   *
   * @abstract
   * @param {string} label
   * @returns {Promise<Object>}
   */
  async connection(label) {
    return {};
  }

  /**
   * (read) select multiple rows
   *
   * @abstract
   * @param {types.QuerySet} args
   * @returns {Promise<Array<Object>>}
   */
  async rows(args) {
    return [{}];
  }

  /**
   * (read) select first row
   *
   * @abstract
   * @param {types.QuerySet} args
   * @returns {Promise<Object>}
   */
  async row(args) {
    return {};
  }

  /**
   * (write) insert / update / delete
   *
   * @abstract
   * @param {Array<types.QuerySet>} args
   * @returns {Promise<any>}
   */
  async execute(args) {}

  /**
   * destroy instance Gracefully
   *
   * @abstract
   * @param {any} signal
   * @returns {Promise<void>}
   */
  async destroy(signal) {}
}

module.exports = InterfaceData;
