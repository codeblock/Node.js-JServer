const fs = require('fs');
const path = require('path');
// const winston = require('winston');
// winston.config.npm.levels : { error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6 }

class Config {
  #name = null; // set on runtime by arguments

  constructor() {
    this.env = null;

    this.test = null;
    this.testTime = null;
    this.port = null;
    this.cluster = false;
    this.pubsub = {
      vendor: null,
      rw: null, // for read/write
    };
    this.session = {
      vendor: null,
      rw: null, // for read/write
    };
    this.db = {
      verbose: false,
      vendor: null,
      r: null, // for read
      w: null, // for write
    };
    this.cache = {
      verbose: false,
      vendor: null,
      rw: null, // for read/write
    };
    this.dbWriteAsync = false;
    this.dbWriteAsyncExecChunksize = null;
    this.dbWriteAsyncExecChunksizeOnDestroy = null;
    this.cacheTTL = 0;
    this.prefixSocketPacket = {
      s2s: '',
      recv: '',
      send: '',
      error: '',
    };
    this.ssl = {
      key: null,
      cert: null,
    };
    this.logLevel = null;
    this.logDir = null;
    this.logExtension = null;
    this.logSplit = -1;
    this.cryptSecret = null;
    this.sessionSecret = null;
    this.timeout = { default: 0 };

    this.#init();
    this.#load();
  }

  #init() {
    // 1. runtime variable
    this.env = process.env.CFG_ENV;

    // 2. file in directory
    if (this.env == null) {
      // {here}/src/common > {here}/env
      const dir_env = path.dirname(path.dirname(__dirname)) + path.sep + 'env';
      if (fs.existsSync(dir_env) == false) {
        console.log(`${this.logPrefix('FATAL')} Directory doesn't exists [${dir_env}]`);
        process.exit(1);
      }

      const file_env = fs.readdirSync(dir_env);
      if (file_env.length == 0) {
        console.log(`${this.logPrefix('FATAL')} File doesn't exists in [${dir_env}]`);
        process.exit(1);
      } else if (file_env.length == 1) {
        this.env = file_env[0];
      } else {
        console.log(`${this.logPrefix('FATAL')} zero-size file must be only one in [${dir_env}]`);
        process.exit(1);
      }
    }
  }

  #load() {
    // {here}/src/common > {here}/src/config/{env}
    const dir_conf = path.dirname(__dirname) + path.sep + 'config' + path.sep + this.env;
    if (fs.existsSync(dir_conf) == false) {
      console.log(`${this.logPrefix('FATAL')} Directory doesn't exists [${dir_conf}]`);
      process.exit(1);
    }

    const config_file = 'config.json';
    const config_base = dir_conf + path.sep + config_file;
    if (fs.existsSync(config_base) == false) {
      console.log(`${this.logPrefix('FATAL')} File doesn't exists [${config_base}]`);
      process.exit(1);
    }

    try {
      fs.readdirSync(dir_conf).forEach((v, i, arr) => {
        const v_path = path.join(dir_conf, v);

        if (v.endsWith('.json') == false) {
          console.log(`${this.logPrefix('WARN ')} File extension isn't .json [${v_path}]`);
          return;
        }
        const rsc = require(v_path);
        if (v == config_file) {
          Object.assign(this, rsc);
        } else {
          const filename_split = v.split('.'); // config.xxx.json
          const config_ns = filename_split[1]; // xxx
          this[config_ns] = {};
          Object.assign(this[config_ns], rsc);
        }
      });
    } catch (err) {
      console.error(err);
    }
  }

  isRealEnv() {
    const env_reals = ['live', 'production'];
    if (this.test == false || env_reals.indexOf(this.env) > -1 || env_reals.indexOf(process.env.NODE_ENV) > -1) {
      return true;
    }
    return false;
  }

  setName(name) {
    if (this.#name == null) {
      this.#name = name;
    }
  }

  getName() {
    return this.#name;
  }

  logPrefix(level) {
    return `[${new Date().toISOString()}][${level}]`;
  }
}

module.exports = new Config();
