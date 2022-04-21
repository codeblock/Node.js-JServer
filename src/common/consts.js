const Consts = {
  SERVERTYPE: {
    NONE: 0,
    HTTP: 1,
    SOCKET: 2,
  },
  PREFIX: {
    LOG_LIB: '>>>>>',
  },
  REGEXP: {
    // String.match
    FN: /(?:([^\(]+)\(([^\)]+)\).*)/, // input: substring(field), 0: substring(field), 1: substring, 2: field
    // String.split
    FIELD_ALIAS: /(?:\s+AS)?\s+(\S+)\s*?$/i, // input: origin AS alias, 0: origin , 1: alias, 2: ""
    // String.replace
    NEGATIVE_ALNUM_AND_UNDER: /[^a-zA-Z0-9_]/g,
  },
  VALUE: {
    ALL: '*',
    NULLSTRING: 'null',
    MIME_JSON: 'application/json',
    MIME_BODYDATA: 'application/x-www-form-urlencoded',
  },
};

/**
 *
 * @param {Object} object
 * @returns {Object}
 * @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
 */
function deepFreeze(object) {
  // Retrieve the property names defined on object
  const propNames = Object.getOwnPropertyNames(object);

  // Freeze properties before freezing self

  for (const name of propNames) {
    const value = object[name];

    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(object);
}

deepFreeze(Consts);

module.exports = Consts;
