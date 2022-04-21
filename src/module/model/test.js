const uniqid = require('uniqid');

const errors = require('@src/config/errors.json');
const queries = require('@src/config/queries.json');

const consts = require('@src/common/consts');
const types = require('@src/common/types');
const config = require('@src/common/config');
const logger = require('@src/common/logger');
const utils = require('@src/common/utils');
const times = require('@src/common/times');

const db = require('@src/library/db');
const cache = require('@src/library/cache');
const Data = require('@src/library/data');

class Test extends Data {
  constructor() {
    super();
    this.label = 'user';
    this.owner_per_tb_test_sub = 10;
  }

  label;

  /**
   *
   * @param {Object<string,any>} data
   * @returns {string} html tag string
   */
  timesBoard(data) {
    let output = '';

    const nl = '\n';
    const til = '    ~    ';
    const oneDaySec = times.secondsPerDay();
    const env = config.testTime == true ? 'test' : 'real';

    const currTime = times.unixtime();

    let tStart = currTime - (currTime % oneDaySec) - oneDaySec * 7;
    let tFinish = tStart + oneDaySec * 14;

    // 사용 가능 파라미터
    // date_s    = 'YYYY-MM-DD'
    // date_e    = 'YYYY-MM-DD'
    // baseday   = (0:sun ~ 6:sat)
    // interval >= 1
    let date_s = '';
    let date_e = '';
    let baseday = times.weekDay.sunday;
    let interval = oneDaySec - 1;

    if (data['date_s'] !== undefined) {
      //date_s = data['date_s'] + ' 00:00:00';
      date_s = data['date_s'].replace('T', ' ');
      date_s += ':00';
      date_s = date_s.substring(0, 19);
      //output += date_s + nl;
    }
    if (data['date_e'] !== undefined) {
      //date_e = data['date_e'] + ' 00:00:00';
      date_e = data['date_e'].replace('T', ' ');
      date_e += ':00';
      date_e = date_e.substring(0, 19);
      //output += date_e + nl;
    }
    if (data['baseday'] !== undefined) {
      baseday = times.dayFilter(data['baseday']);
    }
    if (data['interval'] !== undefined) {
      interval = utils.toNumberOnly(data['interval']);
      interval = Math.max(interval, 1);
    }

    if (times.validDatetime(date_s) == true && times.validDatetime(date_e) == true) {
      tStart = times.unixtime(date_s);
      tFinish = times.unixtime(date_e);
    }

    tStart = Math.min(tStart, tFinish);
    tFinish = Math.max(tStart, tFinish);

    const tStartInfo = times.datetime(tStart).replace(' ', 'T');
    const tFinishInfo = times.datetime(tFinish).replace(' ', 'T');
    //const tStartInfo = times.datetime(tStart).substring(0, 10);
    //const tFinishInfo = times.datetime(tFinish).substring(0, 10);

    const bcStyles = [
      '.bc_0 { background-color: #D66B67; }',
      '.bc_1 { background-color: #DE965D; }',
      '.bc_2 { background-color: #ECE788; }',
      '.bc_3 { background-color: #B5DB7F; }',
      '.bc_4 { background-color: #8ECDD2; }',
      '.bc_5 { background-color: #8F97CF; }',
    ];

    const wrtrf = String(oneDaySec * 7); // format for wrtr

    output += '<!DOCTYPE html><html><style type="text/css">* { font-family: Consolas, Menlo, Monospace !important; font-size: 8pt !important; }' + nl;
    output += bcStyles.join(nl);
    output += '.current { background-color: #f00; color: #fff; font-weight: bold; }' + nl;
    output += '.frm { margin: 1.0em 0; }' + nl;
    output += '.frm fieldset { border: 0.50em sold menu; border-radius: 0.50em; width: 30%; }' + nl;
    output += '.frm ul li { list-style-type: none; }' + nl;
    output += '.frm label { display: inline-block; width: 10.0em; }' + nl;
    output += '.frm input, .frm.select { margin: 0.10em; }' + nl;
    output += '.frm .submits { text-align: right }' + nl;

    output += '</style>';
    output += '<body>';
    output += '<pre>' + nl;

    //output += '<h3 id="">now: ' + times.datetime(currTime) + '</h3>';
    //output += '<h3>period: ' + times.datetime(tStart) + til + times.datetime(tFinish) + '</h3>' + nl;
    output += '<form method="get" class="frm">';
    output += '<fieldset>';
    output += '<legend><h3><span class="current">Environment: ' + env + ' (' + config.env + ')' + '</span>, now: ' + times.datetime(currTime) + '</h3></legend>';
    output += '<ul>';
    output += '<li><label>start date</label><input type="datetime-local" name="date_s" value="' + tStartInfo + '" /></li>';
    output += '<li><label>finish date</label><input type="datetime-local" name="date_e" value="' + tFinishInfo + '" /></li>';
    output += '<li><label>baseday</label><select name="baseday">';
    let basedaySelected = '';
    for (let i in times.weekDay) {
      basedaySelected = '';
      if (baseday == times.weekDay[i]) {
        basedaySelected = ' selected="selected"';
      }
      output += '<option value="' + times.weekDay[i] + '"' + basedaySelected + '>' + i + '</option>';
    }
    output += '<select></li>';
    output += '<li><label>interval</label><input type="number" name="interval" value="' + interval + '" /></li>';
    output += '<li class="submits"><a href="' + data.baseUrl + data.path + '"><input type="button" value="reset" /></a><input type="submit" type="submit" /></li>';
    output += '</ul>';
    output += '</fieldset>';
    output += '</form>';

    let cycle = oneDaySec;
    //if (times.testTime == false) {
    //    cycle = 86400; // 24 hours
    //    // cycle = 43200; // 12 hours
    //} else {
    //    cycle = 120; // 2 minutes
    //    // cycle = 60; // 1 minutes
    //}

    let offsetStartDaily;

    offsetStartDaily = 0; // 1. no padding
    // offsetStartDaily = serverValue.RESET_DAILY_START; // 2. padding

    let ptc = 0;
    //let ptn = 0;
    let wstr = 0;
    //let wetr = 0;
    let wrtr = 0;
    let wrtr_str = '';
    let dowr = 0;
    let dn = Object.keys(times.weekDay)[times.weekDay.sunday];
    let color = '';

    let currMark = '';
    let wstrBefore = 1; // 1 is meaningless dummy value
    let wpassed = 0; // weekPassed
    let wpacked = 0; // weekPacked

    let str = null;
    const bw = baseday;

    for (let i = tStart; i <= tFinish; i++) {
      // 3. 가공 : 현재 마킹
      currMark = '';
      if (currTime - i > 0 && currTime - i < interval) {
        currMark = ' current';
      }

      str = '';

      // 1. 표본 추출
      ptc = times.periodTimeCurrent(cycle, i, offsetStartDaily);
      //ptn  = times.periodTimeNext(cycle, i, offsetStartDaily);
      wstr = times.weekStartTimeRelative(bw, i, offsetStartDaily);
      //wetr = times.weekNextTimeRelative(bw, i, offsetStartDaily) - 1;
      wrtr = times.weekRemainTimeRelative(bw, i, offsetStartDaily);
      dowr = times.dayOfWeekRelative(i, offsetStartDaily);
      dn = times.dayName(dowr);

      // 2. 가공 : week 묶음
      if (wstrBefore != wstr) {
        wpassed++;
      }
      wstrBefore = wstr;
      wpacked = bcStyles.length - 1 - (wpassed % bcStyles.length);

      // 3. 가공 : 포맷
      wrtr_str = utils.strPadding(String(wrtr), ' ', wrtrf.length, -1);

      // 4. 가공 : output 중간정리
      color = '<span class="bc_' + wpacked + currMark + '">';
      str += color + '[' + times.datetime(i) + '] - ';
      str += '{day: ' + dowr + ' (' + dn + '), ts: ' + i + ', code-daily: ' + ptc + ', code-weekly: ' + wstr + ', sec-remain-nextweek: ' + wrtr_str + '}</span>';

      // 0. forward
      i += interval;
      str += til;

      // 1. 표본 추출
      ptc = times.periodTimeCurrent(cycle, i, offsetStartDaily);
      //ptn  = times.periodTimeNext(cycle, i, offsetStartDaily);
      wstr = times.weekStartTimeRelative(bw, i, offsetStartDaily);
      //wetr = times.weekNextTimeRelative(bw, i, offsetStartDaily) - 1;
      wrtr = times.weekRemainTimeRelative(bw, i, offsetStartDaily);
      dowr = times.dayOfWeekRelative(i, offsetStartDaily);
      dn = times.dayName(dowr);

      // 2. 가공 : week 묶음
      if (wstrBefore != wstr) {
        wpassed++;
      }
      wstrBefore = wstr;
      wpacked = bcStyles.length - 1 - (wpassed % bcStyles.length);

      // 3. 가공 : 포맷
      wrtr_str = utils.strPadding(String(wrtr), ' ', wrtrf.length, -1);

      // 4. 가공 : output 중간정리
      color = '<span class="bc_' + wpacked + currMark + '">';
      str += color + '[' + times.datetime(i) + '] - ';
      str += '{day: ' + dowr + ' (' + dn + '), ts: ' + i + ', code-daily: ' + ptc + ', code-weekly: ' + wstr + ', sec-remain-nextweek: ' + wrtr_str + '}</span>';

      //console.log(str);
      output += str + nl;
    }

    output += '</pre>';
    output += '</body>';
    output += '</html>';

    return output;
  }

