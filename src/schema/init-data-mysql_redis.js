/**
 * @see mysql mysqldump for Windows
 * @link https://downloads.mysql.com/archives/community/
 *
 * @see redis-cli for Windows
 * @link https://github.com/microsoftarchive/redis/releases
 */

const readline = require('readline');
const util = require('util');
const fs = require('fs');
const path = require('path');
const exec = util.promisify(require('child_process').exec);

function writeLog(str) {
  console.log(str);
}

// prettier-ignore
class InitData {
    constructor() {
        this.stdout = null;
        this.stderr = null;
        this.envName = null;
        this.refPath = null;
        this.schemaPath = null;
        this.configReference = null;
        this.overwriteTarget = null;
        this.restores = { rds: [] };
        this.tempDir = 'temp-' + Math.floor(Date.now() / 1000).toString();
        // this.tempRemoveAfter = true;
        this.tempRemoveAfter = false;
        this.topicId = null;
        this.separator = '----------------------------------------------------------------------------------------------------------------------';

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
    }

    logSeparator(str) {
        writeLog(this.separator + ' ' + str);
    }

    async ready(rscPath, rscMain, rscSub, restores = null) {
        try {
            const raedyPath         = rscPath + path.sep + 'env';

            if (fs.existsSync(raedyPath) == false)            { throw new Error(raedyPath            + ' doesn\'t exists'); }

            const envNames = fs.readdirSync(raedyPath, { withFileTypes: true });
            if (envNames.length != 1)                         { throw new Error(raedyPath            + ' must include just only one file'); }
            this.envName = envNames[0].name;

            this.refPath         = rscPath + path.sep + 'src' + path.sep + 'config' + path.sep + this.envName;
            this.schemaPath      = rscPath + path.sep + 'src' + path.sep + 'schema';
            this.configReference = this.refPath + path.sep + rscMain;
            this.overwriteTarget = this.refPath + path.sep + rscSub;

            if (fs.existsSync(this.refPath)         == false) { throw new Error(this.refPath         + ' doesn\'t exists'); }
            if (fs.existsSync(this.schemaPath)      == false) { throw new Error(this.schemaPath      + ' doesn\'t exists'); }
            if (fs.existsSync(this.configReference) == false) { throw new Error(this.configReference + ' doesn\'t exists'); }
            if (fs.existsSync(this.overwriteTarget) == false) { throw new Error(this.overwriteTarget + ' doesn\'t exists'); }

            if (restores != null && restores.rds != null)     { this.restores.rds = restores.rds; }
        } catch (err) {
            throw err;
        }
    }

    async _initDB(k, confObj) {
        try {
            let commandEach = '';
            let commandEachFile = '';
            let commandFull = '';

            let restoreRef = null;
            const restoreRefs = this.restores.rds.filter((v) => { return v.startsWith(confObj.dbnm + '.') });

            // 1. restore : ready
            for (let i = 0, iLen = restoreRefs.length; i < iLen; i++) {
                restoreRef = restoreRefs[i].split('.');
                if (restoreRef[1].length == 0) { continue; }

                commandEach = 'mysqldump -h ' + confObj.host + ' -P ' + confObj.port + ' -u ' + confObj.user + ' -p' + confObj.pass + ' ' + restoreRef[0] + ' ' + restoreRef[1];
                commandEachFile = this.tempDir + path.sep + restoreRefs[i] + '.sql';
                commandFull = commandEach + ' > ' + commandEachFile;
                writeLog(commandFull + ' (' + k + ')');
    
                await exec(commandFull);
            }

            // 2. initialize
            commandEach = 'mysql -h ' + confObj.host + ' -P ' + confObj.port + ' -u ' + confObj.user + ' -p' + confObj.pass;// + ' ' + confObj.dbnm;
            commandEachFile = this.schemaPath +  path.sep + confObj.dbnm + '.sql';
            commandFull = commandEach + ' < ' + commandEachFile;
            writeLog(commandFull + ' (' + k + ')');

            await exec(commandFull);
            
            // 3. basedata after initialize
            commandEachFile = this.schemaPath +  path.sep + confObj.dbnm + '-DML.sql';
            if (fs.existsSync(commandEachFile) == true) {
                commandFull = commandEach + ' ' + confObj.dbnm + ' < ' + commandEachFile;
                writeLog(commandFull + ' (' + k + ')');
                await exec(commandFull);
            }

            // 4. restore : execute
            for (let i = 0, iLen = restoreRefs.length; i < iLen; i++) {
                restoreRef = restoreRefs[i].split('.');
                if (restoreRef[1].length == 0) { continue; }

                commandEach = 'mysql -h ' + confObj.host + ' -P ' + confObj.port + ' -u ' + confObj.user + ' -p' + confObj.pass + ' ' + restoreRef[0];
                commandEachFile = this.tempDir + path.sep + restoreRefs[i] + '.sql';
                commandFull = commandEach + ' < ' + commandEachFile;
                writeLog(commandFull + ' (' + k + ')');
    
                await exec(commandFull);

                // 5. remove file for restored
                if (this.tempRemoveAfter == true) {
                    fs.unlinkSync(commandEachFile);
                }
            }
        } catch (err) {
            throw err;
        }
    }

