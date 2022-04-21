const uniqid = require('uniqid');

const errors = require('@src/config/errors.json');
const queries = require('@src/config/queries.json');

const types = require('@src/common/types');
const logger = require('@src/common/logger');
const utils = require('@src/common/utils');
const times = require('@src/common/times');

const db = require('@src/library/db');
const cache = require('@src/library/cache');
const Data = require('@src/library/data');

/**
 * @typedef {{id: string, id_event: string}} ParamCacheGroupOnly
 * @typedef {{id: Array<string>}} ParamArrID
 */

class User extends Data {
  constructor() {
    super();
    this.label = 'user';
  }

  label;

  async isDenied(id) {
    // ...
    return false;
  }

  async isAdmin(id) {
    // ...
    return false;
  }

  /**
   *
   * @param {ParamCacheGroupOnly} data
   * @returns {Promise<Array<Object>>}
   */
  async selectCacheGroupOnly(data) {
    let rtn = null;

    // const param = new types.QuerySet();
    // param.label = this.label;
    // param.query = 'SELECT * FROM tb_user_mission WHERE ??=? AND id_event = ? AND id_group = ?';
    // param.binds = ['id_user', data.id, data.id_event, 325000001];
    // param.index = { id_user: data.id, id_event: data.id_event, id_group: 325000001, code: null };
    // rtn = await cache.rows(param);

    const param = new types.QuerySet();
    param.label = this.label;

    // param.query = 'SELECT * FROM tb_user_mission WHERE ??=? AND id_event = ? AND id_group = ? AND code = ?';
    // param.binds = ['id_user', data.id, data.id_event, 325000001, 326000001];
    // param.index = { id_user: data.id, id_event: data.id_event, id_group: 325000001, code: [326000001] };
    // rtn = await cache.row(param);

    // param.query = 'SELECT * FROM tb_user_mission WHERE ??=? AND id_event = ? AND id_group = ? AND code IN (?)';
    // param.binds = ['id_user', data.id, data.id_event, 325000001, [326000001, 326000003]];
    // param.index = { id_user: data.id, id_event: data.id_event, id_group: 325000001, code: [326000001, 326000003] };
    // rtn = await cache.rows(param);

    // param.query = 'SELECT curr, AVG(need) avg_need FROM tb_user_mission WHERE ??=? AND id_event = ? AND id_group = ? GROUP BY curr';
    // param.query = 'SELECT code, curr going, need AS until FROM tb_user_mission WHERE ??=? AND id_event = ? AND id_group = ?';
    param.query = queries.testCacheOnly.selectTbUserMissionRows;
    param.binds = ['id_user', data.id, data.id_event, 325000001];
    param.index = { id_user: data.id, id_event: data.id_event, id_group: 325000001, code: [null] };
    rtn = await cache.rows(param);

    return rtn;
  }

