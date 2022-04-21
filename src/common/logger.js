const fs = require('fs');
const path = require('path');
const winston = require('winston');
// winston.config.npm.levels : { error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6 }
require('winston-daily-rotate-file');

const config = require('@src/common/config');

// {here}/src/common > {here}/log
const dir_log = path.dirname(path.dirname(__dirname)) + path.sep + config.logDir;
if (fs.existsSync(dir_log) == false) {
  fs.mkdirSync(dir_log);
}

let config_logLevel = winston.config.npm.levels.info;
if (winston.config.npm.levels[config.logLevel] != null) {
  config_logLevel = winston.config.npm.levels[config.logLevel];
}

/**
 *
 * @param {Date} date
 * @returns {string}
 * @see config.logPrefix(level)
 */
function fn_log_time(date) {
  return date.toISOString();
}

// function fn_log_file_name(date) {
//   let YYYY = String(date.getFullYear());
//   let MM = '0' + String(date.getMonth() + 1);
//   let DD = '0' + String(date.getDate());
//   let HH = '0' + String(date.getHours());
//   let mm = null;
//   if (config.logSplit <= 0) {
//     mm = '00';
//   } else {
//     mm = '0' + String(Math.floor(date.getMinutes() / config.logSplit) % config.logSplit);
//   }

//   MM = MM.substring(MM.length - 2, MM.length);
//   DD = DD.substring(DD.length - 2, DD.length);
//   HH = HH.substring(HH.length - 2, HH.length);
//   mm = mm.substring(mm.length - 2, mm.length);

//   return config.getName() + '-' + YYYY + '-' + MM + '-' + DD + '-' + HH + '-' + mm + '.' + config.logExtension;
// };

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.printf(({ level, message }) => {
    return `${message}`;
  }),
  defaultMeta: { service: config.getName() },
  transports: [
    // new winston.transports.File({
    //   filename: dir_log + path.sep + fn_log_file_name(new Date()),
    // }),
    new winston.transports.DailyRotateFile({
      filename: dir_log + path.sep + config.getName() + '-' + '%DATE%.' + config.logExtension,
      frequency: `${config.logSplit}m`,
      datePattern: 'YYYY-MM-DD-HH-mm',
      utc: true,
    }),
    //new winston.transports.Http({ host: 'appl.host', port:8080 }) // > config
  ],
});

if (config.isRealEnv() == false) {
  // for native terminal. ({"outputCapture": "std"} add to vscode launch.json)
  logger.add(new winston.transports.Console());
  // for vscode Debugging
  // const debugmode = process.execArgv.some((arg) => /--inspect(?:-brk)?/.test(arg));
  // if (debugmode == true) {
  //     //
  // }
}

class LoggerWrapper {
  constructor() {
    this.#idx = 0;
  }

  #idx;

  /**
   *
   * @param {number} level
   * @returns {string}
   */
  #levelStringWinston(level) {
    let rtn = null;

    switch (level) {
      case winston.config.npm.levels.error:
        rtn = 'error';
        break;
      case winston.config.npm.levels.warn: // winston.config.syslog.levels.warning
        rtn = 'warn';
        break;
      case winston.config.npm.levels.info:
        rtn = 'info';
        break;
      case winston.config.npm.levels.debug:
        rtn = 'debug';
        break;
      default:
        rtn = 'info';
    }

    return rtn;
  }

  /**
   *
   * @param {number} level
   * @returns {string}
   */
  #levelStringCustom(level) {
    let rtn = this.#levelStringWinston(level);

    return rtn.toUpperCase().concat(' ').substring(0, 5);
  }

  /**
   *
   * @param {string} str
   * @returns {string}
   */
  #levelStringFromWinstonString(str) {
    let level = winston.config.npm.levels[str];
    if (level === undefined) {
      level = winston.config.npm.levels.debug;
    }

    return this.#levelStringCustom(level);
  }

  /**
   *
   * @param {string} levelstr winston.config.npm.levels[level]
   * @param  {...any} data
   */
  #logger(levelstr, data) {
    const prefix_time = fn_log_time(new Date());
    const prefix_level = this.#levelStringFromWinstonString(levelstr);
    const prefixes = `[${prefix_time}][${prefix_level}] `;
    // let body = data;
    // if (typeof data == 'object') {
    //   body = JSON.stringify(body);
    // }
    this.#idx++;
    logger.log(levelstr, prefixes + data);
  }

  error(data) {
    // ---------------------------- debugging : if data is {} when stringify
    // const obj = {};
    // Error.captureStackTrace(obj);
    // console.log(obj.stack);
    // ---------------------------- debugging : if data is {} when stringify
    this.#logger('error', data);
  }

  warn(data) {
    if (winston.config.npm.levels.warn <= config_logLevel) {
      this.#logger('warn', data);
    }
  }

  info(data) {
    if (winston.config.npm.levels.info <= config_logLevel) {
      this.#logger('info', data);
    }
  }

  debug(data) {
    if (winston.config.npm.levels.debug <= config_logLevel) {
      this.#logger('debug', data);
    }
  }

  log(levelstr, data) {
    let level = winston.config.npm.levels[levelstr];
    if (level === undefined) {
      level = winston.config.npm.levels.debug;
    }

    if (level <= config_logLevel) {
      const levelstring = this.#levelStringWinston(level);
      this.#logger(levelstring, data);
    }
  }
}

module.exports = new LoggerWrapper();
