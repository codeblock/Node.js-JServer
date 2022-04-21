const { performance } = require('perf_hooks'); // https://nodejs.org/api/perf_hooks.html#perf_hooks_performance_now

const http = require('http');

const uniqid = require('uniqid');
const express = require('express');
const { Server, Socket } = require('socket.io');

const redisAdapter = require('@socket.io/redis-adapter');
// const redisEmitter = require('@socket.io/redis-emitter');

// const errorslib = require('@src/library/errorslib.json');

const consts = require('@src/common/consts');
const types = require('@src/common/types');
const config = require('@src/common/config');
const logger = require('@src/common/logger');
const utils = require('@src/common/utils');

const cache = require('@src/library/cache');
const redislib = require('@src/library/cache/redis');

const BINDER_CUSTOM_KEY = {
  custom: 'custom',
  startedMS: 'startedMS',
  pairID: 'pairID',
  ownerID: 'ownerID',
};

/**
 * @typedef {function(express.Request, express.Response, Function): void} CallbackForExpressVoid
 */

class Router {
  constructor() {
    this.#emitter = null;
    this.packetS2S = {};
    this.packetS2C = {};
    this.ignoreFavicon = false;
  }

  /** @type {Server} */ #emitter;
  /** @type {Object} */ packetS2S; // packet for server to server
  /** @type {Object} */ packetS2C; // packet for server to client
  /** @type {boolean} */ ignoreFavicon;

  /**
   * class destructor trigger
   */
  async onDestruct() {
    const ids = this.localSocketOwners();
    if (ids.length > 0) {
      const queryset = this.makeQuerySetSocketTable('DELETE', ids);
      try {
        await cache.execute([queryset]);
      } catch (err) {
        logger.error(err);
      }
    }
  }

