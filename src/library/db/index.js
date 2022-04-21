const path = require('path');
const worker_threads = require('worker_threads');

const knex = require('knex');
const packetMySQL = require('mysql/lib/protocol/packets');

if (worker_threads.isMainThread == false) {
  // require('module-alias/register'); //  DB worker error: {"code":"MODULE_NOT_FOUND","message":"Cannot find module '@src/library/errorslib.json...",...}
  require(path.join(path.dirname(path.dirname(__dirname)), 'common', 'requires')); // Error.prototype...
}

const errorslib = require('@src/library/errorslib.json');

const consts = require('@src/common/consts');
const types = require('@src/common/types');
const config = require('@src/common/config');

if (worker_threads.isMainThread == false) {
  config.setName(worker_threads.workerData.config_name);
}

const logger = require('@src/common/logger');
const utils = require('@src/common/utils');
const times = require('@src/common/times');

const InterfaceData = require('@src/library/data/idata');

/**
 * @typedef {packetMySQL.RowDataPacket} TypedRowData
 * @typedef {packetMySQL.FieldPacket} TypedField
 * @typedef {Array<Array<TypedRowData>, Array<TypedField>>} TypedRowDataAndField
 * @typedef {packetMySQL.OkPacket} TypedOk
 */

/**
 * @implements {InterfaceData}
 */
class DB {
  static PREFIX_READ = 'READ-';
  static PREFIX_WRITE = 'WRITE-';
  static THREAD_EXEC_IDLETIME = 1000;

  // /**
  //  *
  //  * @see debug
  //  * @description Monitoring the Connection Pool counter
  //  */
  // testPoolMonitor() {
  //   for (let k in this.#connections) {
  //     const conns = this.#connections[k];
  //     for (let i = 0, i_len = conns.length; i < i_len; i++) {
  //       console.log('numUsed: ' + conns[i].client.pool.numUsed() + ', numFree: ' + conns[i].client.pool.numFree());
  //     }
  //   }
  // }

