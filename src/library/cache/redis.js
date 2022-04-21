const redis = require('redis');

const errorslib = require('@src/library/errorslib.json');

const consts = require('@src/common/consts');
const types = require('@src/common/types');
const config = require('@src/common/config');
const logger = require('@src/common/logger');
const utils = require('@src/common/utils');

const InterfaceData = require('@src/library/data/idata');
const lexer = require('@src/library/data/lexer');

class RedisCommand {
  constructor() {
    this.arg = [];
  }
  cmd /** @type {string} */;
  key /** @type {string} */;
  arg /** @type {Array<string>} */;
}

/**
 * @implements {InterfaceData}
 */
class Redis {
  static get KEY_JOINER() {
    return ':';
  }

  constructor() {}

  #connections = /** @type {Object<string, Array<redis.RedisClientType<Object, redis.RedisScripts>>>} */ ({});

  // /**
  //  *
  //  * @param {string} keyname
  //  * @returns {RegExp}
  //  */
  // regexpForValueByNameFromQuery(keyname) {
  //   return new RegExp(keyname + '\\s*?[!=]=\\s*[\'"]?([^\'"]+)');
  // }

  /**
   *
   * @param {Object} conf
   * @returns {Promise<redis.RedisClientType<Object, redis.RedisScripts>>}
   */
  async #setConf(conf) {
    // https://github.com/redis/node-redis/blob/master/docs/client-configuration.md
    const configobj = {
      socket: {
        host: conf.host,
        port: conf.port,
      },
      username: conf.user,
      password: conf.pass,
      database: conf.dbnm,
    };

    // legacyMode, readonly, ...
    if (Array.isArray(conf.mode) == true) {
      for (let i = 0, i_len = conf.mode.length; i < i_len; i++) {
        const k = conf.mode[i];
        configobj[k] = true;
      }
    }

    const rtn = redis.createClient(configobj);

    const flagstr = JSON.stringify(configobj);
    rtn.on('error', (err) => logger.error(err)); // prevent termination by "Unhandled 'error' event"
    rtn.on('connect', () => logger.debug(consts.PREFIX.LOG_LIB + ' Redis connect: ' + flagstr));
    rtn.on('ready', () => logger.debug(consts.PREFIX.LOG_LIB + ' Redis ready: ' + flagstr));
    rtn.on('reconnecting', () => logger.warn(consts.PREFIX.LOG_LIB + ' Redis reconnecting: ' + flagstr));

    // await rtn.connect();
    rtn.connect().catch(console.error);

