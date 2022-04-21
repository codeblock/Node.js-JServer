const { Server, Socket } = require('socket.io');

const consts = require('@src/common/consts');
const config = require('@src/common/config');
const logger = require('@src/common/logger');
const utils = require('@src/common/utils');
const times = require('@src/common/times');

const Router = require('@src/library/router');

const User = require('@src/module/user');
const Test = require('@src/module/test');
const Validator = require('@src/module/validator');

/**
 * @typedef {function(Socket, any): any} CallbackForSocketAny
 */

class RouterGame extends Router {
  constructor() {
    super();
    const that = this;

    Object.assign(this.packetS2C, {
      hello: /** @type {CallbackForSocketAny} */ (socket, data) => {
        return 'world-server';
      },
      reflect: /** @type {CallbackForSocketAny} */ (socket, data) => {
        return data;
      },
      fixed: /** @type {CallbackForSocketAny} */ (socket, data) => {
        return { a: 'a', b: 1, c: new Test().serverTime() };
      },
      ip: /** @type {CallbackForSocketAny} */ (socket, data) => {
        return utils.ipAddr(socket);
      },
      sid: /** @type {CallbackForSocketAny} */ (socket, data) => {
        return { pid: process.pid, ppid: process.ppid, date: times.datetime() };
      },
      throw: /** @type {CallbackForSocketAny} */ function (socket, data) {
        throw utils.raiseError(99999, 'xxxxx');
      },
      loop: /** @type {CallbackForSocketAny} */ function (socket, data) {
        for (let i = 0; i < 100; i++) {
          socket.emit('key'.concat(String(i)), i);
        }
        return 'loop-finished';
      },
      login: /** @type {CallbackForSocketAny} */ async (socket, data) => {
        const rtn = await new User().get(data);
        if (rtn != null) {
          that.onSocketIn(rtn.id, socket);
        }

        return rtn;
      },
      notify: /** @type {CallbackForSocketAny} */ async (socket, data) => {
        if (utils.validParam(['userid', 'key', 'data'], data) == false) {
          throw utils.raiseError(88888, 'requirements : { "userid": {string}, "key": {string}, "data": {any} }');
        }
        that.broadcastS2C(data.userid, data.key, data.data);
      },
      userTest: /** @type {CallbackForSocketAny} */ async (socket, data) => {
        return await new User().testData();
      },
    });
  }

  // ----------------------------------------- @override
  // infoUnique(binder) {
  //   return '';
  // }
  // onRecv(k, binder, data) {
  //   super.onRecv(k, binder, data);
  //   // ... additional process
  // }
  // onSend(k, binder, data) {
  //   super.onSend(k, binder, data);
  //   // ... additional process
  // }

  // config.prefixSocketPacket: {
  //   "s2s": "s2s_",
  //   "recv": "Request",
  //   "send": "Response",
  //   "error": "ErrorResponse"
  // },
  // nameOfRecvPacket(v) {
  //   // ex) hello > RequestHello
  //   v = v.substring(0, 1).toUpperCase().concat(v.substring(1));
  //   return config.prefixSocketPacket.recv.concat(v);
  // }
  // nameOfSendPacket(v) {
  //   // ex) hello > ResponseHello
  //   v = v.substring(0, 1).toUpperCase().concat(v.substring(1));
  //   return config.prefixSocketPacket.send.concat(v);
  // }
  // nameOfErrorPacket(v) {
  //   // ex) hello > ErrorResponseHello
  //   v = v.substring(0, 1).toUpperCase().concat(v.substring(1));
  //   return config.prefixSocketPacket.error.concat(v);
  // }

  // for socket-client test
  processForSocket(binder) {
    binder.addListener('connection', (/**  @type {Socket}*/ socket) => {
      setInterval(() => {
        const data = this.infoClient(socket);
        socket.emit('notify', data);
      }, 1000);

      // socket.on('disconnect', () => {
      //   const data = this.infoClient(socket);
      //   logger.info('bye~ ' + JSON.stringify(data));
      // });
    });

    super.processForSocket(binder);
  }

  async callBefore(k, socket, data) {
    const param = data;
    await new Validator().accessible(param);
  }
  // ----------------------------------------- @override
}

module.exports = RouterGame;
