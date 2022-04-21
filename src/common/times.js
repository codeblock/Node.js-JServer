const consts = require('@src/common/consts');
const config = require('@src/common/config');
const logger = require('@src/common/logger');

const RESET_DAILY_START = 0; // unit : seconds

let secondsOneDayTest = 600; // 60 * 10; // 10 minutes
let secondsOneDayReal = 86400; // 60 * 60 * 24;

let millisecondsOffsetTZ = new Date().getTimezoneOffset() * 60 * 1000; // UTC offset milliseconds
let millisecondsOffset = 0;

const weekDay = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};
const weekDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

class Times {
  // /**
  //  *
  //  * @see debug
  //  * @description Monitoring the Connection Pool counter
  //  */
  // testTimeMonitor() {
  //   const secondsOffsetTZ = Math.floor(millisecondsOffsetTZ / 1000);
  //   console.log(this.datetime() + ', millisecondsOffset: ' + millisecondsOffset + ', secondsOffsetTZ: ' + secondsOffsetTZ);
  // }

  constructor() {
    // this.sync(Date.now());
    // setInterval(() => this.testTimeMonitor.call(this), 100);
  }

  get weekDay()       { return weekDay; } // prettier-ignore
  get timestampMax()  { return 2147483647; } // prettier-ignore
  get testTime()      { return config.testTime; } // prettier-ignore

  get secondsPerDayReal()  { return secondsOneDayReal; } // prettier-ignore
  get secondsPerDayTest()  { return secondsOneDayTest; } // prettier-ignore
  set secondsPerDayTest(v) { secondsOneDayTest = v;    } // prettier-ignore

  /**
   * When Times class initialized, local timezone to be UTC basically
   * and After sync again, timezone can be changed on your needs
   *
   * @param {number} tsmilli unix timestamp (milliseconds)
   * @param {number} offset timezone offset (seconds)
   * @example MySQL : SELECT FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) tsmilli, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), NOW()) offset FROM DUAL
   */
  sync(tsmilli = 0, offset = 0) {
    const dt_asis = this.datetime();

    tsmilli = isNaN(tsmilli) == true ? 0 : Number(tsmilli);
    offset = isNaN(offset) == true ? 0 : Number(offset);

    const a = millisecondsOffset;
    const b = millisecondsOffsetTZ;
    if (tsmilli > 0) {
      millisecondsOffset = tsmilli - Date.now();
    }
    if (offset > 0) {
      millisecondsOffsetTZ = offset * 1000 + new Date().getTimezoneOffset() * 60 * 1000;
    }
    if (a != millisecondsOffset || b != millisecondsOffsetTZ) {
      const dt_tobe = this.datetime();

      logger.info(consts.PREFIX.LOG_LIB + ' clock is adjusted by { tsmilli: ' + tsmilli + ', offset: ' + offset + ' } : ' + dt_asis + ' > ' + dt_tobe);
    }
  }

  /**
   *
   * @param {string} datestr "YYYY-MM-DD HH:mm:ss"
   * @returns {string} "YYYY-MM-DDTHH:mm:ss"
   * @link https://262.ecma-international.org/11.0/#sec-date-time-string-format
   * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/Date
   */
  toISO8601(datestr) {
    return datestr.replace(' ', 'T');
  }

  /**
   * @returns {Date}
   */
  now() {
    const tsmilli = Date.now() + millisecondsOffset + millisecondsOffsetTZ;
    const dt = new Date(tsmilli);

    return dt;
  }

  /**
   * convert to datetime(YYYY-MM-DD HH:mm:ss) from unix timestamp
   *
   * @param {number} ts unix timestamp
   * @returns {string} datetime
   */
  datetime(ts = 0) {
    let rtn = '0000-00-00 00:00:00';

    if (ts == 0) {
      ts = this.unixtime();
    }

    let date = new Date(ts * 1000);

    let YYYY = String(date.getFullYear());
    let MM = '0' + String(date.getMonth() + 1);
    let DD = '0' + String(date.getDate());
    let HH = '0' + String(date.getHours());
    let mm = '0' + String(date.getMinutes());
    let ss = '0' + String(date.getSeconds());
    // let sss = '00' + String(date.getMilliseconds());

    MM = MM.substring(MM.length - 2, MM.length);
    DD = DD.substring(DD.length - 2, DD.length);
    HH = HH.substring(HH.length - 2, HH.length);
    mm = mm.substring(mm.length - 2, mm.length);
    ss = ss.substring(ss.length - 2, ss.length);
    // sss = sss.substring(sss.length -3, sss.length);

    rtn = YYYY + '-' + MM + '-' + DD + ' ' + HH + ':' + mm + ':' + ss; // + '.' + sss;

    return rtn;
  }

  /**
   * convert to unix timestamp from datetime(YYYY-MM-DD HH:mm:ss)
   *
   * @param {(string|Date)} dt datetime
   * @returns {number} unix timestamp
   */
  unixtime(dt = '0000-00-00 00:00:00') {
    let rtn = 0;

    let date = null;

    if (dt == '0000-00-00 00:00:00') {
      date = this.now();
    } else {
      if (typeof dt == 'string') {
        dt = this.toISO8601(dt);
      }
      date = new Date(dt);
    }

    rtn = Math.floor(date.getTime() / 1000);

    return rtn;
  }