  constructor() {
    // setInterval(() => this.testPoolMonitor.call(this), 500);

    if (config.dbWriteAsync == true) {
      if (worker_threads.isMainThread == true) {
        this.#thread_worker_sab = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT);
        this.#thread_worker_u32 = new Uint32Array(this.#thread_worker_sab);

        this.#thread_worker = new worker_threads.Worker(__filename, { workerData: { config_name: config.getName() } });
        this.#thread_worker
          .on('error', (err) => {
            this.#writeLog('error', 'worker error: ' + err);
          })
          .on('exit', (code) => {
            this.#writeLog('info', 'worker exit: ' + code);
          })
          .on('message', (data) => {
            // logger.debug(clnm + ' worker message: ' + JSON.stringify(data));
            // if (data.k == 'remain') {
            //   this.#thread_works_remain = data.v;
            // }
          })
          .on('online', () => {
            this.#writeLog('info', 'worker online');
          });

        // debugging
        // setInterval(() => {
        //   console.log('main thread: threadWorkRemains - ' + this.#threadWorkRemains());
        // }, 1000);
      } else {
        this.#thread_workat = Date.now();
        worker_threads.parentPort.on('message', async (data) => {
          // -------------------------------------------------- 1. child-thread regist
          if (data.k == 'add') {
            this.#thread_queue.push(data.v);
          }

          if (this.#thread_working == true) {
            return;
          }

          let chunksize = config.dbWriteAsyncExecChunksize;

          // -------------------------------------------------- 2. child-thread monitoring for destroy
          if (data.k == 'destroy') {
            chunksize = config.dbWriteAsyncExecChunksizeOnDestroy;
            // this.#thread_working = false;
            this.#thread_workat -= DB.THREAD_EXEC_IDLETIME;

            if (this.#thread_lastspurt == null) {
              const thread_queue_remain = this.#thread_queue.length;
              const thread_queue_remain_per = 100 / thread_queue_remain;
              const thread_queue_remain_str = String(thread_queue_remain);
              this.#thread_lastspurt = setInterval(() => {
                let percentage = Math.floor((thread_queue_remain - this.#threadWorkRemains()) * thread_queue_remain_per);
                if (this.#threadWorkRemains() == 0) {
                  clearInterval(this.#thread_lastspurt);
                  // (680310 - 0) * (100 / 680310) : percentage = 99.9999999999...
                  percentage = 100;
                }
                const padded_percentage = utils.strPadding(String(percentage), ' ', 3);
                const padded_remains = utils.strPadding(String(this.#threadWorkRemains()), ' ', thread_queue_remain_str.length);
                this.#writeLog('info', 'dbWriteAsync waiting for remain job ... ' + padded_percentage + '% (' + padded_remains + ' / ' + thread_queue_remain + ')');
                if (this.#threadWorkRemains() == 0) {
                  this.#writeLog('info', 'dbWriteAsync done');
                }
              }, 1000);
            }
          }

          // -------------------------------------------------- 3. child-thread work
          if (this.#thread_working == false && chunksize > 0 && Date.now() - this.#thread_workat >= DB.THREAD_EXEC_IDLETIME) {
            this.#thread_working = true;

            const thread_works = this.#thread_queue.splice(0, chunksize);
            for (let i = 0, i_len = thread_works.length; i < i_len; i++) {
              try {
                const exec = await this.#_execute(thread_works[i][0], thread_works[i][1], thread_works[i][2]);
                logger.debug(JSON.stringify(exec));
              } catch (err) {
                logger.error(err);
              }
            }

            if (this.#thread_lastspurt == null) {
              this.#writeLog('info', 'dbWriteAsync remains: ' + this.#thread_queue.length);
            }

            this.#thread_workat = Date.now();
            this.#thread_working = false;
          }

          // -------------------------------------------------- 4. child-thread update remains
          // worker_threads.parentPort.postMessage({ k: 'remain', v: this.#thread_queue.length });
          data.s[0] = this.#thread_queue.length; // #thread_worker_u32[0]
        });

        // debugging
        // setInterval(() => {
        //   // console.log('child thread: threadWorkRemains - ' + this.#threadWorkRemains());
        // }, 1000);
      }
    }
  }

  // for common thread
  #thread_worker_sab = /** @type {SharedArrayBuffer} */ (null);
  #thread_worker_u32 = /** @type {Uint32Array} */ (null);

  // for main thread
  #thread_worker = /** @type {worker_threads.Worker} */ (null);

  // for child thread
  #thread_queue = /** @type {Array<types.QuerySet, Array<string>, Array<(Array|Object)>>} */ ([]);
  #thread_working = false;
  #thread_workat = 0;
  #thread_lastspurt = null;

  #connections = /** @type {Object<string, Array<knex.Knex>>} */ ({});

  #threadWorkRemains() {
    let rtn = 0;

    if (config.dbWriteAsync == true) {
      if (worker_threads.isMainThread == true) {
        // rtn = this.#thread_works_remain;
        rtn = this.#thread_worker_u32[0];
      } else {
        rtn = this.#thread_queue.length;
      }
    }

    return rtn;
  }

  #threadWorkAdd(data) {
    if (config.dbWriteAsync == true && worker_threads.isMainThread == true) {
      // s: SharedMemory, k: Key, v: Value
      this.#thread_worker.postMessage({ s: this.#thread_worker_u32, k: 'add', v: data });
    }
  }

  #threadWorkExec(k = 'exec') {
    if (config.dbWriteAsync == true && worker_threads.isMainThread == true) {
      // s: SharedMemory, k: Key, v: Value
      this.#thread_worker.postMessage({ s: this.#thread_worker_u32, k: k, v: null });
    }
  }

  #postProcessResponse(result, queryContext) {
    for (let i = 0, i_len = result[0].length; i < i_len; i++) {
      for (let k in result[0][i]) {
        if (result[0][i][k] === null) {
          // null > ''
          // result[0][i][k] = '';
        } else if (result[0][i][k] instanceof Date) {
          // DateObject > string(yyyy-MM-ddTHH:mm:ss.SSSZ) > string(yyyy-MM-dd HH:mm:ss)

          // result[0][i][k] = result[0][i][k]
          //   .toISOString()
          //   .replace('T', ' ')
          //   .replace(/\.\d{3}Z$/, '');.

          result[0][i][k] = times.datetime(times.unixtime(result[0][i][k]));
        }
      }
    }