  /**
   * @returns {Promise<{tsmilli: number, offset: number}>}
   */
  async syncTimeFromDB() {
    const rtn = { tsmilli: 0, offset: 0 };

    const qs = new types.QuerySet();
    qs.label = this.label;
    qs.query = queries.standard.timeSyncData;
    qs.binds = [];
    const rs = await db.row(qs);
    if (rs != null) {
      rtn.tsmilli = Number(rs['tsmilli']);
      rtn.offset = Number(rs['offset']);
      times.sync(rtn.tsmilli, rtn.offset);
    }

    return rtn;
  }

  async count() {
    let rtn = null;

    const param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.selectTbTestAllRowCountWillBeFixedAutomatically;
    param.index = { id: null };
    rtn = await this.row(param);
    rtn = Object.values(rtn)[0];

    return rtn;
  }

  async select(data) {
    let rtn = null;

    const param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.selectTbTestRow;
    param.binds = ['id', data.id];
    param.index = { id: data.id };
    rtn = await this.row(param);

    return rtn;
  }

  async selects(data) {
    let rtn = null;

    const param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.selectTbTestSubRows;
    param.binds = [data.id_test];
    param.index = { id_test: data.id_test, id: [null] };
    rtn = await this.rows(param);

    return rtn;
  }

  async inserts(ids) {
    let rtn = null;

    const params = [];
    let param = null;

    let uid = null;
    let f1 = null;
    let uid_len = ids.length;
    let uid_sub = null;
    let dt = null;
    let dt_sub = null;
    for (let i = 0, i_len = uid_len; i < i_len; i++) {
      uid = ids[i];
      f1 = uid.concat('-').concat(i);
      dt = null;
      if (i % 2 == 0) {
        dt = times.datetime();
      }

      param = new types.QuerySet();
      param.label = this.label;
      param.query = queries.user.insertTbTest;
      param.binds = { id: uid, f1: f1, f2: i, f3: 0.01, f4: dt };
      param.index = { id: uid };
      param.count = true;
      params.push(param);

      for (let j = 0; j < this.owner_per_tb_test_sub; j++) {
        uid_sub = uid.concat('-').concat(j);
        dt_sub = null;
        if (j % 2 == 0) {
          dt_sub = times.datetime();
        }

        param = new types.QuerySet();
        param.label = this.label;
        param.query = queries.user.insertTbTestSub;
        param.binds = { id_test: uid, id: uid_sub, f1: uid_sub, f2: i, f3: 0.02, f4: dt_sub };
        param.index = { id_test: uid, id: [uid_sub] };
        params.push(param);
      }
    }

    try {
      rtn = await this.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  /**
   *
   * @param {string} id
   * @param {Array<string>} id_tests
   * @returns
   */
  async update(id, id_tests) {
    let rtn = null;

    const params = [];
    let param = null;

    param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.updateTbTest;
    param.binds = [100, 1.23, null, id];
    param.index = { id: id };
    params.push(param);

    param = new types.QuerySet();
    param.label = this.label;
    param.query = queries.user.updateTbTestSub;
    param.binds = [3, 0.07, null, id, id_tests];
    param.index = { id_test: id, id: id_tests };
    params.push(param);

    try {
      rtn = await this.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  async upserts(ids) {
    let rtn = null;

    const params = [];
    let param = null;

    let uid = null;
    let uid_len = ids.length;
    let uid_sub = null;
    for (let i = 0, i_len = uid_len; i < i_len; i++) {
      uid = ids[i];

      param = new types.QuerySet();
      param.label = this.label;
      param.query = queries.user.upsertTbTest;
      param.binds = { id: uid, f1: uid, f2: i, f3: 0.01, f4: times.datetime(), ff2: i, ff3: 0.02 };
      param.index = { id: uid };
      param.count = true;
      params.push(param);

      for (let j = 0; j < this.owner_per_tb_test_sub; j++) {
        uid_sub = uid.concat('-').concat(j);

        param = new types.QuerySet();
        param.label = this.label;
        param.query = queries.user.upsertTbTestSub;
        param.binds = { id_test: uid, id: uid_sub, f1: uid_sub, f2: i, f3: 0.02, f4: times.datetime(), ff2: i, ff3: 0.03 };
        param.index = { id_test: uid, id: [uid_sub] };
        params.push(param);
      }
    }

    try {
      rtn = await this.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }

  async deletes(ids) {
    let rtn = null;

    const params = [];
    let param = null;

    let uid = null;
    let uid_sub = null;
    for (let i = 0, i_len = ids.length; i < i_len; i++) {
      uid = ids[i];

      param = new types.QuerySet();
      param.label = this.label;
      param.query = queries.user.deleteTbTest;
      param.binds = [uid];
      param.index = { id: uid };
      param.count = true;
      param.usetx = true;
      params.push(param);

      for (let j = 0; j < this.owner_per_tb_test_sub; j++) {
        uid_sub = uid.concat('-').concat(j);

        param = new types.QuerySet();
        param.label = this.label;
        param.query = queries.user.deleteTbTestSub;
        param.binds = { id_test: uid, id: uid_sub };
        param.index = { id_test: uid, id: [uid_sub] };
        params.push(param);
      }
    }

    try {
      rtn = await this.execute(params);
    } catch (err) {
      logger.error(err);
      throw utils.raiseError(errors.APPL_ERROR_OCCURRED);
    }

    return rtn;
  }
}

module.exports = Test;
