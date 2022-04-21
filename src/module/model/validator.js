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

class Validator extends Data {
  constructor() {
    super();
    this.label = 'user';
  }

  label;
}

module.exports = Validator;