    return result;
  }

  #writeLog(levelstr, str) {
    logger.log(levelstr, consts.PREFIX.LOG_LIB + ' [' + process.pid + '][' + this.constructor.name + '] ' + str);
  }

  /**
   *
   * @param {Object} conf
   * @returns {knex.Knex}
   */
  #setConf(conf) {
    const that = this;
    const configobj = {
      client: conf.vendor,
      connection: {
        host: conf.host,
        port: conf.port,
        user: conf.user,
        password: conf.pass,
        database: conf.dbnm,
      },
      pool: {
        min: conf.pool,
        max: conf.pool,
        // afterCreate: function (conn, done) {
        //   // console.log(conn);
        //   done();
        // },
      },
      // acquireConnectionTimeout ?
      postProcessResponse: (result, queryContext) => that.#postProcessResponse(result, queryContext),
      log: {
        warn(message) {
          // case 1:
          //   DB Server restart after pool used least at once
          //   Connection Error: {"code":"PROTOCOL_CONNECTION_LOST","message":"Connection lost: The server closed the connection.","stack":...}
          logger.warn(message);
        },
        deprecate(message) {
          logger.warn(message);
        },
        debug(message) {
          logger.debug(message);
        },
      },
    };
    // if (configobj.client == 'oracledb') {
    //   configobj['fetchAsString'] = ['number', 'clob'];
    // }

    const rtn = knex.knex(configobj);

    // @link node_modules/tarn/dist/Pool
    // rtn.client.pool.on('release', (rsc) => {
    //   console.log(rsc);
    // });
    rtn.client.pool.on('createSuccess', (eventId) => {
      logger.debug(consts.PREFIX.LOG_LIB + ' knex(' + configobj.client + ') Pool created. knex.eventId: ' + eventId);
    });

    return rtn;
  }

  /**
   * label for read connection
   *
   * @param {string} lbl label
   * @returns {string}
   * @example READ-${dbname}, READ-user, READ-master, READ-standard ...
   */
  labelRead(lbl) {
    return DB.PREFIX_READ.concat(lbl);
  }

  /**
   * label for write connection
   *
   * @param {string} lbl label
   * @returns {string}
   * @example WRITE-${dbname}, WRITE-user, WRITE-master, WRITE-standard ...
   */
  labelWrite(lbl) {
    return DB.PREFIX_WRITE.concat(lbl);
  }

  /**
   * @param {string} label
   * @returns {Promise<Array<knex.Knex>>}
   */
  async connection(label) {
    let rtn = null;

    if (label.startsWith(DB.PREFIX_WRITE) == true) {
      // write
      const lbl = label.substring(DB.PREFIX_WRITE.length, label.length);
      if (this.#connections[label] == null && config.db.w[lbl] != null) {
        this.#connections[label] = [];
        let conf = config.db.w[lbl];
        if (utils.getType(conf) != 'array') {
          conf = [conf];
        }
        for (let i = 0, i_len = conf.length; i < i_len; i++) {
          const v = Object.assign({ vendor: config.db.vendor }, conf[i]);
          this.#connections[label].push(this.#setConf(v));
        }
      }
    } else {
      // read
      const lbl = label.substring(DB.PREFIX_READ.length, label.length);
      if (this.#connections[label] == null && config.db.r[lbl] != null) {
        this.#connections[label] = [];
        let conf = config.db.r[lbl];
        if (utils.getType(conf) != 'array') {
          conf = [conf];
        }
        for (let i = 0, i_len = conf.length; i < i_len; i++) {
          const v = Object.assign({ vendor: config.db.vendor }, conf[i]);
          this.#connections[label].push(this.#setConf(v));
        }
      }
    }

    rtn = this.#connections[label];

    return rtn;
  }

  /**
   * @param {types.QuerySet} args
   * @returns {Promise<Array<TypedRowData>>}
   */
  async rows(args) {
    let rtn = /** @type {Array<TypedRowData>} */ ([]);
    let rs = /** @type {TypedRowDataAndField} */ (null);

    let conn = await this.connection(this.labelRead(args.label));

    // all shardings
    let start = 0;
    let finish = conn.length - 1;

    // only one shard
    if (args.shard > 0) {
      start = args.shard - 1;
      finish = args.shard - 1;
    }

    if (conn != null && conn[start] != null && conn[finish] != null) {
      try {
        while (start <= finish) {
          rs = await conn[start].raw(args.query, args.binds);
          if (config.db.verbose == true) {
            logger.debug('[' + this.constructor.name + '] ' + conn[start].raw(args.query, args.binds).toQuery());
          }
          if (rs != null && rs[0] != null) {
            rtn = rtn.concat(rs[0]);
          }
          start++;
        }
      } catch (err) {
        logger.error(err);
        throw utils.raiseError(errorslib.DB_READ);
      }
    }

    return rtn;
  }

  /**
   * @param {types.QuerySet} args
   * @returns {Promise<(TypedRowData|null)>}
   */
  async row(args) {
    let rtn = /** @type {TypedRowData} */ (null);
    const rs = await this.rows(args);

    if (rs != null && rs[0] != null) {
      rtn = rs[0];
    }

    return rtn;
  }

  /**
   * @param {Array<types.QuerySet>} args
   * @returns {Promise<Array<TypedOk>>}
   */
  async execute(args) {
    let rtn = /** @type {Array<TypedOk>} */ ([]);
    let exec = /** @type {Array<TypedOk>} */ ([]);

    // console.log(args);

    // re-mapping group by label, shard
    const queryset = /** Object<string, types.QuerySet> */ {};
    const queries = /** Object<string, Array<string>> */ {};
    const binds = /** Object<string, (Array|Object)> */ {};

    let label_shard = null;
    let label = null;
    let shard = null;

    for (let i = 0, i_len = args.length; i < i_len; i++) {
      label = args[i].label;
      shard = args[i].shard;
      if (shard == 1 && config.db.w[label].length == 1) {
        shard = 0;
      }
      label_shard = label + ':' + shard;
      if (queryset[label_shard] == null) {
        queryset[label_shard] = new types.QuerySet(args[i]);
        queryset[label_shard].query = null;
        queryset[label_shard].binds = null;
        queries[label_shard] = [];
        binds[label_shard] = [];
      }
      if (queryset[label_shard].label == label && queryset[label_shard].shard == shard && args[i].usetx == true) {
        queryset[label_shard].usetx = true;
      }
      queries[label_shard].push(args[i].query);
      if (config.dbWriteAsync == true && Array.isArray(args[i].binds) == true) {
        binds[label_shard].push([...args[i].binds]);
      } else {
        binds[label_shard].push(args[i].binds);
      }
    }

    if (config.dbWriteAsync == true) {
      for (let k in queryset) {
        const param_queryset = queryset[k];
        const param_queries = queries[k];
        const param_binds = binds[k];
        const param_arr = [param_queryset, param_queries, param_binds];
        this.#threadWorkAdd(param_arr);
      }
    } else {
      for (let k in queryset) {
        exec = await this.#_execute(queryset[k], queries[k], binds[k]);
        rtn = rtn.concat(exec);
      }
    }

    // console.log(queryset);
    // console.log(queries);
    // console.log(binds);

    return rtn;
  }

  /**
   * @param {types.QuerySet} args
   * @param {Array<string>} queries
   * @param {Array<(Array|Object)>} binds
   * @returns {Promise<Array<TypedOk>>}
   */
  async #_execute(args, queries, binds) {
    let rtn = /** @type {Array<TypedOk>} */ ([]);
    let exec = /** @type {Array<TypedOk, null>} */ (null);

    const conn = await this.connection(this.labelWrite(args.label));

    // all shardings
    let start = 0;
    let finish = conn.length - 1;

    // only one shard
    if (args.shard > 0) {
      start = args.shard - 1;
      finish = args.shard - 1;
    }

    if (conn != null && conn[start] != null && conn[finish] != null) {
      let tx = null;

      while (start <= finish) {
        try {
          tx = conn[start];
          if (args.usetx == true) {
            tx = await tx.transaction();
          }

          for (let i = 0, i_len = queries.length; i < i_len; i++) {
            exec = await tx.raw(queries[i], binds[i]);
            if (config.db.verbose == true) {
              logger.debug('[' + this.constructor.name + '] ' + tx.raw(queries[i], binds[i]).toQuery());
            }
            if (exec != null && exec[0] != null) {
              rtn.push(exec[0]);
            }
          }

          // @ts-ignore
          // tx.commit != null : for prevent `TypeError: tx.commit is not a function` when non-tx mode or not supported tx DBMS
          if (args.usetx == true && tx.commit != null) {
            // @ts-ignore
            await tx.commit();
          }
        } catch (err) {
          // @ts-ignore
          // tx.rollback != null : for prevent `TypeError: tx.rollback is not a function` when non-tx mode or not supported tx DBMS
          if (args.usetx == true && tx.rollback != null) {
            // @ts-ignore
            await tx.rollback();
          }
          logger.error(err);
          throw utils.raiseError(errorslib.DB_WRITE);
        } finally {
          // @ts-ignore
          // tx.isCompleted != null : for prevent `TypeError: tx.isCompleted is not a function` when non-tx mode or not supported tx DBMS
          if (args.usetx == true && tx.isCompleted != null && tx.isCompleted() == false) {
            logger.error('transaction is not completed : ' + JSON.stringify(queries) + ' : ' + JSON.stringify(binds));
          }
        }

        start++;
      }
    }

    return rtn;
  }

  /**
   * @param {any} signal
   * @returns {Promise<void>}
   */
  async destroy(signal) {
    // 1. finish the remain works
    if (config.dbWriteAsync == true) {
      while (this.#threadWorkRemains() > 0) {
        this.#threadWorkExec('destroy');
        utils.spinlock(500);
      }
      utils.spinlock(500);
    }

    // 2. disconnect ready
    const parallel_fn = [];
    for (let k in this.#connections) {
      for (let i = 0, i_len = this.#connections[k].length; i < i_len; i++) {
        parallel_fn.push(this.#connections[k][i].destroy());
      }
    }

    // 3. disconnect
    await Promise.all(parallel_fn)
      .then()
      .catch((err) => logger.error(err));

    // if (config.dbWriteAsync == true) {
    //   utils.spinlock(500);
    // }
  }
}

module.exports = new DB();
