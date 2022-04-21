const http = require('http');
const https = require('https');
const url = require('url');

// const Crypt = require('5no-crypt');

const errorslib = require('@src/library/errorslib.json');

const consts = require('@src/common/consts');
const config = require('@src/common/config');
const logger = require('@src/common/logger');

class Utils {
  constructor() {}

  /**
   *
   * @param {(Object|Array|string)} args
   * @returns {Error} codebase Error and info method
   * @link src/common/requires
   * @example
   * raiseError({code: 10001, message: 'xxx'})
   * raiseError([10001, 'xxx'])
   * raiseError(10001, 'xxx')
   */
  raiseError(...args) {
    let code = null;
    let message = null;

    if (arguments.length == 1 && this.getType(args[0]) == 'object') {
      code = args[0].code;
      message = args[0].message;
    } else if (arguments.length == 1 && this.getType(args[0]) == 'array') {
      code = args[0][0];
      message = args[0][1];
    } else if (arguments.length == 2) {
      code = args[0];
      message = args[1];
    }

    const err = new Error(message);
    // err.code = code; // Property 'code' does not exist on type 'Error'
    err['code'] = code;

    return err;
  }

  /**
   *
   * @param {any} arg
   * @returns {string} undefined | null | boolean | number | string | array | object | function
   */
  getType(arg) {
    let rtn = null;

    if (arg !== null) {
      rtn = typeof arg;
    }

    if (rtn === 'object') {
      // rtn = arg.constructor.name.toLowerCase(); // named(customized) object returns It's name. ex) class User > 'user'

      // const tp = String(arg.constructor);
      // if (tp.indexOf('function Array') == 0) {
      //   rtn = 'array';
      // }

      if (Array.isArray(arg) == true) {
        rtn = 'array';
      }
    }

    return String(rtn);
  }

  /**
   *
   * @param {Array<string>} keys
   * @param {Array<string>} vals
   * @returns {Object} combined with keys and vals
   */
  objectCombine(keys, vals) {
    const rtn = {};

    if (this.arrayUnique(keys).length == keys.length && keys.length == vals.length) {
      for (let i = 0, i_len = keys.length; i < i_len; i++) {
        rtn[keys[i]] = vals[i];
      }
    }

    return rtn;
  }

  /**
   *
   * @param {Object} reference
   * @param {Object} comparer
   * @returns {(Object|null)} different properties from reference by comparer
   */
  objectDiff(reference, comparer) {
    let rtn = null;

    if (Object.keys(reference).length == Object.keys(comparer).length) {
      for (let k in reference) {
        if (reference.hasOwnProperty(k) == true && comparer.hasOwnProperty(k) == true && reference[k] != comparer[k]) {
          if (rtn == null) {
            rtn = {};
          }
          rtn[k] = reference[k];
        }
      }
    }

    return rtn;
  }

  /**
   *
   * @param {Object} obj
   * @returns {Array<string>} { "a": 1, "b": 2 } > ["a", 1, "b", 2]
   */
  objectSpreadToArray(obj) {
    const rtn = [];

    for (let k in obj) {
      rtn.push(k, obj[k]);
    }

    return rtn;
  }

  /**
   *
   * @param {Object} to be modified. call by reference
   * @param {Object} from
   * @returns {(Object|null)} modified properties only
   */
  objectMergeIntersect(to, from) {
    let rtn = null;

    for (let k in from) {
      if (to.hasOwnProperty(k) == true) {
        let v = from[k];
        if (this.getType(v) == 'string') {
          const regexpCalc = new RegExp('^(?:-?[0-9]+(?:\\.([0-9]+))?\\s*[+\\-*/]\\s*' + k + '|' + k + '\\s*[+\\-*/]\\s*-?[0-9]+(?:\\.([0-9]+))?)$');
          const matches = v.match(regexpCalc);
          if (matches != null) {
            // numeric calculation
            let decimal_place_len = 0;
            if (matches[1] != null) {
              decimal_place_len = Math.max(decimal_place_len, String(matches[1]).length);
            }
            if (matches[2] != null) {
              decimal_place_len = Math.max(decimal_place_len, String(matches[2]).length);
            }
            v = v.replace(k, to[k]);
            if (decimal_place_len > 0) {
              // decimal point calculation
              const pow = Math.pow(10, decimal_place_len);
              v = v.replace(/(-?[0-9]+(?:\.[0-9]+)?)/g, '($1 * ' + pow + ')');
              v = '((' + v + ') / ' + pow + ').toFixed(' + decimal_place_len + ')';
            }
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#never_use_eval!
            // v = eval(v);
            v = Function('"use strict"; return Number(' + v + ');')();
          }
        }
        if (to[k] != v) {
          to[k] = v;
          if (rtn == null) {
            rtn = {};
          }
          rtn[k] = v;
        }
      }
    }

    return rtn;
  }