    return rtn;
  }

  // /**
  //  *
  //  * @param {string} key
  //  * @returns {string}
  //  */
  // #getCommandKeyPrefix(key) {
  //   return key.split(Redis.KEY_JOINER)[0];
  // }

  /**
   *
   * @param {Array<types.QuerySet>} querysets
   * @param {Array<types.LexSet>} lexsets
   * @returns {Promise<Array<RedisCommand>>}
   */
  async #makeCommands(querysets, lexsets) {
    const rtn = /** @type {Array<RedisCommand>} */ ([]);

    if (querysets.length != lexsets.length) {
      return;
    }

    let command = /** @type {RedisCommand} */ (null);

    const bucket = {};

    for (let i = 0, i_len = querysets.length; i < i_len; i++) {
      // QuerySet.index length must be greater than 0
      if (querysets[i].index == null || utils.getType(querysets[i].index) != 'object' || Object.keys(querysets[i].index).length == 0) {
        logger.error("index doesn't exists");
        continue;
      }

      // if (querysets[i].count == true && lexsets[i].types == types.LexSet.TYPES.SIMPLE_FOR_CNT) {
      //   if (querysets[i].query.startsWith('INSERT') == true) {
      //     command = new RedisCommand();
      //     command.cmd = 'INCRBY';
      //     command.key = lexsets[i].table;
      //     command.arg = ['1'];

      //     rtn.push(command);
      //     continue;
      //   }
      // }

      if (querysets[i].query.startsWith('SELECT') == true) {
        command = this.#makeCommandBySelect(querysets[i], lexsets[i]);
      } else if (querysets[i].query.startsWith('INSERT') == true) {
        command = await this.#makeCommandByInsert(querysets[i], lexsets[i], bucket);
      } else if (querysets[i].query.startsWith('UPDATE') == true) {
        command = await this.#makeCommandByUpdate(querysets[i], lexsets[i], bucket);
      } else if (querysets[i].query.startsWith('DELETE') == true) {
        command = this.#makeCommandByDelete(querysets[i], lexsets[i]);
      }

      if (querysets[i].count == true && lexsets[i].types == types.LexSet.TYPES.SIMPLE_FOR_CNT) {
        if (querysets[i].query.startsWith('INSERT') == true) {
          command.cmd = 'INCRBY';
          // command.key = lexsets[i].table;
          command.arg = command.arg.pop();
        }
      }

      rtn.push(command);

      if (querysets[i].count == true && lexsets[i].types == types.LexSet.TYPES.SIMPLE_FOR_ONE) {
        // upsert (INSERT INTO ... ON DUPLICATE KEY UPDATE) be changed only to INSERT when New Data
        if (querysets[i].query.startsWith('INSERT') == true) {
          const command_opt = new RedisCommand();
          command_opt.cmd = 'INCRBY';
          command_opt.key = lexsets[i].table;
          command_opt.arg = ['1'];

          rtn.push(command_opt);
        } else if (querysets[i].query.startsWith('DELETE') == true) {
          const command_opt = new RedisCommand();
          command_opt.cmd = 'INCRBY';
          command_opt.key = lexsets[i].table;
          command_opt.arg = ['-1'];

          rtn.push(command_opt);
        }
      }
    }

    return rtn;
  }

  /**
   *
   * @param {types.QuerySet} queryset
   * @param {types.LexSet} lexset
   * @returns {RedisCommand} set the RedisCommand.key only
   */
  #makeCommandKey(queryset, lexset) {
    const command = new RedisCommand();

    const suffix = [];

    // 202203020545
    for (let k in queryset.index) {
      const tp = typeof queryset.index[k];
      if (tp == 'string' || tp == 'number') {
        suffix.push(queryset.index[k]);
      }
    }
    if (suffix.length > 0) {
      command.key = lexset.table.concat(Redis.KEY_JOINER).concat(suffix.join(Redis.KEY_JOINER));
    } else {
      command.key = lexset.table;
    }

    return command;
  }

  /**
   *
   * @param {types.QuerySet} queryset
   * @param {types.LexSet} lexset
   * @returns {RedisCommand}
   */
  #makeCommandBySelect(queryset, lexset) {
    const command = this.#makeCommandKey(queryset, lexset);

    let keyname = null;
    let keyvals = null;

    switch (lexset.types) {
      case types.LexSet.TYPES.SIMPLE_FOR_CNT:
        command.cmd = 'GET';
        command.arg = null;
        // keyname = lexset.index[0];
        // if (lexset.where != null) {
        //   keyvals = lexset.where.match(this.regexpForValueByNameFromQuery('([^\\s=]+)'));
        // }
        // if (keyvals != null) {
        //   command.arg = keyvals[2];
        // }
        break;
      case types.LexSet.TYPES.SIMPLE_FOR_ONE:
        command.cmd = 'HGETALL';
        command.arg = null;
        break;
      case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ALL:
        command.cmd = 'HGETALL'; // need json parse
        command.arg = null;
        break;
      case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ONE:
        command.cmd = 'HGET'; // need json parse
        keyname = lexset.index[lexset.index.length - 1];
        command.arg = Object.values(queryset.index[keyname]);
        break;
      case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_SOME:
        command.cmd = 'HMGET'; // need json parse
        keyname = lexset.index[lexset.index.length - 1];
        command.arg = Object.values(queryset.index[keyname]);
        break;
    }

    return command;
  }

  /**
   *
   * @param {types.QuerySet} queryset
   * @param {types.LexSet} lexset
   * @param {Object} bucket temporary container for upsert
   * @returns {Promise<RedisCommand>}
   */
  async #makeCommandByInsert(queryset, lexset, bucket) {
    const command = this.#makeCommandKey(queryset, lexset);

    let stmt = queryset.query;

    /**
     * @see UPSERT : experimental. MySQL/MariaDB support only (not yet : Oracle, MS-SQL, ... other DBMS Query)
     */
    // ON DUPLICATE KEY UPDATE > if exists > update
    const upsert_strs = ' ON DUPLICATE KEY UPDATE ';
    const upsert_flag = queryset.query.indexOf(upsert_strs);
    if (config.db.vendor == 'mysql' && upsert_flag > 0) {
      const queryset_query = queryset.query; // backup for update failure

      // if (valueAsis != null) {
      const wheres = [];

      // 202203020545
      for (let k in queryset.index) {
        let where = '';
        const tp = utils.getType(queryset.index[k]);
        if (tp == 'string') {
          where = where.concat(k).concat('=').concat("'").concat(queryset.index[k]).concat("'");
        } else if (tp == 'number') {
          where = where.concat(k).concat('=').concat(queryset.index[k]);
        } else if (tp == 'array') {
          let conds = queryset.index[k].map((arg) => {
            if (typeof arg == 'string') {
              return "'".concat(arg).concat("'");
            }
            return arg;
          });
          where = where.concat(k).concat(' IN (').concat(conds.join(',')).concat(')');
        }
        wheres.push(where);
      }

      stmt = stmt.substring(upsert_flag + upsert_strs.length);
      stmt = 'UPDATE ' + lexset.table + ' SET ' + stmt + ' WHERE ' + wheres.join(' AND ');
      // logger.debug('insert > update : ' + queryset.query + ' > ' + stmt);
      queryset.query = stmt;

      const lexset_tmp = lexer.process(queryset);
      const command_tmp = await this.#makeCommandByUpdate(queryset, lexset_tmp, bucket);
      // }

      if (command_tmp.cmd != null && command_tmp.arg != null) {
        lexset = lexset_tmp;
        return command_tmp;
      } else {
        stmt = queryset_query.substring(0, upsert_flag);
        // queryset.query = stmt;
        queryset.query = queryset_query; // restore from backup for update failure
      }
    }

    const matches = stmt.match(/INSERT INTO .+ \(([^)]+)\) VALUES \(([^)]+)\)/);
    if (matches == null || matches.length != 3) {
      logger.error('Error Occured : requirements not enough');

      return command; // null ?
    }

    // matches[2] = '[' + matches[2].replace(/'/g, '"').replace(/NULL/gi, '"null"') + ']';
    // matches[2] = '[' + matches[2].replace(/'/g, '"').replace(/NULL/gi, '""') + ']';
    matches[2] = '[' + matches[2].replace(/'/g, '"').replace(/NULL/gi, consts.VALUE.NULLSTRING) + ']';

    const valuesTobe = {
      k: matches[1].replace(/\s+/g, '').split(','),
      // v: matches[2].replace(/\\+/g, '\\').split(/,[^\\]/),
      // v: matches[2].split(/,[^\\]/),
      v: JSON.parse(matches[2]),
    };

    const queryset_index_vals = Object.values(queryset.index);
    const queryset_index_lastval = queryset_index_vals[queryset_index_vals.length - 1];
    if (Array.isArray(queryset_index_lastval) == true && queryset_index_lastval.length > 0) {
      const valuesTobe_v = utils.objectCombine(valuesTobe.k, valuesTobe.v);
      valuesTobe.v = JSON.stringify(valuesTobe_v);
      valuesTobe.k = queryset_index_lastval.join(Redis.KEY_JOINER);
      command.arg.push(valuesTobe.k);
      command.arg.push(valuesTobe.v);
    } else {
      for (let k in valuesTobe['v']) {
        if (valuesTobe['v'][k] == null) {
          valuesTobe['v'][k] = consts.VALUE.NULLSTRING;
        } else if (valuesTobe['v'][k] !== '' && isNaN(valuesTobe['v'][k]) == false) {
          valuesTobe['v'][k] = utils.toNumberOnly(valuesTobe['v'][k]);
        } else {
          valuesTobe['v'][k] = valuesTobe['v'][k].replace(/(?:^['"]|['"]$)/g, '');
        }
      }
      // logger.debug('xxxxxxxxxxxxxxxxx valuesTobe : ' + JSON.stringify(valuesTobe));

      if (valuesTobe.k.length != valuesTobe.v.length) {
        logger.error('Error Occured : length missmatch on insert');

        return command; // null ?
      }

      const paramvalue = {};
      for (let j = 0, j_len = valuesTobe.k.length; j < j_len; j++) {
        const k = valuesTobe.k[j];
        const v = valuesTobe.v[j];

        if (utils.getType(v) == 'string' && (v.startsWith('{') == true || v.startsWith('[') == true)) {
          // paramvalue[k] = v.replace(/\\/g, '');
          paramvalue[k] = JSON.parse(v.replace(/\\/g, ''));
        } else {
          paramvalue[k] = v;
        }
        command.arg.push(k, paramvalue[k]);
      }
    }
    // logger.debug('[' + this.KEY + '.' + __function + ':' + __line + '] param.value : ' + JSON.stringify(param.value));

    command.cmd = 'HSET';

    return command;
  }

  /**
   *
   * @param {types.QuerySet} queryset
   * @param {types.LexSet} lexset
   * @param {Object} bucket temporary container
   * @returns {Promise<RedisCommand>}
   */
  async #makeCommandByUpdate(queryset, lexset, bucket) {
    const command = this.#makeCommandKey(queryset, lexset);

    const conns = await this.connection(queryset.label);
    const conn = conns[0];

    let keyname = null;
    let keyvals = null;

    let valueAsis = null;
    let valueTobe = null;

    switch (lexset.types) {
      // case types.LexSet.TYPES.SIMPLE_FOR_CNT:
      //   keyname = lexset.index[0];
      //   keyvals = lexset.where.match(this.regexpForValueByNameFromQuery(keyname));
      //   if (keyvals != null) {
      //     keyvals = keyvals[1];
      //   }
      //   break;
      case types.LexSet.TYPES.SIMPLE_FOR_ONE:
        break;
      case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ONE:
        keyname = lexset.index[lexset.index.length - 1];
        keyvals = Object.values(queryset.index[keyname]);
        break;
      case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_SOME:
        keyname = lexset.index[lexset.index.length - 1];
        keyvals = Object.values(queryset.index[keyname]);
        break;
      case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ALL:
        break;
    }

    // bucket_k = ${label} : ${key} : String(${lexset.types}) : ${keyvals}.sort().toString()
    let bucket_k = queryset.label.concat(Redis.KEY_JOINER).concat(command.key).concat(Redis.KEY_JOINER).concat(String(lexset.types)).concat(Redis.KEY_JOINER);
    if (Array.isArray(keyvals) == true) {
      const bucket_k_arrstr = keyvals.sort((a, b) => a - b).toString();
      bucket_k = bucket_k.concat(bucket_k_arrstr);
    } else {
      bucket_k = bucket_k.concat(String(keyvals));
    }
    valueAsis = bucket[bucket_k];

    if (valueAsis == null) {
      switch (lexset.types) {
        // case types.LexSet.TYPES.SIMPLE_FOR_CNT:
        //   if (keyvals != null) {
        //     valueAsis = await this.#callCommandBeforeUpdate(conn, 'HGET', command.key, keyvals);
        //   }
        //   if (valueAsis != null) {
        //     valueAsis = [valueAsis];
        //   }
        //   break;
        case types.LexSet.TYPES.SIMPLE_FOR_ONE:
          valueAsis = await this.#callCommandBeforeUpdate(conn, 'HGETALL', command.key);
          break;
        case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ONE:
          valueAsis = await this.#callCommandBeforeUpdate(conn, 'HGET', command.key, keyvals);
          if (valueAsis != null) {
            valueAsis = [valueAsis];
          }
          break;
        case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_SOME:
          valueAsis = await this.#callCommandBeforeUpdate(conn, 'HMGET', command.key, keyvals);
          break;
        case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ALL:
          valueAsis = await this.#callCommandBeforeUpdate(conn, 'HGETALL', command.key);
          if (valueAsis != null) {
            valueAsis = Object.values(valueAsis);
          }
          break;
      }

      if (valueAsis == null || utils.isEmptyObject(valueAsis) == true || utils.isNullArray(valueAsis) == true) {
        valueAsis = null;
      } else {
        if (lexset.types == types.LexSet.TYPES.SIMPLE_FOR_ONE) {
          for (let k in valueAsis) {
            if (valueAsis[k] === consts.VALUE.NULLSTRING) {
              valueAsis[k] = null;
            } else if (valueAsis[k] !== '' && isNaN(valueAsis[k]) == false) {
              valueAsis[k] = utils.toNumberOnly(valueAsis[k]);
            }
          }
          valueAsis = [valueAsis];
        } else if (lexset.types >= types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ONE) {
          for (let i = 0, i_len = valueAsis.length; i < i_len; i++) {
            valueAsis[i] = JSON.parse(valueAsis[i]);
          }
          valueAsis = lexer.filter(lexset, valueAsis);
        }

        bucket[bucket_k] = valueAsis;
      }
    }

    if (valueAsis == null) {
      logger.debug('Warning : nothing to update cache (OR upsert by insert)');

      return command; // null ?
    }

    const matches = queryset.query.match(/UPDATE .*?SET (.+) WHERE /);
    if (matches != null && matches.length == 2) {
      let valueWraps = matches[1];
      //valueWraps = valueWraps.replace(/([^=\s]+)\s*?=\s*/g, '"$1":'); // @todo performance for greedy quantifier > lazy
      valueWraps = valueWraps.replace(/([^=\s]+)\s*?=\s*/g, '"$1":');
      valueWraps = valueWraps.replace(/":\s*?([^(?:\}\]),$]+)/g, function () {
        // logger.debug('xxxxxxxxxxxx[' + arguments[1] + ']');
        if (isNaN(arguments[1]) == true && arguments[1].startsWith('"') == false && arguments[1].startsWith("'") == false) {
          return '":"' + arguments[1].trimEnd() + '"';
        } else {
          return '":' + arguments[1];
        }
      });
      // valueWraps = valueWraps.replace(/'/g, '"').replace(/NULL/gi, consts.VALUE.NULLSTRING);
      valueWraps = valueWraps.replace(/'/g, '"').replace(/"NULL"/gi, consts.VALUE.NULLSTRING);
      valueWraps = valueWraps.replace(/\\/g, '');
      valueWraps = valueWraps.replace(/"([\{\[].*?[\]\}])"/g, '$1');
      valueWraps = '{' + valueWraps + '}';
      // logger.debug(valueWraps);
      valueTobe = JSON.parse(valueWraps);
    }

    let modified_count = 0;
    let param_asis = null;
    let param_tobe = null;
    for (let i = 0, i_len = valueAsis.length; i < i_len; i++) {
      // logger.log(JSON.stringify(valueAsis[i]));
      param_asis = { ...valueAsis[i] };
      if (lexset.types >= types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ONE) {
        utils.objectMergeIntersect(param_asis, valueTobe);
        // modified and before values (for JSON string value)
        keyname = lexset.index[lexset.index.length - 1];
        keyname = param_asis[keyname];
        param_tobe = { [keyname]: JSON.stringify(param_asis) };
      } else {
        // modified only
        param_tobe = utils.objectMergeIntersect(param_asis, valueTobe);
      }

      if (param_tobe != null) {
        valueAsis[i] = { ...param_asis }; // update bucket[bucket_k] by reference
        param_tobe = utils.objectSpreadToArray(param_tobe);
        command.arg = command.arg.concat(param_tobe);
        modified_count++;
      }
    }

    if (modified_count > 0) {
      command.cmd = 'HSET';
    } else {
      logger.warn('Perhaps keys are mismatch from each others');
    }

    return command;
  }

  /**
   *
   * @param {types.QuerySet} queryset
   * @param {types.LexSet} lexset
   * @returns {RedisCommand}
   */
  #makeCommandByDelete(queryset, lexset) {
    const command = this.#makeCommandKey(queryset, lexset);

    let keyname = null;
    let keyvals = null;

    switch (lexset.types) {
      // case types.LexSet.TYPES.SIMPLE_FOR_CNT:
      //   command.cmd = 'HDEL';
      //   keyname = lexset.index[0];
      //   keyvals = lexset.where.match(this.regexpForValueByNameFromQuery(keyname));
      //   if (keyvals != null) {
      //     command.arg = keyvals[1];
      //   } else {
      //     command.cmd = null; // error
      //   }
      //   break;
      case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ONE:
      case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_SOME:
        command.cmd = 'HDEL';
        keyname = lexset.index[lexset.index.length - 1];
        keyvals = Object.values(queryset.index[keyname]);
        command.arg = keyvals;
        break;
      default:
        command.cmd = 'DEL';
    }

    return command;
  }

  /**
   *
   * @param {Array<types.QuerySet>} querysets for connection label
   * @param {Array<RedisCommand>} commands
   * @param {Array<types.LexSet>} lexsets
   * @returns {Promise<Array<Object>>}
   */
  async #callCommandForRead(querysets, commands, lexsets) {
    let rtn = /** @type {Array<Object>} */ ([]);

    const ready = this.#callCommandReady(querysets, commands, lexsets);

    // const cmdopts = redis.commandOptions({
    //   returnBuffers: true,
    // });

    let conns = null;
    let conn = null;
    let reply = null;
    let command = /** @type {RedisCommand} */ (null);
    let lexset = /** @type {types.LexSet} */ (null);

    for (let label in ready.querysets) {
      conns = await this.connection(label);
      conn = conns[0];
      // label start
      for (let i = 0, i_len = ready.commands[label].length; i < i_len; i++) {
        command = ready.commands[label][i];
        lexset = ready.lexsets[label][i];

        // reply = await conn[command.cmd](cmdopts, command.key, command.arg);
        reply = await conn[command.cmd](command.key, command.arg);
        if (config.cache.verbose == true) {
          logger.debug('[' + this.constructor.name + '] ' + command.cmd + ' ' + command.key + ' ' + JSON.stringify(command.arg));
        }

        if (reply == null || utils.isEmptyObject(reply) == true || utils.isNullArray(reply) == true) {
          reply = null;
        } else {
          switch (lexset.types) {
            case types.LexSet.TYPES.SIMPLE_FOR_CNT: // GET
              reply = utils.toNumberOnly(reply);
              const reply_obj = {};
              let field_origin = null;
              for (let j = 0, j_len = lexset.field.length; j < j_len; j++) {
                field_origin = lexset.field[j].split(consts.REGEXP.FIELD_ALIAS);
                reply_obj[field_origin[0]] = reply;
              }
              reply = [reply_obj];
              break;
            case types.LexSet.TYPES.SIMPLE_FOR_ONE:
              for (let k in reply) {
                if (reply[k] === consts.VALUE.NULLSTRING) {
                  reply[k] = null;
                } else if (reply[k] !== '' && isNaN(reply[k]) == false) {
                  reply[k] = utils.toNumberOnly(reply[k]);
                }
              }
              reply = [reply];
              break;
            case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ONE: // HGET > string
              reply = [JSON.parse(reply)];
              break;
            case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_SOME: // HMGET > Array<string>
            case types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ALL: // HGETALL > Object<string, string>
              const rows = [];
              for (let k in reply) {
                if (reply[k] != null) {
                  rows.push(JSON.parse(reply[k]));
                }
              }
              reply = rows;
              break;
          }
          reply = lexer.filter(lexset, reply, false);
        }

        if (reply != null) {
          rtn = rtn.concat(reply);
        }
      }
      // label finish
    }

    return rtn;
  }

  /**
   *
   * @param {Array<types.QuerySet>} querysets for connection label
   * @param {Array<RedisCommand>} commands
   * @param {Array<types.LexSet>} lexsets
   * @returns {Promise<(null|boolean|any)>}
   */
  async #callCommandForWrite(querysets, commands, lexsets) {
    let rtn = /** @type {(null|boolean|any)} */ ([]);

    const ready = this.#callCommandReady(querysets, commands, lexsets);

    let conns = null;
    let conn = null;

    let reply = null;
    let command = /** @type {RedisCommand} */ (null);
    let lexset = /** @type {types.LexSet} */ (null);

    const command_arr = /** @type {Array<Array<string>>} */ ([]);
    let value_arr = null;
    let ttl = 0;

    for (let label in ready.querysets) {
      conns = await this.connection(label);
      conn = conns[0];
      // label start
      command_arr.length = 0;
      for (let i = 0, i_len = ready.commands[label].length; i < i_len; i++) {
        command = ready.commands[label][i];
        lexset = ready.lexsets[label][i];

        value_arr = [command.cmd, command.key].concat(command.arg);
        command_arr.push(value_arr);
        if (config.cache.verbose == true) {
          logger.debug('[' + this.constructor.name + '] ' + command.cmd + ' ' + command.key + ' ' + JSON.stringify(command.arg));
        }

        ttl = config.cacheTTL;
        if (ttl > 0 && lexset.nottl == true) {
          ttl = 0;
        }
        if (ttl > 0 && lexset.types != types.LexSet.TYPES.SIMPLE_FOR_CNT && command.cmd != 'DEL' && command.cmd != 'HDEL' && command.cmd != 'INCRBY') {
          value_arr = ['EXPIRE', command.key, ttl];
          command_arr.push(value_arr);
          if (config.cache.verbose == true) {
            logger.debug('[' + this.constructor.name + '] ' + value_arr.join(' '));
          }
        }
      }

      let tran = null;
      try {
        tran = conn.multi();
        for (let i = 0, i_len = command_arr.length; i < i_len; i++) {
          tran.addCommand(command_arr[i]);
        }
        reply = await tran.exec();
      } catch (err) {
        if (ready.querysets[label].usetx == true) {
          tran.discard();
        }
        logger.error(err);
        throw utils.raiseError(errorslib.CACHE_WRITE);
      }
      rtn = reply;
      // label finish
    }

    return rtn;
  }

  /**
   * re-mapping group by label
   *
   * @param {Array<types.QuerySet>} querysets for connection label
   * @param {Array<RedisCommand>} commands
   * @param {Array<types.LexSet>} lexsets
   * @returns {{querysets: Object<string, types.QuerySet>, commands: Object<string, Array<RedisCommand>>, lexsets: Object<string, Array<types.LexSet>>}}
   * @throws When command has wrong
   */
  #callCommandReady(querysets, commands, lexsets) {
    const rtn = {
      querysets: /** Object<string, types.QuerySet> */ {},
      commands: /** Object<string, Array<RedisCommand>> */ {},
      lexsets: /** Object<string, Array<types.LexSet>> */ {},
    };

    // console.log(querysets);
    // console.log(lexsets);

    let label = null;
    for (let i = 0, i_len = querysets.length; i < i_len; i++) {
      label = querysets[i].label;
      if (rtn.querysets[label] == null) {
        rtn.querysets[label] = new types.QuerySet(querysets[i]);
        rtn.querysets[label].query = null;
        rtn.querysets[label].binds = null;
        rtn.querysets[label].index = null;
        rtn.commands[label] = [];
        rtn.lexsets[label] = [];
      }
      if (rtn.querysets[label].label == label && querysets[i].usetx == true) {
        rtn.querysets[label].usetx = true;
      }
      if (commands[i].cmd == null || commands[i].key == null) {
        throw utils.raiseError(errorslib.CACHE_QUERY);
      }
      rtn.commands[label].push(commands[i]);
      rtn.lexsets[label].push(lexsets[i]);
    }

    return rtn;
  }

  /**
   *
   * @param {redis.RedisClientType<Object, redis.RedisScripts>} conn
   * @param {string} cmd
   * @param {string} key
   * @param {?any} arg
   * @returns {Promise<Object>}
   */
  async #callCommandBeforeUpdate(conn, cmd, key, arg = null) {
    let rtn = null;

    let reply = null;

    if (cmd == 'HGET') {
      rtn = await conn.HGET(key, arg);
      if (config.cache.verbose == true) {
        logger.debug('[' + this.constructor.name + '] ' + 'HGET ' + key + ' ' + arg);
      }
    } else if (cmd == 'HMGET') {
      reply = await conn.HMGET(key, arg);
      if (config.cache.verbose == true) {
        logger.debug('[' + this.constructor.name + '] ' + 'HMGET ' + key + ' ' + JSON.stringify(arg));
      }
      if (utils.getType(reply) == 'array') {
        if (reply.length == 1 && reply[0] == null) {
          // [ null ] > null
          rtn = null;
        } else if (arg.length != reply.length) {
          // matching pairs each other
          // obj = utils.objectCombine(arg, reply);
          // rtn = [obj];

          // @todo may be cache removed by TTL ?
          rtn = null;
        } else if (arg.length == reply.length) {
          rtn = reply;
        }
      }
    } else if (cmd == 'HGETALL') {
      reply = await conn.HGETALL(key);
      if (config.cache.verbose == true) {
        logger.debug('[' + this.constructor.name + '] ' + 'HGETALL ' + key);
      }
      if (utils.isEmptyObject(reply) == true) {
        // [Object: null prototype] {} > null
        rtn = null;
      } else {
        rtn = reply;
      }
    }

    return rtn;
  }

  /**
   * redis utility for scan. instead of 'keys'
   *
   * @param {redis.RedisClientType<Object, redis.RedisScripts>} conn connection
   * @param {string} key [PREFIX* || *SUFFIX || *LIKE*]
   * @param {number} cnt scanning count for one cycle
   * @example
   * const searched_keys = await redis.searchKeys(conn, '*', 100);
   * const searched_keys = await redis.searchKeys(conn, 'abc*', 50);
   * const searched_keys = await redis.searchKeys(conn, '*xyz', 50);
   * const searched_keys = await redis.searchKeys(conn, '*ijk*', 50);
   */
  async searchKeys(conn, key, cnt) {
    let rtn = [];
    let cursor = 0;
    let values = null;

    async function scanWrapper() {
      try {
        const reply = await conn.SCAN(cursor, { MATCH: key, COUNT: cnt });
        if (config.cache.verbose == true) {
          logger.debug('cursor: ' + cursor);
        }

        cursor = reply.cursor;
        values = reply.keys;
        if (values.length > 0) {
          rtn = rtn.concat(values);
        }

        if (cursor === 0) {
          return rtn;
        }

        return await scanWrapper();
      } catch (err) {
        logger.error(err);
        throw err;
      }
    }

    try {
      return await scanWrapper();
    } catch (err) {
      throw utils.raiseError(errorslib.CACHE_READ);
    }
  }

  /**
   * @param {string} label
   * @param {Object} container
   * @returns {Promise<Array<redis.RedisClientType<Object, redis.RedisScripts>>>}
   */
  async connection(label, container = config.cache.rw) {
    let rtn = null;

    if (this.#connections[label] == null && container[label] != null) {
      this.#connections[label] = [];
      let conf = container[label];
      if (utils.getType(conf) != 'array') {
        conf = [conf];
      }
      for (let i = 0, i_len = conf.length; i < i_len; i++) {
        const v = conf[i];
        this.#connections[label].push(await this.#setConf(v));
      }
    }

    rtn = this.#connections[label];

    return rtn;
  }

  /**
   * @param {types.QuerySet} args
   * @returns {Promise<Array<Object>>}
   */
  async rows(args) {
    let rtn = /** @type {Array<Object>} */ ([]);

    const args_arr = [args];
    const lexes = lexer.lex(args_arr);
    const commands = await this.#makeCommands(args_arr, lexes);
    rtn = await this.#callCommandForRead(args_arr, commands, lexes);

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

    const lexes = lexer.lex(args);
    const commands = await this.#makeCommands(args, lexes);
    rtn = await this.#callCommandForWrite(args, commands, lexes);

    return rtn;
  }

  /**
   * @param {any} signal
   * @returns {Promise<void>}
   */
  async destroy(signal) {
    const parallel_fn = [];
    for (let k in this.#connections) {
      for (let i = 0, i_len = this.#connections[k].length; i < i_len; i++) {
        parallel_fn.push(this.#connections[k][i].quit());
      }
    }

    await Promise.all(parallel_fn)
      .then()
      .catch((err) => logger.error(err));
  }
}

module.exports = new Redis();
