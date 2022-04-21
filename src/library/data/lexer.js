const knex = require('knex');
const linq = require('linq');

const consts = require('@src/common/consts');
const types = require('@src/common/types');
const config = require('@src/common/config');
const logger = require('@src/common/logger');

class Lexer {
  constructor() {
    this.#binder = knex.knex({ client: config.db.vendor });
  }

  #binder = /** @type {knex.Knex} */ (null);

  /**
   *
   * @param {string} pstmt Prepared Statement
   * @param {?(Object|Array)} binds Binding Parameters
   * @returns {string}
   * @example
   * lexer.bindQuery('SELECT 1 f1 FROM DUAL WHERE 1 = ? AND 2 = ?', [2, 3])
   * lexer.bindQuery('SELECT 1 f1 FROM DUAL WHERE 1 = :v1 AND 2 = :v2', { v1: 2, v2: 3 })
   */
  bindQuery(pstmt, binds) {
    let rtn = pstmt;

    if (binds != null && binds != '') {
      const stmt = this.#binder.raw(pstmt, binds);
      rtn = stmt.toQuery();

      if (Array.isArray(binds) == true) {
        binds.length = 0;
      }
    }

    return rtn;
  }

  /**
   *
   * @param {Array<types.QuerySet>} args
   * @returns {Array<types.LexSet>}
   * @see types.QuerySet.query should be changed (binding parameters, remove backtick)
   */
  lex(args) {
    const rtn = [];

    let lexset = null;
    // let query = null;

    for (let i = 0, i_len = args.length; i < i_len; i++) {
      // query = args[i].query; // backup
      args[i].query = this.bindQuery(args[i].query, args[i].binds);
      args[i].query = args[i].query.replace(/`/g, ''); // remove backtick
      lexset = this.process(args[i]);
      rtn.push(lexset);
      // args[i].query = query; // restore
    }

    return rtn;
  }

  /**
   *
   * @param {types.QuerySet} args
   * @returns {types.LexSet}
   */
  process(args) {
    const rtn = new types.LexSet();

    rtn.types = this.getTypes(args);
    rtn.table = this.getTable(args);
    rtn.field = this.getField(args);
    rtn.index = this.getIndex(args);

    const other = this.getOther(args);
    rtn.where = other.where;
    rtn.group = other.group;
    rtn.order = other.order;
    rtn.limit = other.limit;

    rtn.nottl = args.nottl;

    return rtn;
  }

  /**
   *
   * @param {types.QuerySet} args
   * @returns {number}
   */
  getTypes(args) {
    let rtn = null;

    const values = Object.values(args.index);

    if (values.length == 1) {
      if (values[0] === null) {
        // { k1: null }
        rtn = types.LexSet.TYPES.SIMPLE_FOR_CNT;
      } else {
        // { k1: 'v1' },
        rtn = types.LexSet.TYPES.SIMPLE_FOR_ONE;
      }
    } else if (values.length > 1) {
      const values_last = values[values.length - 1];
      if (values_last === null) {
        // { k1: 'v1', k2: 'v2', ..., k10: null }
        rtn = types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ALL;
      } else if (Array.isArray(values_last) == true) {
        if (values_last.length == 1 && values_last[0] === null) {
          // { k1: 'v1', k2: 'v2', ..., k10: [ null ] }
          rtn = types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ALL;
        } else if (values_last.length == 1 && values_last[0] !== null) {
          // { k1: 'v1', k2: 'v2', ..., k10: [ 'v10.0' ] }
          rtn = types.LexSet.TYPES.OBJECT_FOR_ONE_TO_ONE;
        } else if (values_last.length > 1) {
          // { k1: 'v1', k2: 'v2', ..., k10: [ 'v10.0', 'v10.1', ... ] }
          rtn = types.LexSet.TYPES.OBJECT_FOR_ONE_TO_SOME;
        }
      }
    }

    if (rtn == null) {
      logger.error('wrong index configuration: ' + JSON.stringify(args.index));
    }

    return rtn;
  }

  /**
   *
   * @param {types.QuerySet} args
   * @returns {string}
   */
  getTable(args) {
    let rtn = null;

    const regexp = /^(?:SELECT\s+?.+?\s+FROM|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([^\s$]+)/;
    const matches = args.query.match(regexp);
    if (matches != null) {
      rtn = matches[1];
    }

    return rtn;
  }

  /**
   *
   * @param {types.QuerySet} args
   * @returns {Array<string>}
   */
  getField(args) {
    let rtn = [];

    let regexp = null;
    let matches = null;
    let str = null;

    if (args.query.startsWith('SELECT') == true) {
      regexp = /^SELECT\s+(.+)\s+FROM\s/;
      matches = args.query.match(regexp);
      str = matches[1];
    } else if (args.query.startsWith('INSERT') == true) {
      regexp = /^INSERT\s+INTO\s+\S+\s+\(([^)]+)\)\s+VALUES\s/;
      matches = args.query.match(regexp);
      str = matches[1];
    } else if (args.query.startsWith('UPDATE') == true) {
      regexp = /^UPDATE\s+\S+\s+SET\s+(.+)\s+WHERE\s/;
      matches = args.query.match(regexp);
      if (matches != null) {
        str = matches[1].replace(/(\S+)\s*=[^,$]+/g, '$1');
      }
    }

    if (str != null) {
      // str = str.replace(/\s/g, ''); // remove whitespace;
      str = str.replace(/\s*?,\s*/g, ','); // trimStart, trimEnd;
      rtn = str.split(',');
    }

    return rtn;
  }

  /**
   *
   * @param {types.QuerySet} args
   * @returns {Array<string>}
   */
  getIndex(args) {
    const rtn = [];

    for (let k in args.index) {
      // if (typeof args.index[k] == 'string' || typeof args.index[k] == 'number') {
      rtn.push(k);
      // }
    }

    return rtn;
  }

  /**
   *
   * @param {types.QuerySet} args
   * @returns {Object}
   */
  getOther(args) {
    const rtn = { where: null, group: null, order: null, limit: null };

    // const matches = args.query.split(/((?:WHERE|GROUP BY|ORDER BY|LIMIT) .+)$/);
    const matches = args.query.split(/(WHERE|GROUP BY|ORDER BY|LIMIT)/);
    matches.shift(); // remove [SELECT ... FROM ...]
    for (let i = matches.length - 1; i >= 0; i -= 2) {
      if (matches.length > 1) {
        matches[i - 1] += matches[i].trimEnd();
        matches.splice(i, 1);
      }
    }

    // SELECT statements reference : https://dev.mysql.com/doc/refman/8.0/en/select.html
    if (matches.length > 0) {
      for (let i = 0, i_len = matches.length; i < i_len; i++) {
        if (matches[i].startsWith('WHERE ') == true) {
          let where = matches[i].substring(6);

          // ------------------ Reduce CPU usage in Lexer.filter (reduced conditions)
          const glue = '\\s+AND\\s+';
          let regexp_index_str = '';
          for (let k in args.index) {
            // primitive type only
            // @see this.getTypes
            if (typeof args.index[k] == 'number' || typeof args.index[k] == 'string') {
              regexp_index_str = regexp_index_str.concat(glue).concat('`?').concat(k).concat('`?\\s*?=\\s*?[\\\'"]?').concat(args.index[k]).concat('[\\\'"]?\\s*');
            }
          }

          // AND a = 1 AND b = 2 ...
          //     a = 1 AND b = 2 ...
          regexp_index_str = regexp_index_str.substring(glue.length);

          if (regexp_index_str != '') {
            // regexp_index_str = regexp_index_str.concat('(?:').concat(glue).concat(')?'); // a = 1 AND b = 2( AND)?
            regexp_index_str = regexp_index_str.concat('(?:\\s*?AND\\s+)?'); // a = 1 AND b = 2( AND)?
            const regexp_where_except = new RegExp(regexp_index_str);
            where = where.replace(regexp_where_except, '');
          }
          if (where == '') {
            continue;
          }
          // ------------------ Reduce CPU usage in Lexer.filter (reduced conditions)

          rtn.where = where;
          // rtn.where = rtn.where.replace(/([a-zA-Z_]+\s*)=(\s*[^\s$]+)/g, '($.$1 === undefined || $.$1=$2)')
          rtn.where = rtn.where.replace(/([a-zA-Z_]+\s*?)(=|!=|<>|<=?|>=?)(\s*?[^\s$]+)/g, '$.$1$2$3'); // x: '[+\-*/%^&|]', o: '='
          rtn.where = rtn.where.replace(/([a-zA-Z_]+[0-9]*)\s+?IN\s*\(([^)]+)\)/g, '[$2].indexOf($.$1) > -1');
          rtn.where = rtn.where.replace(/\s+?AND\s+?/g, ' && ');
          rtn.where = rtn.where.replace(/\s+?OR\s+?/g, ' || ');
          rtn.where = rtn.where.replace(/\s+?NULL(\s+?|$)/g, ' null$1');
          rtn.where = rtn.where.replace(/(?:(?<!!)\s*?=\s*|\s+?IS\s+?)/g, ' == ');
          rtn.where = rtn.where.replace(/(?:\s*?<>\s*|\s+?NOT\s+?)/g, ' != ');
          rtn.where = rtn.where.replace(/(?:\s+?)(FLOOR|ROUND|CEIL|MIN|MAX|ABS|POW|SQRT)(?:\s*)/g, function () {
            return ' Math.' + arguments[1].toLowerCase();
          });
        } else if (matches[i].startsWith('GROUP BY ') == true) {
          rtn.group = matches[i].substring(9).replace(/\s+/g, '');
          rtn.group = rtn.group.replace(/([^,]+)/g, '$.$1');
        } else if (matches[i].startsWith('ORDER BY ') == true) {
          rtn.order = matches[i].substring(9).replace(/\s+/g, '').split(',');
          for (let j = 0, j_len = rtn.order.length; j < j_len; j++) {
            rtn.order[j] = rtn.order[j].replace(/([^,]+)/g, '$.$1');
          }
        } else if (matches[i].startsWith('LIMIT ') == true) {
          // @todo not yet Oracle type
          if (/[0-9]\s*?(?:,\s*?[0-9])?/.test(matches[i]) == true) {
            rtn.limit = matches[i].substring(6).replace(/\s+/g, '').split(',');
          } else {
            rtn.limit = matches[i].split(/(?:LIMIT\s*?|OFFSET\s*?)/i);
            rtn.limit.shift(); // remove dummy space element
          }
          if (rtn.limit.length == 1) {
            rtn.limit.unshift('0');
          }
          rtn.limit[0] = Number(rtn.limit[0]);
          rtn.limit[1] = Number(rtn.limit[1]);
        }
      }
    }

    return rtn;
  }

  /**
   *
   * @param {types.LexSet} lexset
   * @param {Array<Object>} rs
   * @param {boolean} allfields default true
   * @returns {Array<Object>} rs filtered result set
   */
  filter(lexset, rs, allfields = true) {
    let rtn = rs;

    if (lexset.where != null || lexset.group != null || lexset.order != null || lexset.limit != null) {
      let tbl = linq.from(rs);
      if (lexset.where != null) {
        tbl = tbl.where(lexset.where);
      }
      if (lexset.group != null) {
        const fields = {};
        let field = null;
        let field_k = null;
        let field_v = null;
        let matched_fn = null;
        let matched_alias = null;

        for (let i = 0, i_len = lexset.field.length; i < i_len; i++) {
          field = lexset.field[i];
          field_k = field;
          matched_fn = field.match(consts.REGEXP.FN);
          if (matched_fn != null) {
            field_k = matched_fn[2];
          }
          fields[field_k] = field;
        }
        tbl = tbl.groupBy(lexset.group, null, (key, group) => {
          const grp = {};
          let grp_fn = null;

          for (let k in fields) {
            field = fields[k];
            // field_k = k; // fieldname or alias
            field_k = field; // fieldname wrapped function (original fieldname)
            field_v = '$.'.concat(k);
            matched_fn = field.match(consts.REGEXP.FN);
            matched_alias = field.match(consts.REGEXP.FIELD_ALIAS);
            if (matched_alias != null) {
              field_k = matched_alias[1];
            }
            if (matched_fn != null) {
              grp_fn = matched_fn[1].toLowerCase();
              if (grp_fn == 'avg') {
                grp_fn = 'average';
              }
              grp[field_k] = group[grp_fn](field_v);
            } else {
              grp_fn = 'select';
              grp[field_k] = group[grp_fn](field_v).elementAt(0);
            }
          }

          return grp;
        });
      }
      if (lexset.order != null) {
        for (let i = 0, i_len = lexset.order.length; i < i_len; i++) {
          if (lexset.order[i].endsWith('DESC') == true) {
            const param = () => lexset.order[i].replace(/ DESC\s*$/, '');
            tbl = tbl.orderByDescending(param);
          } else {
            const param = () => lexset.order[i].replace(/ ASC\s*$/, '');
            tbl = tbl.orderBy(param);
          }
        }
      }
      if (lexset.limit != null) {
        tbl = tbl.skip(lexset.limit[0]).take(lexset.limit[1]);
      }
      rtn = tbl.toArray();
    }

    if (allfields == false && rtn.length > 0 && lexset.group == null && (lexset.field.length == 1 && lexset.field[0] == consts.VALUE.ALL) == false) {
      const fields_aliases = {};
      let field = null;
      let field_info = null;

      for (let i = 0, i_len = lexset.field.length; i < i_len; i++) {
        field = lexset.field[i];
        field_info = field.split(consts.REGEXP.FIELD_ALIAS); // 0: origin, 1: alias

        if (field_info[1] == null) {
          fields_aliases[field_info[0]] = field_info[0];
        } else {
          fields_aliases[field_info[0]] = field_info[1];
        }
      }

      for (let i = rtn.length - 1; i >= 0; i--) {
        for (let k in rtn[i]) {
          if (fields_aliases[k] == null) {
            delete rtn[i][k];
          } else if (fields_aliases[k] != k) {
            rtn[i][fields_aliases[k]] = rtn[i][k];
            delete rtn[i][k];
          }
        }
      }
    }

    return rtn;
  }
}

module.exports = new Lexer();