  /**
   *
   * @param {object} asis
   * @param {object} tobe
   * @returns {object} pairs of different key-value
   * @example
   * asis = {a: 1,   b: undefined,       d: 4}
   * tobe = {a: '1', b: 2,         c: 3, d: 4}
   * diffObject(asis, tobe) = { a: '1', b: 2, c: 3 }
   */
  objectMergeDiff(asis, tobe) {
    let rtn = {};

    for (let i in tobe) {
      if (asis.hasOwnProperty(i) == false || asis[i] !== tobe[i]) {
        rtn[i] = tobe[i];
      }
    }

    return rtn;
  }

  /**
   * shuffle the Array
   *
   * @param {Array} arr call by reference
   * @example
   * let a = [1, 2, 3, 4, 5]
   * arrayShuffle(a);
   * now a will be [3, 1, 4, 5, 2] or shuffled ....
   */
  arrayShuffle(arr) {
    let asis = Math.random();
    arr.sort(function () {
      let tobe = Math.random();
      return asis == tobe ? 0 : asis < tobe ? -1 : 1;
    });

    return arr;
  }

  /**
   *
   * @param {Array} array
   * @returns {Array}
   * @example arrayUnique([1, 2, 3, 1, 2]) = [1, 2, 3]
   * @warning elements of Array must be primitive type. shouldn't be complex type.
   */
  arrayUnique(array) {
    return array.filter((value, index, self) => self.indexOf(value) === index);
  }

  /**
   *
   * @param {Array} array
   * @param {number} size
   * @example arrayChunk([1, 2, 3, 4, 5], 3) = [[1, 2, 3], [4, 5]]
   * @link https://dev.to/ryanfarney3/array-chunking-2nl8
   */
  arrayChunk(array, size) {
    //declaring variable 'chunked' as an empty array
    let chunked = [];

    if (this.getType(array) != 'array' || size <= 0 || array.length <= 0) {
      return chunked;
    }

    size = this.toNumberOnly(size);

    //looping through the array until it has been entirely "manipulated" or split into our subarrays
    while (array.length > 0) {
      //taking the spliced segments completely out of our original array
      //pushing these subarrays into our new "chunked" array
      chunked.push(array.splice(0, size));
    }

    //returning the new array of subarrays
    return chunked;
  }

  isEmptyValue(arg) {
    return arg == null || arg == '';
  }

  isEmptyObject(arg) {
    return this.getType(arg) == 'object' && Object.keys(arg).length === 0;
  }

  isEmptyArray(arg) {
    return this.getType(arg) == 'array' && arg.length === 0;
  }

  isNullArray(arg) {
    return this.getType(arg) == 'array' && arg.length > 0 && arg.every((el) => el == null);
  }

  /**
   *
   * @param {string} value
   * @returns {boolean}
   */
  isEncoded(value) {
    try {
      return typeof value == 'string' && decodeURIComponent(value) !== value;
    } catch (err) {
      return false;
    }
  }

  /**
   * parameter validation
   *
   * @param {Array} needles keys for search
   * @param {Object} haystack search container
   * @param {boolean} [valuecheck=false] include value check if true
   * @returns {boolean}
   * @example
   * validParam(['a'],      {"a": 1, "b": null}) > true
   * validParam(['a', 'b'], {"a": 1, "b": null}) > true
   * validParam(['c'],      {"a": 1, "b": null}) > false
   * validParam(['a', 'b'], {"a": 1, "b": null}, true) > false
   * validParam(['a', 'b'], {"a": 1, "b": null}) > true
   */
  validParam(needles, haystack, valuecheck = false) {
    let k = null;

    for (let i = 0, i_len = needles.length; i < i_len; i++) {
      k = String(needles[i]);
      if (haystack.hasOwnProperty(k) == false) {
        return false;
      }
      if (valuecheck == true && this.isEmptyValue(haystack[k]) == true) {
        return false;
      }
    }

    return true;
  }

  /**
   * email address type validation
   * TLD referenced from https://tld-list.com/tlds-from-a-z
   * fixes CPU overload by RegExp (w3resource.com)
   *
   * @param {string} address
   * @returns {boolean}
   * @warning https://www.w3resource.com/javascript/form/email-validation.php will using huge process and fired CPU overload when input is non-email type and more and more the length is longer
   */
  validEmail(address) {
    if (/^\w+(?:[\+\.-\w])*@\w+(?:[\.-]?\w)*(?:\.[a-zA-Z]+)$/.test(address) == true) {
      return true;
    }
    return false;
  }

