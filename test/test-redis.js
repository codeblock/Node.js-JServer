const path = require('path');
const redis = require('redis');

require('../src/common/requires');
const consts = require('../src/common/consts');
const config = require('../src/common/config');
config.setName(path.basename(__filename));

const redislib = require('../src/library/cache/redis');

const client = redis.createClient({
  socket: {
    host: 'cache.host',
    port: 6379,
  },
  database: 0,
  // db: 0,
});

const N = 100;
let n = 0;
let timer = null;

function dt() {
  const rtn = new Date().toISOString();
  return rtn;
}

function logwrap(...args) {
  console.log(dt() + ' (' + n + ' / ' + N + ') ' + args);
}

client.on('error', (err) => logwrap(consts.PREFIX.LOG_LIB + ' error')); // prevent termination by "Unhandled 'error' event"
// client.on('connect', () => console.log(consts.PREFIX.LOG_LIB + ' connect'));
// client.on('ready', () => console.log(consts.PREFIX.LOG_LIB + ' ready'));
// client.on('end', () => console.log(consts.PREFIX.LOG_LIB + ' end'));
// client.on('reconnecting', () => console.log(consts.PREFIX.LOG_LIB + ' reconnecting'));

async function test_00() {
  clearTimeout(timer);

  try {
    let value = null;

    if (n == 0) {
      await client.connect();
    }
    n++;

    // redis-server restart or stop test

    await client.SET('key', Date.now());
    await client.HSET('h1', ['f1', 'v1', 'f2', 'v2', 'f3', 'v3']);
    // await client.sendCommand(['HSET', 'h1', 'f1', 'v1', 'f2', 'v2', 'f3', 'v3']);
    value = await client.GET('key');
    logwrap('1: ' + value);
    value = await client.HGET('h1', 'f2');
    logwrap('2: ' + value);
    value = await client.HGET('h1', ['f2']);
    logwrap('3: ' + value);
    value = await client.HMGET('h1', ['f1', 'f13', 'f3']);
    logwrap('4: ' + JSON.stringify(value));
    value = await client.HGETALL('h1');
    logwrap('5: ' + JSON.stringify(value));
    value = await client.FLUSHDB();
    logwrap('6: ' + value);
  } catch (err) {
    logwrap('!!!!! error !!!!!' + JSON.stringify(err));
  }

  if (n == N) {
    await client.quit();
  } else {
    timer = setTimeout(test_00, 1000);
  }
}

async function test_01() {
  const params = [
    ['HSET', 'tb_user:1lvc0rt0l06qp76k', 'id', '1lvc0rt0l06qp76k', 'name', 'l06qp76j'],
    ['HSET', 'tb_user:1lvc0rt0l06qp76l', 'id', '1lvc0rt0l06qp76l', 'name', 'l06qp76m'],
  ];
  await client.connect();

  let a = null;
  const tran = client.multi();
  try {
    for (let i = 0, i_len = params.length; i < i_len; i++) {
      tran.addCommand(params[i]);
    }
    a = await tran.exec();
    console.log(a);
    console.log('success');
  } catch (err) {
    a = tran.discard();
    console.log(a);
    console.log('failure');
    console.error(err);
  }

  await client.quit();
}

async function test_02() {
  await client.connect();
  let a = null;
  // a = await client.HMGET('tb_user:1lvc0suwl06v8grw', ['id', 'name']);
  // [ '1lvc0suwl06v8grw', 'l06v8grv' ]

  // a = await client.HMGET('tb_user:1lvc0suwl06v8grw', ['id', 'name']); // name = 'null'
  // [ '1lvc0suwl06v8grw', 'null' ]

  // a = await client.HMGET('tb_user:1lvc0suwl06v8grw', ['id', 'namex']);
  // [ '1lvc0suwl06v8grw', null ]

  // a = await client.HGETALL('tb_user:1lvc0suwl06v8grw');
  // [Object: null prototype] { id: '1lvc0suwl06v8grw', name: 'l06v8grv' }

  // a = await client.HMGET('tb_user:1lvc0suwl06v8grw'); // didn't passed to HMGET arguments
  // [ null ]

  // a = await client.HMGET('tb_user:1lvc0suwl06v8grw', null);
  // [ null ]

  // a = await client.HMGET('tb_user:1lvc0suwl06v8grw', []);
  // (node:30028) UnhandledPromiseRejectionWarning: ReplyError: ERR wrong number of arguments for 'hmget' command ...

  // a = await client.HMGET('AAA');
  // [ null ]

  // a = await client.HGETALL('AAA');
  // [Object: null prototype] {}

  // a = await client.HGET('tb_user_mission:1lvc015rsl0b0gp5a:evt_a:325000001', '326000009');
  // null
  // a = await client.HMGET('tb_user_mission:1lvc015rsl0b0gp5a:evt_a:325000001', ['326000008', '326000009']);
  // [ null, null ]
  // a = await client.HGETALL('tb_user_mission:1lvc015rsl0b0gp5a:evt_a:325000009');
  // [Object: null prototype] {}

  a = await client.HEXISTS('tb_user', 'abc');
  console.log(a);
  a = await client.HEXISTS('tb_test:1lvc0v4gl0p0whda', 'abc');
  console.log(a);
  a = await client.HEXISTS('tb_test:1lvc0v4gl0p0whda', 'f1');
  // console.log(a);

  console.log(a);
}

async function test_03() {
  let conn = null;
  try {
    const conns = await redislib.connection('user');
    conn = conns[0];
    const keys = await redislib.searchKeys(conn, '*', 10);
    console.log(keys);
  } catch (err) {
    console.error(err);
  } finally {
    conn.quit();
    conn.disconnect();
  }
  process.exit(0);
}

async function main() {
  // timer = setTimeout(test_00, 1000);
  // await test_01();
  await test_02();
  // await test_03();
  process.exit();
}

main();