  /**
   * yyyy-MM-dd is valid ?
   *
   * @param {string} dt
   * @returns {boolean}
   */
  validDatetime(dt = '0000-00-00 00:00:00') {
    let rtn = true;

    const delimiter = ',';
    const temp_arr = dt.replace(/[^0-9]/g, delimiter);
    const temp = temp_arr.split(delimiter);

    const year = Number(temp[0]);
    const month = Number(temp[1]);
    const day = Number(temp[2]);

    const myDate = new Date(this.toISO8601(dt));

    if (myDate.getMonth() + 1 != month || myDate.getDate() != day || myDate.getFullYear() != year) {
      rtn = false;
    }

    return rtn;
  }

  /**
   * @returns {number}
   */
  secondsPerDay() {
    if (this.testTime == true) {
      return this.secondsPerDayTest;
    }
    return this.secondsPerDayReal;
  }

  /**
   * When this.testTime is true only
   *
   * @param {number} n
   * @returns {void}
   */
  setSecondsPerDay(n) {
    if (this.testTime == true) {
      n = isNaN(n) == true ? 0 : Number(n);
      if (n > 0 && this.secondsPerDayTest != n) {
        logger.warn('secondsPerDay changed: ' + this.secondsPerDayTest + ' > ' + n);
        this.secondsPerDayTest = n;
      }
    }
  }

  /**
   * @params {number} n weeks
   * @returns {number}
   * @example          real    | dev
   * secondsInWeek(4): 2419200 | 16800
   * secondsInWeek(3): 1814400 | 12600
   * secondsInWeek(2): 1209600 |  8400
   * secondsInWeek(1):  604800 |  4200
   */
  secondsInWeek(n) {
    n = Math.max(1, n);
    if (this.testTime == true) {
      return this.secondsPerDayTest * 7 * n;
    }
    return this.secondsPerDayReal * 7 * n;
  }

  /**
   * @params {number} n minutes
   * @returns {number}
   * @example              real | dev
   * secondsInMinutes(40): 2400 |  16
   * secondsInMinutes(30): 1800 |  12
   * secondsInMinutes(20): 1200 |   8
   * secondsInMinutes(10):  600 |   4
   */
  secondsInMinutes(n) {
    n = Math.max(1, n);
    if (this.testTime == true) {
      return Math.floor((n * 60) / Math.floor(this.secondsPerDayReal / this.secondsPerDayTest));
    }
    return n * 60;
  }

  /**
   * filtering valid day of week
   *
   * @param {number} wd day of week
   * @returns {number} one of range between this.weekDay.sunday and this.weekDay.saturday
   */
  dayFilter(wd) {
    return Math.min(Math.max(this.weekDay.sunday, wd), this.weekDay.saturday); // fix between 0 ~ 6
  }

  /**
   * Thress-letter day of week name
   *
   * @param {number} wd day of week
   * @returns {string}
   */
  dayName(wd) {
    wd = this.dayFilter(wd);
    return weekDayNames[wd];
  }

  /**
   * relative day of week
   *
   * @param {number} timestamp
   * @param {number} padding optional start seconds of the day
   * @returns {number} this.weekDay
   */
  dayOfWeekRelative(timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    let rtn = this.weekDay.sunday;

    const spd = this.secondsPerDay();
    const padded = Math.floor(padding / (this.secondsPerDayReal / spd));

    timestamp = timestamp - padded; // adjust now timestamp
    const modWeekDay = 7;

    if (this.testTime == true) {
      const elapsedSecReal = timestamp % this.secondsPerDayReal; // 가상요일 동작 기준 : 0 ~ 86399
      const elapsedDayTest = Math.floor(elapsedSecReal / this.secondsPerDayTest); // 가상일자 경과일 : 0 ~
      rtn = elapsedDayTest % modWeekDay;
    } else {
      // timestamp = timestamp + offsetDB;
      const dt = new Date(timestamp * 1000);
      rtn = dt.getDay();
    }

    return rtn;
  }

  /**
   * relative week start unix timestamp by bw
   *
   * @param {number} bw base weekday weekDay.sunday ~ weekDay.saturday
   * @param {number} timestamp
   * @param {number} padding optional start seconds of the day
   * @returns {number} unix timestamp
   */
  weekStartTimeRelative(bw = this.weekDay.sunday, timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    let rtn = 0;

    const spd = this.secondsPerDay();
    const padded = Math.floor(padding / (this.secondsPerDayReal / spd));

    bw = this.dayFilter(bw);

    const modWeekDay = 7;

    if (this.testTime == true) {
      const elapsedSecReal = (timestamp - padded) % this.secondsPerDayReal; // 가상요일 동작 기준 : 0 ~ 86399
      // const elapsedDayTest = Math.floor(elapsedSecReal / this.secondsPerDayTest); // 가상일자 경과일 : 0 ~

      let elapsedSecInWeek = (elapsedSecReal % (this.secondsPerDayTest * modWeekDay)) - this.secondsPerDayTest * bw;

      rtn = timestamp - elapsedSecInWeek;
      if (elapsedSecInWeek < 0) {
        rtn -= this.secondsPerDayTest * modWeekDay;
      }
    } else {
      //rtn = this.weekStartTime(bw, timestamp);
      // const dt = new Date(this.datetime(timestamp - padded));
      //const wdAbsolute = dt.getUTCDay();

      const dt = new Date(timestamp * 1000);
      const wdAbsolute = dt.getDay();

      const wdRelative = (wdAbsolute + (modWeekDay - bw)) % modWeekDay;
      const wdDiff = 0 - wdRelative;

      let elapsedSecInWeek = this.secondsPerDayReal * wdDiff - (timestamp % this.secondsPerDayReal);

      rtn = timestamp + padded + elapsedSecInWeek;
    }

    return rtn;
  }