  /**
   *
   * @param {object} a
   * @param {object} b
   * @returns {boolean}
   */
  sameKeysObject(a, b) {
    let rtn = false;

    let aLen = 0,
      bLen = 0;

    if (this.getType(a) == 'object' && this.getType(b) == 'object') {
      aLen = Object.keys(a).length;
      bLen = Object.keys(b).length;
    }

    if (aLen > 0 && bLen > 0) {
      let cnt = 0;

      for (let k in a) {
        if (b.hasOwnProperty(k) == false) {
          break;
        }
        cnt++;
      }

      if (cnt == aLen) {
        rtn = true;
      }
    }

    return rtn;
  }

  /**
   * alternative String.matchAll in not supported ENV.
   * String.matchAll is supported in Node.js from version 12.0.0
   *
   * @param {string} str
   * @param {RegExp} regexp
   * @returns {Array<Array<any>>}
   */
  matchAll(str, regexp) {
    const array = [];

    str.replace(regexp, function () {
      const arr = [];
      for (let i = 0, i_len = arguments.length - 2; i < i_len; i++) {
        arr.push(arguments[i]);
      }
      array.push(arr);

      return null;
    });

    return array;
  }

  /**
   * forcingly convert to number type
   * 1       > 1
   * 3.14    > 3.14
   * '3.14'  > 3.14
   * Math.PI > 3.141592653589793
   * 0       < undefined, null, false, [], {}, 'ab'
   * 1       < true, '1'
   *
   * @param {any} arg
   * @returns {number}
   */
  toNumberOnly(arg) {
    let rtn = Number(arg);

    if (isNaN(rtn) == true) {
      rtn = 0;
    }

    return rtn;
  }

  /**
   *
   * @param {string} str original string
   * @param {string} pad to padded string
   * @param {number} len length
   * @param {number} dir direction {-1: left, 1: right} default -1
   * @returns {string}
   * @example like a printf
   * strPadding('abc', 'Й', 5)    // [ЙЙabc]
   * strPadding('abc', ' ', 5)    // [  abc]
   * strPadding('abc', ' ', 5, 1) // [abc  ]
   * strPadding('abc', ' ', 2)    // [abc]
   */
  strPadding(str, pad, len, dir = -1) {
    let rtn = String(str);

    if (rtn.length >= len) {
      return rtn;
    }

    pad = pad.repeat(len - rtn.length);

    switch (dir) {
      case -1:
        rtn = pad.concat(rtn);
        break;
      case 1:
        rtn = rtn.concat(pad);
        break;
    }

    return rtn;
  }

  /**
   *
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  randomNumber(min, max) {
    if (min == max) {
      return min;
    } else {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }
  }

  /**
   * ::ffff:1.2.3.4 > 1.2.3.4
   *
   * @param {string} ipstr request.connection.remoteAddress
   * @returns {string} ip version 4 format a.b.c.d
   */
  ipv4(ipstr) {
    return ipstr.substring(ipstr.lastIndexOf(':') + 1);
  }

  /**
   *
   * @param {any} recv socket.io Socket OR express.Request
   * @returns {string}
   */
  ipAddrStack(recv) {
    let rtn = null;

    // Socket.request || express.Request
    const req = recv.request || recv;

    rtn = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    return rtn;
  }

  /**
   *
   * @param {any} recv socket.io Socket OR express.Request
   * @returns {string}
   */
  ipAddr(recv) {
    let rtn = this.ipAddrStack(recv);

    rtn = rtn.split(',')[0];
    rtn = this.ipv4(rtn);

    return rtn;
  }

  /**
   *
   * @param {Array} arr
   * @param {string} ip
   * @returns {boolean}
   * @example
   * ipInArray([ '1.1.1.1', '1.2.3.4', '5.6', '7.', ... ], '1.2.3.5') > false
   * ipInArray([ '1.1.1.1', '1.2.3.4', '5.6', '7.', ... ], '7.7.7.7') > true
   */
  ipInArray(arr, ip) {
    let rtn = false;

    if (arr.indexOf(ip) > -1) {
      rtn = true;
    }

    for (let i = 0, i_len = arr.length; i < i_len; i++) {
      if (rtn == true) {
        break;
      }
      if (ip.startsWith(arr[i]) == true) {
        rtn = true;
      }
    }

    return rtn;
  }

  // https://gist.github.com/jppommet/5708697
  int2ip(ipInt) {
    return (ipInt >>> 24) + '.' + ((ipInt >> 16) & 255) + '.' + ((ipInt >> 8) & 255) + '.' + (ipInt & 255);
  }
  ip2int(ip) {
    return (
      ip.split('.').reduce(function (ipInt, octet) {
        return (ipInt << 8) + parseInt(octet, 10);
      }, 0) >>> 0
    );
  }

