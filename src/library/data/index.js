const util = require('util');

const errorslib = require('@src/library/errorslib.json');

const consts = require('@src/common/consts');
const types = require('@src/common/types');
// const config = require('@src/common/config');
const logger = require('@src/common/logger');
const utils = require('@src/common/utils');

const InterfaceData = require('@src/library/data/idata');
const lexer = require('@src/library/data/lexer');

const db = require('@src/library/db');
const cache = require('@src/library/cache');

/**
 * @implements {InterfaceData}
 */
class Data {
  constructor() {}

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
    let rtn = /** @type {Array<Object>} */ ([]);

    const for_cnt = Object.values(args.index);

    // counting container
    const counting_container_is = for_cnt.length == 1 && for_cnt[0] === null;

    let query = null;

    if (counting_container_is == true) {
      query = args.query;
      args.query = args.query.replace(/\s+WHERE\s+.+$/, '');
      args.query = args.query.replace(/^SELECT\s+(.+)\s+FROM\s/, 'SELECT COUNT(1) FROM ');
      if (Array.isArray(args.binds) == true) {
        args.binds.length = 0;
      }
      logger.debug(consts.PREFIX.LOG_LIB + ' query has been changed by types.LexSet.TYPES.SIMPLE_FOR_CNT: ' + query + ' > ' + args.query);
    }

    // 1. cache
    rtn = await cache.rows(args);

    if (rtn == null || utils.isEmptyArray(rtn) == true || utils.isNullArray(rtn) == true) {
      // 2. db
      rtn = await db.rows(args);

      // 3. cache load
      if (rtn != null && rtn[0] != null) {
        const querysets = /** @type {Array<types.QuerySet>} */ ([]);
        let queryset = null;
        let record = rtn[0];
        const table = lexer.getTable(args);
        const field = Object.keys(record);

        if (counting_container_is == true) {
          if (rtn.length > 1) {
            throw utils.raiseError(errorslib.SYS_UNDEFINED);
          }

          // Remove if the (aggregate) function parentheses. May be COUNT(?)
          for (let i = 0, i_len = field.length; i < i_len; i++) {
            field[i] = field[i].replace(consts.REGEXP.NEGATIVE_ALNUM_AND_UNDER, '_');
          }
          for (let k in rtn[0]) {
            if (consts.REGEXP.NEGATIVE_ALNUM_AND_UNDER.test(k) == true) {
              const k_ = k.replace(consts.REGEXP.NEGATIVE_ALNUM_AND_UNDER, '_');
              rtn[0][k_] = rtn[0][k];
              delete rtn[0][k];
            }
          }
        }

        for (let i = 0, i_len = rtn.length; i < i_len; i++) {
          queryset = new types.QuerySet(args);
          record = rtn[i];
          query = 'INSERT INTO %s (%s) VALUES (%s)';
          queryset.query = util.format(query, table, field.toString(), field.map((x) => ':'.concat(x)).toString());
          queryset.binds = Object.assign({}, record); // NamedObject {} > {}

          if (counting_container_is == true) {
            queryset.count = true;
          }

          querysets.push(queryset);
        }

        let exec = null;
        try {
          exec = await cache.execute(querysets);
          logger.debug('read from DB and write to Cache: ' + JSON.stringify(exec));
        } catch (err) {
          logger.error(err);
          throw err;
        }
      }
    }

    return rtn;
  }

  /**
   * @param {types.QuerySet} args
   * @returns {Promise<(Object|null)>}
   */
  async row(args) {
    let rtn = null;
    const rs = await this.rows(args);

    if (rs != null && rs[0] != null) {
      rtn = rs[0];
    }

    return rtn;
  }

  /**
   * @param {Array<types.QuerySet>} args
   * @returns {Promise<Array<Object>>}
   */
  async execute(args) {
    let rtn = /** @type {Array<Object>} */ ([]);

    const exec_db = await db.execute(args);
    const exec_cache = await cache.execute(args);

    rtn.push(exec_db);
    rtn.push(exec_cache);

    return rtn;
  }

  /**
   * @param {any} signal
   * @returns {Promise<void>}
   */
  async destroy(signal) {}
}

module.exports = Data;
