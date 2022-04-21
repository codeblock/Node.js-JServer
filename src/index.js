/**
 * Candidate Packages are
 *
 * @description useful packages
 * @see node-schedule (batch job)
 * @see node-graceful
 * @see clone-deep
 * @see nodemailer (sendmail, but verify on cloud service support before use)
 *
 * @description 3rd party utility packages
 * @see firebase-admin (auth, fcm, ...)
 * @see in-app-purchase (IAP)/
 *
 * @description non-npm 3rd parties
 * @link https://www.ip2location.com/
 */

const commands = process.argv.slice(2);
const options = commands.map((v) => v.split('='));
const opts = {};
options.forEach(([k, v]) => (opts[k] = v));

const servername = opts['--server-name'];
const clustercnt = opts['--cluster-cnt'];

if (servername == null) {
  throw new Error('--server-name=${serverName} is required');
}

const os = require('os');
const cluster = require('cluster');

const session = require('express-session');
const sessionStore = require('connect-redis')(session);

// ----- require initializer
require('./common/requires');
const consts = require('@src/common/consts');
const config = require('@src/common/config');
config.setName(servername);
// ----- require initializer

const logger = require('@src/common/logger');

const redislib = require('@src/library/cache/redis');

const Server = require('@src/library/server');
const Router = require('@src/router');

async function main() {
  const redisConns = await redislib.connection('session', config.session.rw);
  const redisClient = redisConns[0];

  const sessionOpts = session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: true,
    // @ts-ignore
    store: new sessionStore({ client: redisClient }),
    // genid: function (req) {
    //   return uniqid();
    // },
    // name: 'sid', // default: connect.sid
    // cookie: {
    //   httpOnly: true,
    //   secure: false
    //
    //   //secure: true
    //   //sameSite: 'none'
    // }
  });

  let server = /** @type {Server} */ (null);

  if (servername == null) {
    // none
  } else if (servername == 'api') {
    server = new Server(consts.SERVERTYPE.HTTP);
    server.setPort(config.port[servername]);
    server.setOption();
    server.setPacket(new Router(servername).getRouter());
    server.setSession(sessionOpts);
  } else if (servername == 'game') {
    server = new Server(consts.SERVERTYPE.SOCKET);
    server.setPort(config.port[servername]);
    server.setOption(); // server.setOption({ cors: {} }); == Access-Control-Allow-Origin: *
    server.setPacket(new Router(servername).getRouter());
    server.setSession(sessionOpts);
  }

  if (server != null) {
    logger.info(`${consts.PREFIX.LOG_LIB} [${process.pid}] Environment: ${config.env}`);
    server.start();
  }

  async function cleanupFn(signal) {
    logger.info(`${consts.PREFIX.LOG_LIB} [${process.pid}] Received on ${signal}`);
    if (server != null) {
      await server.destroy(signal);
    }
    logger.info(`${consts.PREFIX.LOG_LIB} [${process.pid}] Cleaned on ${signal}`);
    process.exit(signal);
  }

  /**
   * @link https://nodejs.org/docs/latest/api/process.html#signal-events
   */
  process.on('SIGINT', cleanupFn); // ^C (Ctrl + C)
  process.on('SIGTERM', cleanupFn); // kill ${pid}
  process.on('SIGHUP', cleanupFn); // unconditionally terminated
}

if (config.cluster[servername] == true) {
  const workers = [];

  // @ts-ignore
  if (cluster.isPrimary == true || cluster.isMaster == true) {
    const cpus = os.cpus();
    let cnt = Math.max(1, cpus.length - 2);
    if (clustercnt != null && clustercnt != '' && isNaN(clustercnt) == false) {
      cnt = Number(clustercnt);
    }
    workers.length = cnt;

    logger.info(consts.PREFIX.LOG_LIB + ' worker-count: ' + cnt + ', master-pid: ' + process.pid + ', master-ppid: ' + process.ppid);

    for (let i = 0; i < cnt; i++) {
      // @ts-ignore
      cluster.fork().on('online', function () {
        // const worker_id = this.id;
        const worker_pid = this.process.pid;
        workers[i] = worker_pid;

        let j = 0;
        for (j = 0; j < cnt; j++) {
          if (workers[j] == null) {
            break;
          }
        }
        if (j == cnt) {
          logger.info(consts.PREFIX.LOG_LIB + ' pids: ' + JSON.stringify(workers));
        }
      });
    }
    // @ts-ignore
  } else if (cluster.isWorker == true) {
    main();
  }
} else {
  main();
}
