const fs = require('fs');
const https = require('https');
const http = require('http');

const express = require('express');
const { Server } = require('socket.io');

const consts = require('@src/common/consts');
const config = require('@src/common/config');
const logger = require('@src/common/logger');
const Router = require('@src/library/router');

class Socket {
  #engine = /** @type {Server} */ (null);
  #packet = /** @type {Router} */ (null);
  #option = /** @type {(Array|Object)} */ (null);
  #port = /** @type {number} */ (null);
  #session = null;
  #running = false;
  #app = /** @type {express.Express} */ (null);
  #http = /** @type {(http.Server|http.Server)} */ (null);

  constructor() {
    this.#app = express();
    this.#app.use(express.json());
    this.#app.use(express.urlencoded({ extended: true }));

    if (config.ssl.key != null && config.ssl.cert != null) {
      const options = {
        key: fs.readFileSync(config.ssl.key),
        cert: fs.readFileSync(config.ssl.cert),
      };
      this.#http = https.createServer(options, this.#app);
    } else {
      this.#http = http.createServer(this.#app);
    }
  }

  isRunning() {
    return this.#running;
  }

  setPort(port) {
    if (this.#port == null) {
      this.#port = port;
    }
  }

  setOption(options = null) {
    if (this.#option == null) {
      // https://socket.io/docs/v4/server-options/
      this.#option = {
        // path: '/socket.io/',
        // pingInterval: 25000, // ping server to client
        // pingTimeout: 20000, //  pong client to server
        // transports: ['polling', 'websocket'], // default.
        // transports: ['websocket'], // websocket only
        // allowUpgrades: true,
        allowEIO3: true,
        // https://socket.io/docs/v4/handling-cors/
        // cors: {
        //   // origin: ['http://domain-allows-a.com', 'http://domain-allows-b.com'],
        //   // origin: '*', // You can't set withCredentials to true with origin: *, you need to use a specific origin
        //   // methods: ['GET', 'POST'],
        //   // credentials: true,
        // },
        // cors: {} // == Access-Control-Allow-Origin: *
      };

      if (options != null) {
        Object.assign(this.#option, options);
      }
    }
  }

  setPacket(packet) {
    if (this.#packet == null) {
      this.#packet = packet;
    }
  }

  setSession(session) {
    this.#session = session;
  }

  start() {
    if (this.#running == false) {
      this.#engine = new Server(this.#http, this.#option);

      // https://socket.io/docs/v4/faq/#usage-with-express-session
      if (this.#session != null) {
        this.#app.use(this.#session);
        this.#engine.use((socket, next) => {
          this.#session(socket.request, {}, next);
        });
        this.#engine.addListener('connection', (socket) => {
          const sess = socket.request.session;
          // sess.connections++;
          sess.save();
        });
      }

      this.#packet.processForSocket(this.#engine);

      this.#http.listen(this.#port).on('error', (err) => {
        throw err;
      });

      this.#running = true;
    }
  }

  async destroy(signal) {
    await this.#packet.onDestruct();
  }
}

module.exports = Socket;
