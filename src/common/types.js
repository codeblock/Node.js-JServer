class QuerySet {
  /** @type {string}         */ label;
  /** @type {string}         */ query;
  /** @type {(Array|Object)} */ binds;
  /** @type {Object}         */ index;
  /** @type {number}         */ shard;
  /** @type {boolean}        */ usetx;
  /** @type {boolean}        */ count;
  /** @type {boolean}        */ nottl;
  /**
   *
   * @param {?QuerySet} args
   * @example
   * // ----------------- requirements DB/Cache
   * label : section of data. e.g. DB name
   * query : SQL (with binding placeholder)
   * binds : [binds=[]] binding values if in query
   * // ----------------- requirements Cache
   * index : index fields. Criteria for Cache-key Names and command behaviors.
   *         reference: src/library/data/lexer.getTypes
   *         e.g. "{id: ${id}} / {name: null} / {id_event: ${id_event}, {id_user: ${id_user}, code: null} / ..."
   * // ----------------- optional
   * shard : [shard=0] for DB. Sharding number if many shardings start from 1. (shard=0 : seeking the all shardings)
   * usetx : [usetx=false] for DB/Cache. true for using transaction (only for INSERT / UPDATE / DELETE)
   * count : [count=false] for Cache. true for counting container (only for INSERT / DELETE)
   * nottl : [nottl=false] for Cache. true for No TimeToLive forcingly
   */
  constructor(args = null) {
    this.label = args != null && args.label != null ? args.label : null;
    this.query = args != null && args.query != null ? args.query : null;
    this.binds = args != null && args.binds != null ? args.binds : [];
    this.index = args != null && args.index != null ? args.index : null;
    this.shard = args != null && isNaN(args.shard) == false ? Math.max(0, Number(args.shard)) : 0;
    this.usetx = args != null && args.usetx === true ? true : false;
    this.count = args != null && args.count === true ? true : false;
    this.nottl = args != null && args.nottl === true ? true : false;
  }
}

// prettier-ignore
const LexSetTYPES = {        // owner : target
  SIMPLE_FOR_CNT: 1,         //     n : 1
  SIMPLE_FOR_ONE: 2,         //     1 : 1
  OBJECT_FOR_ONE_TO_ONE: 3,  //     1 : n(1)
  OBJECT_FOR_ONE_TO_SOME: 4, //     1 : n(n)
  OBJECT_FOR_ONE_TO_ALL: 5,  //     1 : n(all)
};
Object.freeze(LexSetTYPES);

class LexSet {
  // static const
  static get TYPES() {
    return LexSetTYPES;
  }

  /** @type {number}        */ types;
  /** @type {string}        */ table;
  /** @type {Array<string>} */ field;
  /** @type {Array<string>} */ index;
  /** @type {string}        */ where;
  /** @type {string}        */ group;
  /** @type {Array<string>} */ order;
  /** @type {Array<number>} */ limit;
  /** @type {boolean}       */ nottl;
  /**
   *
   * @example
   * types : LexSet.TYPES[SIMPLE_FOR_CNT | SIMPLE_FOR_ONE | OBJECT_FOR_ONE_TO_ONE | OBJECT_FOR_ONE_TO_SOME | OBJECT_FOR_ONE_TO_ALL]
   * table : ${table-name} / ${table-name[:index1[:index2[...]]]}
   * field : [field1, field2, ...]
   * index : [index1, ...]
   * where : $.key1 == val1 && $.key2 == val2 && ($.key3 == Math.Floor(val3) || $.key4 != val4) ...
   * group : $.field1, $.field2, ... // GROUP BY
   * order : $.field1, $.field2 DESC, ... // ORDER BY
   * limit : [0, 10] // LIMIT 10 OFFSET 0
   * nottl : true // No TimeToLive forcingly
   */
  constructor() {}
}

module.exports = {
  QuerySet,
  LexSet,
};