  /**
   *
   * @param {Server} server
   * @returns {void}
   */
  setEmitter(server) {
    redislib.connection('pubsub', config.pubsub.rw).then((reply) => {
      this.#emitter = server;
      const pubClient = reply[0];
      const subClient = pubClient.duplicate();
      subClient.connect().then(() => {
        this.#emitter.adapter(redisAdapter.createAdapter(pubClient, subClient));
      });

      for (let k in this.packetS2S) {
        if (typeof this.packetS2S[k] != 'function') {
          continue;
        }
        const s2s_k = config.prefixSocketPacket.s2s.concat(k);
        this.#emitter.on(s2s_k, (args) => {
          logger.info(consts.PREFIX.LOG_LIB + ' received ' + s2s_k + ' from Another Server');
          this.call(k, this.#emitter, args)
            .then((message) => {})
            .catch((err) => {
              logger.error(err);
            });
        });
      }
    });
  }

  /**
   *
   * @returns {Object}
   * @example
   * {
   *   ${socketId-1}: ${ownerId-1},
   *   ${socketId-2}: null,
   *   ${socketId-3}: ${ownerId-3},
   *   ...
   * }
   */
  localSocketPairs() {
    const rtn = {};

    if (this.#emitter != null) {
      this.#emitter.sockets.sockets.forEach((value, key, map) => {
        let v = null;
        if (value[BINDER_CUSTOM_KEY.custom] != null && value[BINDER_CUSTOM_KEY.custom][BINDER_CUSTOM_KEY.ownerID] != null) {
          v = value[BINDER_CUSTOM_KEY.custom][BINDER_CUSTOM_KEY.ownerID];
        }
        rtn[key] = v;
      });
    }

    return rtn;
  }

  /**
   *
   * @returns {Array<string>}
   * @example
   * [
   *   ${ownerId-1},
   *   ${ownerId-3},
   *   ...
   * ]
   */
  localSocketOwners() {
    let rtn = this.localSocketPairs();
    rtn = Object.values(rtn).filter((v) => v != null);

    return rtn;
  }

  /**
   *
   * @param {string} prefix
   * @param {any} k
   * @param {?any} v
   * @returns {types.QuerySet}
   */
  makeQuerySetSocketTable(prefix, k, v = null) {
    const rtn = new types.QuerySet();

    rtn.label = 'pubsub';
    if (prefix == 'SELECT') {
      rtn.query = 'SELECT * FROM ht_pubsub WHERE id_user IN (?)';
      rtn.binds = [k];
    } else if (prefix == 'INSERT') {
      rtn.query = 'INSERT INTO ht_pubsub (id_user, id_socket) VALUES (?, ?)';
      rtn.binds = [k, v];
    } else if (prefix == 'DELETE') {
      rtn.query = 'DELETE FROM ht_pubsub WHERE id_user IN (?)';
      rtn.binds = [k];
    }

    let idxdata = [];
    if (Array.isArray(k) == true) {
      idxdata = idxdata.concat(...k);
    } else {
      idxdata.push(k);
    }

    rtn.index = { sockets: 'sockets', id_user: idxdata };
    rtn.nottl = true;

    return rtn;
  }

  /**
   * insert Map<ownerId, socketId> of external Socket Table.
   * it would be deleted automatically on disconnect
   *
   * @param {string} ownerId
   * @param {Socket} socket
   * @returns {void}
   * @see Socket Server only
   */
  onSocketIn(ownerId, socket) {
    const bindercustom = this.getBinderCustomInfo(socket);
    const ownerID = bindercustom[BINDER_CUSTOM_KEY.ownerID];
    if (ownerId != null && ownerID == null) {
      this.setBinderCustomInfo(socket, BINDER_CUSTOM_KEY.ownerID, ownerId);
      // socket.addListener('disconnect', () => {
      socket.once('disconnecting', () => {
        this.#onSocketOut(ownerId);
      });

      logger.debug('onSocketIn: {' + ownerId + ': ' + socket.id + '}');
      const queryset = this.makeQuerySetSocketTable('INSERT', ownerId, socket.id);
      cache
        .execute([queryset])
        .then((message) => {})
        .catch((err) => {
          logger.error(err);
        });
    }
  }

  /**
   * delete Map<ownerId, socketId> of external Socket Table
   *
   * @param {string} ownerId
   * @returns {void}
   * @see Socket Server only
   */
  #onSocketOut(ownerId) {
    if (ownerId != null) {
      logger.debug('onSocketOut: ' + ownerId);
      const queryset = this.makeQuerySetSocketTable('DELETE', ownerId);
      cache
        .execute([queryset])
        .then((message) => {})
        .catch((err) => {
          logger.error(err);
        });
    }
  }

  #broadcast(to, key, data, nsp = null, room = null) {
    if (to === null) {
      // -------------------------- server to server
      key = config.prefixSocketPacket.s2s.concat(key);
      this.#emitter.serverSideEmit(key, data);
    } else {
      // -------------------------- server to client
      if (to == consts.VALUE.ALL) {
        if (nsp != null && room != null) {
          this.#emitter.of(nsp).to(room).emit(key, data);
        } else if (nsp != null && room == null) {
          this.#emitter.of(nsp).emit(key, data);
        } else if (nsp == null && room != null) {
          this.#emitter.in(room).emit(key, data);
        } else {
          this.#emitter.emit(key, data);
        }
      } else {
        if (Array.isArray(to) == false) {
          to = [to];
        }
        const queryset = this.makeQuerySetSocketTable('SELECT', to);

        cache.rows(queryset).then((message) => {
          for (let i = 0, i_len = message.length; i < i_len; i++) {
            const socketid = message[i]['id_socket'];
            //socketid null check ?? ([a, b, c] > disconnect b > hdel ht_pubsub b on disconnect > select > [a, null, c])
            this.broadcastToSocketID(socketid, key, data);
          }
        });
      }
    }
  }

  /**
   * broadcast Server to Server
   *
   * @param {string} key
   * @param {any} data
   * @returns {void}
   */
  broadcastS2S(key, data) {
    this.#broadcast(null, key, data);
  }

  /**
   * broadcast Server to Client
   *
   * @param {(string|Array<string>)} target Receiver `* | ownerId | [ownerId-1, ownerId-2, ...]`
   * @param {string} key PacketName
   * @param {any} data PacketData
   * @param {string} nsp Namespace
   * @param {(string|Array<string>)} room `room1 | [room1, room2, ...]`
   * @returns {void}
   * @see param target : not SocketID. Router.onSocketIn's ownerId
   */
  broadcastS2C(target, key, data, nsp = null, room = null) {
    this.#broadcast(target, key, data, nsp, room);
  }

  /**
   *
   * @param {string} target SocketID
   * @param {string} key PacketName
   * @param {any} data PacketData
   * @returns {void}
   */
  broadcastToSocketID(target, key, data) {
    this.#emitter.to(target).emit(key, data);
  }

  /**
   *
   * @param {(string|Array<string>)} target Receiver `* | ownerId | [ownerId-1, ownerId-2, ...]`
   * @returns {void}
   * @see param target : not SocketID. Router.onSocketIn's ownerId
   */
  closeSockets(target) {
    let queryset = null;

    if (target == null) {
      return;
    }

    if (target == consts.VALUE.ALL) {
      this.#emitter.disconnectSockets(true);
      queryset = this.makeQuerySetSocketTable('DELETE', null);
      cache
        .execute([queryset])
        .then((message) => {})
        .catch((err) => {
          logger.error(err);
        });
    } else {
      let targets = [];
      if (Array.isArray(target) == false) {
        targets.push(target);
      } else {
        targets = targets.concat(target);
      }
      if (targets.length > 0) {
        const qs = this.makeQuerySetSocketTable('SELECT', targets);
        cache
          .rows(qs)
          .then((message) => {
            for (let i = 0, i_len = message.length; i < i_len; i++) {
              const socketid = message[i]['id_socket'];
              // @ts-ignore
              this.#emitter.of('/').adapter.remoteDisconnect(socketid, true);
            }
          })
          .then(() => {
            queryset = this.makeQuerySetSocketTable('DELETE', targets);
            cache
              .execute([queryset])
              .then((message) => {})
              .catch((err) => {
                logger.error(err);
              });
          });
      }
    }
  }

  /**
   *
   * @param {express.Request} req
   * @returns {Object<string,any>} req.query + req.body
   */
  dataFromHttp(req) {
    return Object.assign({ ...req.query }, req.body);
  }

  /**
   *
   * @param {Object} binder express.Request OR socket.io.Socket
   * @returns {string}
   */
  infoClient(binder) {
    let rtn = '';

    const ip = utils.ipAddr(binder);
    const sess = binder.sessionID || (binder.request && binder.request.sessionID); // (Http || Socket).sessionID
    rtn = '{sess: ' + sess + ', pid: ' + process.pid + ', ip: ' + ip + '}';

    return rtn;
  }

  /**
   * Trigger on Packet received
   *
   * @param {string} k key of router Map
   * @param {Object} binder express.Request OR socket.io.Socket
   * @param {Object} data parameters sent from client
   * @returns {void}
   */
  onRecv(k, binder, data) {
    this.setBinderCustomInfo(binder, BINDER_CUSTOM_KEY.startedMS, performance.now());
    this.setBinderCustomInfo(binder, BINDER_CUSTOM_KEY.pairID, uniqid());

    const bindercustom = this.getBinderCustomInfo(binder);
    const pairId = bindercustom[BINDER_CUSTOM_KEY.pairID];

    let info_additional = this.infoClient(binder);
    logger.info('[' + binder.id + '][' + pairId + '][recv]' + info_additional + ' ' + JSON.stringify(data));
  }

  /**
   * Trigger on Packet sent
   *
   * @param {string} k key of router Map
   * @param {Object} binder express.Request OR socket.io.Socket
   * @param {Object} data parameters made from server (OR Error Object)
   * @returns {void}
   */
  onSend(k, binder, data) {
    const bindercustom = this.getBinderCustomInfo(binder);
    const elapsedMS = performance.now() - bindercustom[BINDER_CUSTOM_KEY.startedMS];
    const pairId = bindercustom[BINDER_CUSTOM_KEY.pairID];

    if (data instanceof Error) {
      logger.error('[' + binder.id + '][' + pairId + '][send][' + elapsedMS + '] ' + data);
    } else {
      logger.info('[' + binder.id + '][' + pairId + '][send][' + elapsedMS + '] ' + JSON.stringify(data));
    }
  }

  /**
   * Trigger before every packet processing (common validation)
   *
   * @abstract
   * @throws {Exception}
   * @returns {Promise<void>}
   * @see check the version / maintenance, block the dual connect, ...
   */
  async callBefore(method, ...args) {}

  async call(method, ...args) {
    const fn = this.packetS2S[method] || this.packetS2C[method];
    return await fn(...args);
  }

  /**
   *
   * @param {Object} binder
   * @param {string=} k
   * @param {any=} v
   * @returns {any}
   */
  setBinderCustomInfo(binder, k, v) {
    if (binder[BINDER_CUSTOM_KEY.custom] == null) {
      binder[BINDER_CUSTOM_KEY.custom] = {
        [BINDER_CUSTOM_KEY.startedMS]: performance.now(),
      };
    }

    if (k != null && v !== undefined) {
      binder[BINDER_CUSTOM_KEY.custom][k] = v;
    }

    return binder[BINDER_CUSTOM_KEY.custom];
  }

  /**
   *
   * @param {Object} binder
   * @param {string=} k
   * @returns
   */
  getBinderCustomInfo(binder, k) {
    this.setBinderCustomInfo(binder);
    if (k != null && binder[BINDER_CUSTOM_KEY.custom][k] !== undefined) {
      return binder[BINDER_CUSTOM_KEY.custom][k];
    }

    return binder.custom;
  }

  /**
   *
   * @param {express.Express} binder
   * @returns {void}
   */
  processForHttp(binder) {
    const that = this;

    // ------------- Can't receive Incomming Message from Another Server
    // redislib.connection('pubsub', config.pubsub.rw).then((reply) => {
    //   const pubClient = reply[0];
    //   that.#emitter = new redisEmitter.Emitter(pubClient);
    // });
    // ------------- Can't receive Incomming Message from Another Server
    const httpServer = http.createServer(binder);
    const socketServer = new Server(httpServer);
    this.setEmitter(socketServer);

    let fn = null;

    if (this.ignoreFavicon == true) {
      binder.get(
        '/favicon.ico',
        /** @type {CallbackForExpressVoid} */ (req, res, next) => {
          // https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
          // 204 No Content : The server successfully processed the request, and is not returning any content.
          res.sendStatus(204).end();
        },
      );
    }

    for (let k in this.packetS2C) {
      if (typeof this.packetS2C[k] != 'function') {
        continue;
      }

      // binder.use(k, this.packetS2C[k]);
      // this.packetS2C[k]['name'] = function.name
      // prettier-ignore
      if (this.packetS2C[k]['name'] == k || this.packetS2C[k]['name'] == 'all') {
        fn = 'all';
      } else if (this.packetS2C[k]['name'] == '_get') { // simple request ~
        fn = 'get';
      } else if (this.packetS2C[k]['name'] == '_head') {
        fn = 'head';
      } else if (this.packetS2C[k]['name'] == '_post') { // ~ simple request
        fn = 'post';
      } else if (this.packetS2C[k]['name'] == '_put') {
        fn = 'put';
      } else if (this.packetS2C[k]['name'] == '_patch') {
        fn = 'patch';
      } else if (this.packetS2C[k]['name'] == '_delete') {
        fn = 'delete';
      } else if (this.packetS2C[k]['name'] == '_options') {
        fn = 'options';
      }

      if (fn != null) {
        // binder[fn] : binder.all, binder.get, binder.post, ...
        binder[fn](
          k,
          /** @type {CallbackForExpressVoid} */ async (req, res, next) => {
            req['id'] = req.sessionID || req.headers.cookie; // generalization for Socket
            const param = {
              method: req.method,
              path: req.path,
              data: that.dataFromHttp(req),
            };

            try {
              that.onRecv(k, req, param);
              await that.callBefore(k, req, res, next);
              const data = await that.call(k, req, res, next);
              if (res.headersSent == false) {
                if (typeof data == 'number') {
                  // RangeError [ERR_HTTP_INVALID_STATUS_CODE]: Invalid status code: ${data}
                  res.send(String(data));
                } else {
                  res.send(data);
                }
              }
              that.onSend(k, req, data);
            } catch (err) {
              if (res.headersSent == false) {
                res.send(err.info());
              }
              that.onSend(k, req, err);
            }
          },
        );
      }
      fn = null;
    }

    binder.use(
      /** @type {CallbackForExpressVoid} */ (req, res, next) => {
        req['id'] = req.sessionID || req.headers.cookie; // generalization for Socket
        const param = {
          method: req.method,
          path: req.path,
          data: that.dataFromHttp(req),
        };
        that.onRecv(req.path, req, param);
        res.status(404).end();
        that.onSend(req.path, req, null);
      },
    );
  }

  nameOfRecvPacket(v) {
    return config.prefixSocketPacket.recv.concat(v);
  }

  nameOfSendPacket(v) {
    return config.prefixSocketPacket.send.concat(v);
  }

  nameOfErrorPacket(v) {
    return config.prefixSocketPacket.error.concat(v);
  }

  /**
   *
   * @param {Server} binder
   * @returns {void}
   */
  processForSocket(binder) {
    const that = this;

    this.setEmitter(binder);

    binder.on('connection', (socket) => {
      logger.info('[' + socket.id + '] connect');

      socket.on('disconnect', () => {
        // console.log(socket);
        logger.info('[' + socket.id + '] disconnect');
      });
      socket.on('error', (err) => {
        // console.error(err);
        logger.error('[' + socket.id + '] ' + err);
      });

      let packet_recv = null;
      let packet_send = null;
      let packet_error = null;

      for (let k in this.packetS2C) {
        if (typeof this.packetS2C[k] != 'function') {
          continue;
        }

        packet_recv = that.nameOfRecvPacket(k);

        // Argument of type '(args: any) => Promise<void>' is not assignable to parameter of type 'FallbackToUntypedListener<Extract<keyof this, string> extends "disconnect" | "disconnecting" | "error" ?
        // SocketReservedEventsMap[("disconnect" | "disconnecting" | "error") & Extract<...>] :
        // Extract<...> extends string ? (...args: any[]) => void : never>'
        // @ts-ignore
        socket.on(packet_recv, async (args) => {
          packet_send = that.nameOfSendPacket(k);
          packet_error = that.nameOfErrorPacket(k);

          const param = {
            packet: that.nameOfRecvPacket(k),
            data: args,
          };

          try {
            that.onRecv(k, socket, param);
            await that.callBefore(k, socket, args);
            const data = await that.call(k, socket, args);
            socket.emit(packet_send, data);
            that.onSend(k, socket, data);
          } catch (err) {
            socket.emit(packet_error, err.info());
            that.onSend(k, socket, err);
          }
        });
      }

      // const enames = Object.keys(that.packetS2C);
      // socket.onAny((k, ...args) => {
      //   if (enames.indexOf(k) == -1) {
      //     const param = {
      //       packet: k,
      //       data: args,
      //     };

      //     that.onRecv(k, socket, param);
      //     logger.warn(consts.PREFIX.LOG_LIB + ' unknown packet received ' + k);
      //   }
      // });
    });
    binder.on('connection_error', (err) => {
      // console.log(err.req); // the request object
      // console.log(err.code); // the error code, for example 1
      // console.log(err.message); // the error message, for example "Session ID unknown"
      // console.log(err.context); // some additional error context
      logger.error(err);
    });
  }
}

module.exports = Router;