  /**
   * relative week next unix timestamp by bw
   *
   * @param {number} bw base weekday weekDay.sunday ~ weekDay.saturday
   * @param {number} timestamp
   * @param {number} padding optional start seconds of the day
   * @returns {number} unix timestamp
   */
  weekNextTimeRelative(bw = this.weekDay.sunday, timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    let rtn = this.weekStartTimeRelative(bw, timestamp, padding);

    const spd = this.secondsPerDay();
    rtn += spd * 7;

    return rtn;
  }

  /**
   * relative week remain seconds by bw
   *
   * @param {number} bw base weekday weekDay.sunday ~ weekDay.saturday
   * @param {number} timestamp
   * @param {number} padding optional start seconds of the day
   * @returns {number} unix timestamp
   */
  weekRemainTimeRelative(bw = this.weekDay.sunday, timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    let rtn = this.weekNextTimeRelative(bw, timestamp, padding);
    rtn -= timestamp;

    return rtn;
  }

  /**
   * How many days elapsed from '1970-01-01 00:00:00' using with padding
   * similar to dailyCode
   *
   * @param {number} timestamp
   * @param {number} padding optional start seconds of the day
   * @returns {number}
   */
  toDays(timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    const spd = this.secondsPerDay();
    const padded = Math.floor(padding / (this.secondsPerDayReal / spd));

    return Math.floor((timestamp - padded) / spd);
  }

  /**
   * unix timestamp by period in a day
   *
   * @param {number} period unit is seconds
   * @param {number} timestamp
   * @param {number} padding optional start seconds of the day
   * @returns {number}
   * @see returnvalue can be greater than Math.pow(2, 32)
   */
  periodCode(period, timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    if (period == 0) {
      return 0;
    }

    const rtnPrefix = this.toDays(timestamp, padding);

    const spd = this.secondsPerDay();
    const padded = Math.floor(padding / (this.secondsPerDayReal / spd));

    const rtnSuffix = Math.floor(((timestamp - padded) % spd) / period);

    return rtnPrefix * 10000 + rtnSuffix;
  }

  /**
   * unix timestamp by period : elapsed
   *
   * @param {number} period unit is seconds
   * @param {number} timestamp
   * @param {number} padding optional start seconds of the day
   * @returns {number} unix timestamp
   */
  periodTimeElapsed(period, timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    if (period == 0) {
      return 0;
    }

    const spd = this.secondsPerDay();
    const padded = Math.floor(padding / (this.secondsPerDayReal / spd));

    return Math.floor((timestamp - padded) % period);
  }

  /**
   * unix timestamp by period : remains
   *
   * @param {number} period unit is seconds
   * @param {number} timestamp
   * @param {number} padding optional start seconds of the day
   * @returns {number} unix timestamp
   */
  periodTimeRemains(period, timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    return period - this.periodTimeElapsed(period, timestamp, padding);
  }

  /**
   * unix timestamp by period : current
   *
   * @param {number} period unit is seconds
   * @param {number} timestamp
   * @param {number} padding optional start seconds of the day
   * @returns {number} unix timestamp
   */
  periodTimeCurrent(period, timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    return timestamp - this.periodTimeElapsed(period, timestamp, padding);
  }

  /**
   * unix timestamp by period : next
   *
   * @param {number} period unit is seconds
   * @param {number} timestamp
   * @param {number} padding optional start seconds of the day
   * @returns {number} unix timestamp
   */
  periodTimeNext(period, timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    return timestamp + this.periodTimeRemains(period, timestamp, padding);
  }

  /**
   *
   * @param {number} period
   * @param {number} timestamp
   * @param {number} padding
   * @returns {number} unix timestamp
   * @alias this.periodTimeCurrent
   */
  dailyCode(period = this.secondsPerDay(), timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    return this.periodTimeCurrent(period, timestamp, padding);
  }

  /**
   *
   * @param {number} bw
   * @param {number} timestamp
   * @param {number} padding
   * @returns {number} unix timestamp
   * @alias this.weekStartTimeRelative
   */
  weeklyCode(bw = this.weekDay.sunday, timestamp = this.unixtime(), padding = RESET_DAILY_START) {
    return this.weekStartTimeRelative(bw, timestamp, padding);
  }
}

module.exports = new Times();
