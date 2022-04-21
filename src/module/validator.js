const uniqid = require('uniqid');

const errors = require('@src/config/errors.json');

const logger = require('@src/common/logger');
const utils = require('@src/common/utils');
const times = require('@src/common/times');

const ModelValidator = require('@src/module/model/validator');
const ModelUser = require('@src/module/model/user');

class Validator {
  constructor() {
    // this.#model_valid = new ModelValidator();
    // this.#model_version = new ModelVersion ...
    // this.#model_maintenance = new ModelMaintenance ...
    // this.#model_user = new ModelUser();
  }

  #model_valid;
  #model_version;
  #model_maintenance;
  #model_user;

  async accessible(args) {
    // let valid = false;
    //
    // valid = utils.validParam(['userid', 'v', 'os'], args, true);
    // if (valid == false) {
    //   throw utils.raiseError(errors.APPL_INVALID_REQUEST_PARAM);
    // }
    //
    // valid = await this.#model_version.accessible(args.v, args.os);
    // if (valid == false) {
    //   throw utils.raiseError(errors.APPL_ACCESS_DENIED_VERSION);
    // }
    //
    // valid = await this.#model_user.isDenied(args.userid);
    // if (valid == false) {
    //   throw utils.raiseError(errors.APPL_ACCESS_DENIED);
    // }
    //
    // valid = await this.#model_user.isAdmin(args.userid);
    // if (valid == false) {
    //   valid = await this.#model_maintenance.is(args.os); // throw error ...
    // }
    //
    // if (valid == false) {
    //   throw utils.raiseError(errors.APPL_ACCESS_DENIED_MAINTENANCE);
    // }
    //
    // valid = await this.#model_user.hasLogin(args.userid); // dual connect ?
    // if (valid == false) {
    //   valid = await this.#model_maintenance.is(args.os); // throw error ...
    // }
  }
}

module.exports = Validator;
