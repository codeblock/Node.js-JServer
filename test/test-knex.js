// const knex = require('D:/Users/tonic/Documents/Languages/Node.js/server/node_modules/knex/types/index')({
// const knex = require('../node_modules/knex/lib')({

const knex_config = {
  client: 'mysql',
  connection: {
    host: 'db-master.host',
    port: 3306,
    user: 'test',
    password: 'test',
    database: 'test',
  },
  log: {
    warn(message) {
      console.log(message);
    },
    error(message) {
      console.log(message);
    },
    deprecate(message) {
      console.log(message);
    },
    debug(message) {
      console.log(message);
    },
  },
};

async function fn_00() {
  // 1.
  // const conn = require('../node_modules/knex')(knex_config);

  // 2.
  const knex = require('knex');
  const conn = knex(knex_config);

  const rs = await conn.raw('select nOw() f123 from dual');
  console.log(rs[0]);
}

async function fn_01() {
  const knex = require('knex');
  const conn = knex({ client: 'mysql' });

  // const pstmt = 'INSERT INTO tb_user (id, name) VALUES (:id, :name) ON DUPLICATE KEY UPDATE name = :rename';
  // const binds = { id: 'id-1', name: 'name-1', rename: 'CONCAT(name,"-")' };
  const pstmt = 'INSERT INTO tb_user (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = CONCAT(name,"-")';
  const binds = ['id-1', 'name-1'];
  const stmt = conn.raw(pstmt, binds);
  console.log(stmt.toQuery());
}

async function fn_02() {
  const knex = require('knex');
  const conn = knex({ client: 'mysql' });

  const a = conn.raw('SELECT * FROM a = ?', 1);
  console.log('a: ' + a.toQuery());
  const b = conn.raw('SELECT * FROM a = ?', [2]);
  console.log('b: ' + b.toQuery());
  // const c = conn.raw('SELECT * FROM a = 3', 3); // error
  // console.log('c: ' + c.toQuery());
  // const d = conn.raw('SELECT * FROM a = 4', null); // error
  // console.log('d: ' + d.toQuery());
  // const e = conn.raw('SELECT * FROM a = 5', ''); // error
  // console.log('e: ' + e.toQuery());
  const f = conn.raw('SELECT * FROM a = 6', { a: 1 });
  console.log('f: ' + f.toQuery());
  const g = conn.raw('SELECT * FROM a = 7', []);
  console.log('g: ' + g.toQuery());
  const h = conn.raw('SELECT * FROM a = 8', undefined);
  console.log('h: ' + h.toQuery());
}

async function main() {
  // await fn_00();
  // await fn_01();
  await fn_02();

  process.exit();
}

main();
