const path = require('path');

const express = require('express');

const errors = require('@src/config/errors.json');

const consts = require('@src/common/consts');
const config = require('@src/common/config');
const logger = require('@src/common/logger');
const utils = require('@src/common/utils');

const Router = require('@src/library/router');

const User = require('@src/module/user');
const Test = require('@src/module/test');
const Validator = require('@src/module/validator');

/**
 * @typedef {function(express.Request, express.Response, Function): any} CallbackForExpressAny
 */

class RouterApi extends Router {
  constructor() {
    super();
    this.ignoreFavicon = true;

    const that = this;

    Object.assign(this.packetS2C, {
      // ---------------------------------- API set
      '/a': /** @type {CallbackForExpressAny} */ (req, res, next) => {
        return that.apiObject(res, 'a all');
      },
      '/b': /** @type {CallbackForExpressAny} */ function _get(req, res, next) {
        return that.apiObject(res, 'b get');
      },
      '/c': /** @type {CallbackForExpressAny} */ function _post(req, res, next) {
        return that.apiObject(res, 'c post');
      },
      '/d': /** @type {CallbackForExpressAny} */ function _put(req, res, next) {
        return that.apiObject(res, 'd put');
      },
      '/e': /** @type {CallbackForExpressAny} */ function _patch(req, res, next) {
        return that.apiObject(res, 'e patch');
      },
      '/f': /** @type {CallbackForExpressAny} */ function _delete(req, res, next) {
        return that.apiObject(res, 'f delete');
      },
      '/common/err': /** @type {CallbackForExpressAny} */ (req, res, next) => {
        return that.apiObject(res, utils.raiseError(99999, 'xxxxx'));
      },
      '/common/ip': /** @type {CallbackForExpressAny} */ async function _get(req, res, next) {
        return that.apiObject(res, utils.ipAddr(req));
      },
      '/user/get': /** @type {CallbackForExpressAny} */ async function _get(req, res, next) {
        const param = that.dataFromHttp(req);
        const rtn = await new User().get(param);
        return that.apiObject(res, rtn);
      },
      '/user/test': /** @type {CallbackForExpressAny} */ async function _get(req, res, next) {
        const rtn = await new User().testData();
        return that.apiObject(res, rtn);
      },
      '/test/test': /** @type {CallbackForExpressAny} */ async function (req, res, next) {
        const rtn = await new Test().testData();
        return that.apiObject(res, rtn);
      },
      // ---------------------------------- API set

      // ---------------------------------- template engine
      // binder.get('/pathname', (req, res, next) => {
      //   res.render('view/pathname', { paramName: 'paramValue', foo: 'bar' });
      //   return 'render ' + pathname;
      // });
      // ---------------------------------- template engine

      '/times/board': /** @type {CallbackForExpressAny} */ async function _get(req, res, next) {
        const param = that.dataFromHttp(req);
        param['baseUrl'] = req.baseUrl;
        param['path'] = req.path;
        const data = new Test().timesBoard(param);
        res.send(data);
        return '<html string returned>'; // because log string is huge than other cases
      },

      // s2s : syncronization all servers
      '/times/synctime': /** @type {CallbackForExpressAny} */ async function _get(req, res, next) {
        const rtn = await new Test().syncTimeFromDB();
        that.broadcastS2S('synctime', { tsmilli: rtn.tsmilli, offset: rtn.offset });
        return rtn;
      },
      // s2s : syncronization all servers
      '/times/setSecondsPerDay': /** @type {CallbackForExpressAny} */ async function _get(req, res, next) {
        let rtn = -1;
        const param = that.dataFromHttp(req);
        rtn = new Test().setSecondsPerDay(param.seconds);
        if (rtn > -1) {
          that.broadcastS2S('setSecondsPerDay', rtn);
        }
        return rtn;
      },
      // s2c
      '/realtime/notify': /** @type {CallbackForExpressAny} */ function _get(req, res, next) {
        const param = that.dataFromHttp(req);
        if (utils.validParam(['userid', 'key', 'data'], param) == false) {
          throw utils.raiseError(88888, 'requirements : { "userid": {string}, "key": {string}, "data": {any} }');
        }
        that.broadcastS2C(param.userid, param.key, param.data);
        return true;
      },
      // s2c
      '/realtime/kick': /** @type {CallbackForExpressAny} */ function _get(req, res, next) {
        const param = that.dataFromHttp(req);
        if (utils.validParam(['userids'], param) == false) {
          throw utils.raiseError(88888, 'requirements : userids=* / userids=userid-1 / userids=["userid-1", "userid-2", ...]');
        }
        let arg = param.userids;
        try {
          arg = JSON.parse(arg);
        } catch (err) {}
        that.closeSockets(arg);
        return true;
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

  async callBefore(k, req, res, next) {
    const param = this.dataFromHttp(req);
    await new Validator().accessible(param);
  }

  processForHttp(binder) {
    const wwwpath = path.join(path.dirname(path.dirname(__dirname)), 'test', 'html');
    logger.info(consts.PREFIX.LOG_LIB + ' loaded service path: ' + wwwpath);

    // 1. static
    binder.use(express.static(wwwpath));

    // 2. template engine (npm install ejs, https://ejs.co/)
    // binder.set('views', wwwpath);
    // binder.set('view engine', 'ejs');

    super.processForHttp(binder);
  }
  // ----------------------------------------- @override

  /**
   *
   * @param {express.Response} res
   * @param {any} data
   * @returns {{code: number, message: string, data: any}}
   * @throws {Error}
   */
  apiObject(res, data) {
    res.set('Content-Type', consts.VALUE.MIME_JSON.concat('; charset=utf-8'));
    res.set('X-Powered-By', 'API');

    if (data instanceof Error) {
      throw data;
    } else {
      const rtn = {
        code: errors.OK.code,
        message: '',
        data: data,
      };

      return rtn;
    }
  }
}

module.exports = RouterApi;