    async _initCache(k, confObj) {
        try {
            let commandEach = '';
            let commandFull = '';

            commandEach = 'redis-cli -h ' + confObj.host + ' -p ' + confObj.port + ' -n ' + confObj.dbnm;
            commandFull = commandEach + ' flushdb';
            writeLog(commandFull + ' (' + k + ')');
            await exec(commandFull);
        } catch (err) {
            throw err;
        }
    }

    async init() {
        try {
            // const conf = require(this.configReference);
            const conf = require('../common/config');
            let confObj = null;

            if (conf.isRealEnv() == true) {
                writeLog("**********************************************");
                writeLog("*                                            *");
                writeLog("*            !!!!! Caution !!!!!             *");
                writeLog("*        this is not test Environment        *");
                writeLog("*          Do you want to continue ?         *");
                writeLog("*                                            *");
                writeLog("**********************************************");

                const question = util.promisify(this.rl.question).bind(this.rl);
                const answer = await question('(Y / N) : ');

                if (answer !== 'Y') {
                    process.exit(1);
                }
            }

            let db = conf.db.w;
            let cache = {
                ...conf.pubsub.rw,
                ...conf.session.rw,
                ...conf.cache.rw
            };

            // create resource for restore
            if (this.restores.rds.length > 0 && fs.existsSync(this.tempDir) == false) {
                fs.mkdirSync(this.tempDir);
            }

            this.logSeparator('initialize db start');
            for (let k in db) {
                confObj = db[k];
                if (Array.isArray(confObj) == true) {
                    for (let i = 0, iLen = confObj.length; i < iLen; i++) {
                        await this._initDB(k + '-' + i, confObj[i]);
                    }
                } else {
                    await this._initDB(k, confObj);
                }
            }

            this.logSeparator('initialize cache start');
            for (let k in cache) {
                confObj = cache[k];
                if (Array.isArray(confObj) == true) {
                    for (let i = 0, iLen = confObj.length; i < iLen; i++) {
                        await this._initCache(k + '-' + i, confObj[i]);
                    }
                } else {
                    await this._initCache(k, confObj);
                }
            }

            // remove resource for restore
            if (this.tempRemoveAfter == true && fs.existsSync(this.tempDir) == true) {
                fs.rmdirSync(this.tempDir);
            }
        } catch (err) {
            throw err;
        }
    }
}

// prettier-ignore
/**
 * @see Dont forget the space key should be excluded when options are specified
 *      O : [db_name_1.tb_name_1,db_name_2.tb_name_2]
 *      X : [db_name_1.tb_name_1, db_name_2.tb_name_2]
 */
async function main() {
    const commands = process.argv.slice(2);
    
    if (commands.length == 0) {
        const me = process.argv[1];
        writeLog("+------------------------------------------------------------------------------+");
        writeLog("|                                                                              |");
        writeLog("|  + Warning                                                                   |");
        writeLog("|  - Don't forget the space key should be excluded when options are specified  |");
        writeLog("|  - O : [db_name_1.tb_name_1,db_name_2.tb_name_2]                             |");
        writeLog("|  - X : [db_name_1.tb_name_1, db_name_2.tb_name_2]                            |");
        writeLog("|                                                                              |");
        writeLog("+------------------------------------------------------------------------------+");
        writeLog('usage: node ' + path.basename(me) + ' ${targetDir} [${db-1.table-1},${db-2.table-2},...](optional for restore rds)');
        writeLog('example: node ' + path.basename(me) + ' ../../');
        writeLog('example: node ' + path.basename(me) + ' ../../ [db_name_1.tb_name_1,db_name_2.tb_name_2,db_name_3.tb_name_3]');
        process.exit(1);
    }

    // args[0] : target directory
    const targetDir = commands[0].replace(/\/$/, '');

    // args[1] : Optional for restore RDS
    const restores = { rds: null };
    let restoreRDS = commands[1];
    if (restoreRDS !== undefined && restoreRDS.startsWith('[') == true && restoreRDS.endsWith(']') == true) {
        restoreRDS = restoreRDS.substring(1, restoreRDS.length - 2);
        if (restoreRDS.length > 0) {
            restores.rds = restoreRDS.split(',');
        }
    }

    try {
        const initdata = new InitData();
        await initdata.ready(
            targetDir,
            'config.json',
            'config.contract.json',
            restores
        );

        await initdata.init();
        // initdata.logSeparator('finished all jobs. Don\'t Forgot [commit the ' + initdata.overwriteTarget + ' !]');
        initdata.logSeparator('finished all jobs.');
        // initdata.logSeparator(' Warning !!! ');
    } catch (err) {
        console.error(err);
    }

    process.exit(0);
}

main();
