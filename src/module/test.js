const uniqid = require('uniqid');

const config = require('@src/common/config');
const logger = require('@src/common/logger');
const utils = require('@src/common/utils');
const times = require('@src/common/times');

const ModelTest = require('@src/module/model/test');

class Test {
  constructor() {
    this.#model_test = new ModelTest();
  }

  #model_test;

  async testData() {
    let rtn = null;

    const uids = new Array(5);
    for (let i = 0, i_len = uids.length; i < i_len; i++) {
      uids[i] = uniqid();
    }

    // 1. insert
    // example [A, B, C, D, E]
    await this.#model_test.inserts(uids);
    logger.debug('utils.arrayUnique: ' + utils.arrayUnique(uids));

    // 2. extract head element, tail elements
    // example A
    const uids_head = uids[0];
    // example [D, E]
    const uids_tail = uids.slice(-2);

    // 3. update
    // example [B-0, B-1]
    const uids_1_subs = [uids[1].concat('-0'), uids[1].concat('-1')];
    await this.#model_test.update(uids[1], uids_1_subs);
    rtn = await this.#model_test.selects({ id_test: uids[1] });
    logger.debug('selects: ' + JSON.stringify(rtn));

    // 4. upsert repeat head element
    // example [A, A, A, A, A]
    uids.fill(uids_head);
    await this.#model_test.upserts(uids);
    // await this.#model_test.upserts(uids.slice(0, 1));
    logger.debug('utils.arrayUnique: ' + utils.arrayUnique(uids));

    // 5. select head element
    rtn = await this.#model_test.select({ id: uids_head });

    // 6. delete tail elements
    const exec = await this.#model_test.deletes(uids_tail);
    logger.debug(JSON.stringify(exec));

    // 7. counting main container
    const cnt = await this.#model_test.count();
    logger.debug('cnt: ' + cnt);

    return rtn;
  }

  /**
   *
   * @returns {Promise<{ before: string, after: string, tsmilli: number, offset: number }>}
   */
  async syncTimeFromDB() {
    const rtn = { before: '', after: '', tsmilli: 0, offset: 0 };

    rtn.before = times.datetime();
    const exec = await this.#model_test.syncTimeFromDB();
    rtn.tsmilli = exec.tsmilli;
    rtn.offset = exec.offset;
    rtn.after = times.datetime();

    return rtn;
  }

  setSecondsPerDay(seconds) {
    let rtn = -1;

    if (config.testTime == false) {
      return rtn;
    }

    seconds = utils.toNumberOnly(seconds);
    if (seconds > 0 && times.secondsPerDayTest != seconds) {
      times.setSecondsPerDay(seconds);
      rtn = seconds;
    }

    return rtn;
  }

  /**
   *
   * @returns {string} datetime
   */
  serverTime() {
    return times.datetime();
  }

  /**
   *
   * @param {Object<string,any>} data
   * @returns {string}
   */
  timesBoard(data) {
    return this.#model_test.timesBoard(data);
  }
}

module.exports = Test;