  /**
   *
   * @param {number} cnt
   * @returns {Promise<{executed: Array<Object>, created: ParamCacheGroupOnly}>}
   */
  async insertCacheGroupOnly(cnt) {
    let rtn = { executed: null, created: { id: uniqid(), id_event: 'evt_a' } };

    const params = [];
    let param = null;

    let increase_id_group = 0;
    let increase_code = 0;
    for (let i = 0; i < cnt * 2; i++) {
      increase_id_group = 325000000 + Math.ceil((i + 1) / 5);
      increase_code = 326000000 + ((i % 5) + 1);
      param = new types.QuerySet();
      param.label = this.label;
      param.query = queries.testCacheOnly.insertTbUserMission;
      param.binds = [rtn.created.id, rtn.created.id_event, increase_id_group, increase_code, 0, 0, 0, times.datetime(), null];
      param.index = { id_user: rtn.created.id, id_event: rtn.created.id_event, id_group: increase_id_group, code: [increase_code] };
      params.push(param);
    }

    try {
      rtn.executed = await cache.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {ParamCacheGroupOnly} data
   * @returns {Promise<Array<Object>>}
   */
  async updateCacheGroupOnly(data) {
    let rtn = null;

    const params = [];
    let param = null;

    param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.testCacheOnly.upsertTbUserMission;
    param.binds = [data.id, data.id_event, 325000001, 326000001, times.datetime(), null, times.datetime()];
    param.index = { id_user: data.id, id_event: data.id_event, id_group: 325000001, code: [326000001] };
    params.push(param);

    try {
      rtn = await cache.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {ParamCacheGroupOnly} data
   * @returns {Promise<Array<Object>>}
   */
  async deleteCacheGroupOnly(data) {
    let rtn = null;

    const params = [];
    let param = null;

    // delete all group 325000001
    // param = new types.QuerySet();
    // param.label = this.label;
    // param.query = 'DELETE FROM tb_user_mission WHERE id_user = ? AND id_event = ? AND id_group = ?';
    // param.binds = [data.id, data.id_event, 325000001];
    // param.index = { id_user: data.id, id_event: data.id_event, id_group: 325000001 };
    // param.usetx = true;
    // params.push(param);

    // delete one in group 325000001, 325000002
    param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.testCacheOnly.deleteTbUserMission;
    param.binds = [data.id, data.id_event, 325000001, [326000002, 326000004]];
    param.index = { id_user: data.id, id_event: data.id_event, id_group: 325000001, code: [326000002, 326000004] };
    param.usetx = true;
    params.push(param);
    param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.testCacheOnly.deleteTbUserMission;
    param.binds = [data.id, data.id_event, 325000002, [326000002, 326000004]];
    param.index = { id_user: data.id, id_event: data.id_event, id_group: 325000002, code: [326000002, 326000004] };
    param.usetx = true;
    params.push(param);

    try {
      rtn = await cache.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {ParamArrID} data
   * @returns {Promise<Object>}
   */
  async selectCacheOnly(data) {
    let rtn = null;

    // ?? = ? : `id` = '${key}'
    // ?  = ? : 'id' = '${key}'
    const param = new types.QuerySet();
    param.label = this.label;
    // param.query = 'SELECT * FROM tb_what WHERE ??=? AND 1       =     1 AND 2<>3 AND 4         !=   3';
    param.query = queries.testCacheOnly.selectTbWhatRow;
    param.binds = ['id', data.id[0]];
    param.index = { id: data.id[0] };
    rtn = await cache.row(param);

    return rtn;
  }

  /**
   *
   * @param {number} cnt
   * @returns {Promise<{executed: Array<Object>, created: ParamArrID}>}
   */
  async insertCacheOnly(cnt) {
    let rtn = { executed: null, created: { id: [] } };

    const params = [];
    let param = null;

    let id = null;
    let name = null;

    for (let i = 0; i < cnt; i++) {
      id = uniqid();
      rtn.created.id.push(id);
      name = id.concat('-name'); // uniqid.time()

      if (i % 3 == 0) {
        // insert with array binding
        param = new types.QuerySet();
        param.label = this.label;
        param.query = queries.testCacheOnly.insertTbWhatBindArr;
        param.binds = [id, name, 0];
        param.index = { id: id };
        params.push(param);
      } else if (i % 3 == 1) {
        // insert with object binding
        param = new types.QuerySet();
        param.label = this.label;
        param.query = queries.testCacheOnly.insertTbWhatBindObj;
        param.binds = { id: id, name: name, exp: 0 };
        param.index = { id: id };
        params.push(param);
      } else if (i % 3 == 2) {
        // upsert
        param = new types.QuerySet();
        param.label = this.label;
        param.query = queries.testCacheOnly.upsertTbWhatBindObj;
        param.binds = { id: id, name: name, exp: 0, addexp: 1 };
        param.index = { id: id };
        params.push(param);
      }
    }

    try {
      rtn.executed = await cache.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {ParamArrID} data
   * @returns {Promise<Array<Object>>}
   */
  async updateCacheOnly(data) {
    let rtn = null;

    const param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.testCacheOnly.updateTbWhat;
    param.binds = [1, data.id[0]];
    param.index = { id: data.id[0] };

    try {
      rtn = await cache.execute([param]);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {ParamArrID} data
   * @returns {Promise<Array<Object>>}
   */
  async deleteCacheOnly(data) {
    let rtn = null;

    const params = [];
    let param = null;

    param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.testCacheOnly.deleteTbWhat; // transaction, affected: 1
    param.binds = [data.id[data.id.length - 1]];
    param.index = { id: data.id[data.id.length - 1] };
    param.usetx = true;
    params.push(param);

    param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.testCacheOnly.deleteTbWhat; // transaction, affected: 0
    param.binds = [data.id[data.id.length - 1]];
    param.index = { id: data.id[data.id.length - 1] };
    params.push(param);

    try {
      rtn = await cache.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {ParamArrID} data
   * @returns {Promise<Object>}
   */
  async selectDBOnly(data) {
    let rtn = null;

    // ?? = ? : `id` = '${key}'
    // ?  = ? : 'id' = '${key}'
    const param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.selectTbUserRow;
    param.binds = ['id', data.id[0]];
    rtn = await db.row(param);

    return rtn;
  }

  /**
   *
   * @param {number} cnt
   * @returns {Promise<{executed: Array<Object>, created: ParamArrID}>}
   */
  async insertDBOnly(cnt) {
    let rtn = { executed: null, created: { id: [] } };

    const params = [];
    let param = null;

    let id = null;
    let name = null;

    for (let i = 0; i < cnt; i++) {
      id = uniqid();
      rtn.created.id.push(id);
      name = id.concat('-name'); // uniqid.time()

      if (i % 2 == 0) {
        // insert with array binding
        param = new types.QuerySet();
        param.label = this.label;
        param.query = queries.user.insertTbUserBindArr;
        param.binds = [id, name, times.datetime(), times.datetime(), null, 0, 0, null, 0, 0, 0, 0, null, null, null, 0, null, null];
        // param.index = { id: id }; // for Cache
        params.push(param);
      } else if (i % 2 == 1) {
        // insert with object binding
        param = new types.QuerySet();
        param.label = this.label;
        param.query = queries.user.insertTbUserBindObj;
        param.binds = {
          id: id,
          name: name,
          time_created: times.datetime(),
          time_login: times.datetime(),
          time_logout: null,
          status_perm: 0,
          status_join: 0,
          club: null,
          exp: 0,
          gold: 0,
          gem_paid: 0,
          gem_free: 0,
          country: null,
          token: null,
          lang: null,
          os: 0,
          v: null,
          bv: null,
        };
        // param.index = { id: id }; // for Cache
        params.push(param);
      }
    }

    try {
      rtn.executed = await db.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {ParamArrID} data
   * @returns {Promise<Array<Object>>}
   */
  async updateDBOnly(data) {
    let rtn = null;

    const param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.updateTbUserExp;
    param.binds = [1, data.id[0]];
    // param.index = { id: data.id[0] }; // Cache only
    param.shard = 1;

    try {
      rtn = await db.execute([param]);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {ParamArrID} data
   * @returns {Promise<Array<Object>>}
   */
  async deleteDBOnly(data) {
    let rtn = null;

    const params = [];
    let param = null;

    param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.deleteTbUser; // transaction, affected: 1
    param.binds = [data.id[data.id.length - 1]];
    param.usetx = false; // Would be ignored caused by below usetx = true option (same label, same sharding number)
    param.shard = 0;
    params.push(param);

    param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.deleteTbUser; // transaction, affected: 0
    param.binds = [data.id[data.id.length - 1]];
    param.usetx = true;
    param.shard = 1; // Same with above when sharding is only one
    params.push(param);

    try {
      rtn = await db.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {ParamArrID} data
   * @returns {Promise<Object>}
   */
  async select(data) {
    let rtn = null;

    const param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.selectTbUserRow;
    param.binds = ['id', data.id[0]];
    param.index = { id: data.id[0] };
    rtn = await this.row(param);

    return rtn;
  }

  /**
   *
   * @param {number} cnt
   * @returns {Promise<{executed: Array<Object>, created: ParamArrID}>}
   */
  async insert(cnt) {
    let rtn = { executed: null, created: { id: [] } };

    const params = [];
    let param = null;

    let id = null;
    let name = null;

    for (let i = 0; i < cnt; i++) {
      id = uniqid();
      rtn.created.id.push(id);
      name = id.concat('-name'); // uniqid.time()

      if (i % 3 == 0) {
        // insert with array binding
        param = new types.QuerySet();
        param.label = this.label;
        param.query = queries.user.insertTbUserBindArr;
        param.binds = [id, name, times.datetime(), times.datetime(), null, 0, 0, null, 0, 0, 0, 0, null, null, null, 0, null, null];
        param.index = { id: id };
        params.push(param);
      } else if (i % 3 == 1) {
        // insert with object binding
        param = new types.QuerySet();
        param.label = this.label;
        param.query = queries.user.insertTbUserBindObj;
        param.binds = {
          id: id,
          name: name,
          time_created: times.datetime(),
          time_login: times.datetime(),
          time_logout: null,
          status_perm: 0,
          status_join: 0,
          club: null,
          exp: 0,
          gold: 0,
          gem_paid: 0,
          gem_free: 0,
          country: null,
          token: null,
          lang: null,
          os: 0,
          v: null,
          bv: null,
        };
        param.index = { id: id };
        params.push(param);
      } else if (i % 3 == 2) {
        // upsert
        param = new types.QuerySet();
        param.label = this.label;
        param.query = queries.user.upsertTbUserBindObj;
        param.binds = {
          id: id,
          name: name,
          time_created: times.datetime(),
          time_login: times.datetime(),
          time_logout: null,
          status_perm: 0,
          status_join: 0,
          club: null,
          exp: 0,
          gold: 0,
          gem_paid: 0,
          gem_free: 0,
          country: null,
          token: null,
          lang: null,
          os: 0,
          v: null,
          bv: null,
          addexp: 1,
        };
        param.index = { id: id };
        params.push(param);
      }
    }

    try {
      rtn.executed = await this.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {ParamArrID} data
   * @returns {Promise<Array<Object>>}
   */
  async update(data) {
    let rtn = null;

    const param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.updateTbUserExp;
    param.binds = [1, data.id[0]];
    param.index = { id: data.id[0] }; // Cache only

    try {
      rtn = await this.execute([param]);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {ParamArrID} data
   * @returns {Promise<Array<Object>>}
   */
  async delete(data) {
    let rtn = null;

    const params = [];
    let param = null;

    param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.deleteTbUser; // transaction, affected: 1
    param.binds = [data.id[data.id.length - 1]];
    param.index = { id: data.id[data.id.length - 1] };
    param.usetx = true;
    params.push(param);

    param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.deleteTbUser; // transaction, affected: 0
    param.binds = [data.id[data.id.length - 1]];
    param.index = { id: data.id[data.id.length - 1] };
    params.push(param);

    try {
      rtn = await this.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }
}

module.exports = User;
