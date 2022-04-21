const errors = require('@src/config/errors.json');

const utils = require('@src/common/utils');

const ModelUser = require('@src/module/model/user');

class User {
  constructor() {
    this.#model_user = new ModelUser();
  }

  #model_user;

  /**
   *
   * @param {Object<string,any>} data
   * @returns {Promise<(Object|null)>}
   */
  async get(data) {
    let rtn = null;

    const valid = utils.validParam(['id'], data, true);
    if (valid == false) {
      throw utils.raiseError(errors.APPL_INVALID_REQUEST_ID);
    }

    const param = { id: [data.id] };
    rtn = await this.#model_user.select(param);
    // if (rtn != null) {
    //   rtn['items'] = this.#model_item.get ...
    //   rtn['etc'] = this.#model_etc.get ...
    // }

    return rtn;
  }

  /**
   *
   * @returns {Promise<Array<(Object|null)>>}
   */
  async testData() {
    let rtn = Array(16);

    const cnt = 5;

    let data = null;
    // -------------------------------------------------------------- Cache only { k1: '{"k1-1": 1, "k1-2": "v2", "k1-3": null, ...}', k2: ... }
    // data = await this.#model_user.insertCacheGroupOnly(cnt);
    // rtn[0] = data;
    // rtn[1] = await this.#model_user.updateCacheGroupOnly(data.created);
    // rtn[2] = await this.#model_user.deleteCacheGroupOnly(data.created);
    // rtn[3] = await this.#model_user.selectCacheGroupOnly(data.created);
    // --------------------------------------------------------------

    // -------------------------------------------------------------- Cache only { k1: 1, k2: "v2", k3: null, ... }
    // data = await this.#model_user.insertCacheOnly(cnt);
    // rtn[4] = data;
    // rtn[5] = await this.#model_user.updateCacheOnly(data.created);
    // rtn[6] = await this.#model_user.deleteCacheOnly(data.created);
    // rtn[7] = await this.#model_user.selectCacheOnly(data.created);
    // --------------------------------------------------------------

    // -------------------------------------------------------------- DB only
    // data = await this.#model_user.insertDBOnly(cnt);
    // rtn[8] = data;
    // rtn[9] = await this.#model_user.updateDBOnly(data.created);
    // rtn[10] = await this.#model_user.deleteDBOnly(data.created);
    // rtn[11] = await this.#model_user.selectDBOnly(data.created);
    // --------------------------------------------------------------

    // -------------------------------------------------------------- DB with Automatically Cache
    data = await this.#model_user.insert(cnt);
    rtn[12] = data;
    rtn[13] = await this.#model_user.update(data.created);
    rtn[14] = await this.#model_user.delete(data.created);
    rtn[15] = await this.#model_user.select(data.created);
    // --------------------------------------------------------------

    return rtn;
  }
}

module.exports = User;