  async sleep(milliSec) {
    return new Promise((resolve) => setTimeout(resolve, milliSec));
  }

  spinlock(milliSec) {
    const n = Date.now();
    while (Date.now() - n <= milliSec) {}
  }

  // getTableNumber(code) {
  //   return Math.floor(code / 1000000);
  // }

  // getTableCategory(code) {
  //   return Math.floor(code / 1000) % 1000;
  // }

  // getTableIndex(code) {
  //   return code % 1000;
  // }

  // getTableCode(type, category, index) {
  //   return type * 1000000 + category * 1000 + index;
  // }

  // /**
  //  * @param {string} v
  //  * @returns {string}
  //  */
  // encrypt(v) {
  //   return Crypt(v, config.cryptSecret).encrypt();
  // }

  // /**
  //  * @param {string} v
  //  * @returns {string}
  //  */
  // decrypt(v) {
  //   return Crypt(v, config.cryptSecret).decrypt();
  // }

  /**
   *
   * @param {string} uri
   * @param {Object?} options
   * @returns {Promise<{ "status": number, "header": Object, "data": (string|Object) }>}
   * @example
   * curl('http://domain.com/path?a=1&b=2', {
   *   method?: {string},      // GET | POST | ...
   *   header?: {Object},      // { 'Content-Type': ..., ... }
   *   data?: {string|Object}, // 'a=1&b=2' | { a: 1, b: 2 } (application/x-www-form-urlencoded)
   *   timeout?: {number}      // milliseconds
   *   safeUDP?: {boolean}     // disconnect immediately after send data. no wait for response
   * })
   */
  async curl(uri, options = null) {
    const rtn = { status: null, header: null, data: '' };
    const resource = new url.URL(uri); // https://nodejs.org/api/url.html#url-strings-and-url-objects

    let send_data = '';

    const option = {
      host: resource.host,
      hostname: resource.hostname,
      port: resource.port,
      path: resource.pathname + resource.search,
      method: 'GET',
      headers: {
        'Content-Length': 0,
      },
      timeout: config.timeout.default,
    };
    if (options != null) {
      if (options.method != null) {
        option.method = options.method;
      }
      if (options.header != null) {
        Object.assign(option.headers, options.header);
      }
      if (options.data != null) {
        const data_type = this.getType(options.data);
        if (data_type == 'string') {
          // 'a=1&b=2'
          send_data = options.data;
        } else if (data_type == 'object') {
          // { a: 1, b: 2 }
          for (let k in options.data) {
            send_data = send_data.concat('&').concat(k).concat('=').concat(options.data[k]);
          }
          send_data = send_data.substring(1);
        }
      }
      if (options.timeout != null) {
        option.timeout = this.toNumberOnly(options.timeout);
      }
    }

    if (send_data.length > 0) {
      option.headers['Content-Type'] = consts.VALUE.MIME_BODYDATA;
      option.headers['Content-Length'] = Buffer.byteLength(send_data);
    }

    let caller = null;
    if (resource.protocol == 'https:') {
      caller = https;
    } else {
      caller = http;
    }

    const promise = new Promise((resolve, reject) => {
      const req = /** @type {http.ClientRequest} */ (
        caller.request(
          option,
          /** @type {function(http.IncomingMessage): void} */ (res) => {
            rtn.status = res.statusCode;
            rtn.header = res.headers;

            res.on('data', (chunk) => {
              rtn.data += chunk;
            });
            res.on('end', () => {
              // prettier-ignore
              if (
                  option.headers['Content-Type'] == consts.VALUE.MIME_JSON
               || (res.headers['content-type'] != null && res.headers['content-type'].indexOf(consts.VALUE.MIME_JSON) > -1)
              ) {
                try {
                  rtn.data = JSON.parse(rtn.data);
                } catch (err) {
                  reject(err);
                }
              }
              resolve(rtn);
            });
          },
        )
      );
      req.on('timeout', () => {
        // https://nodejs.org/api/http.html#event-timeout
        req.destroy(); // req.abort() deprecated
        reject(this.raiseError(errorslib.SYS_TIMEOUT_CURL));
      });
      if (options != null && options.safeUDP === true) {
        req.on('socket', (socket) => {
          socket.on('ready', () => {
            // https://nodejs.org/api/net.html#event-ready
            socket.destroy();
            resolve(rtn);
          });
          socket.on('error', (err) => {
            reject(err);
          });
        });
      }
      req.on('error', (err) => {
        reject(err);
      });
      if (send_data.length > 0) {
        req.write(send_data);
      }
      req.end();
    });

    return promise;
  }
}

module.exports = new Utils();
