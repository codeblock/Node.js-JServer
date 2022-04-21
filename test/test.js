const cluster = require('cluster');
const os = require('os');
const util = require('util');
const worker_threads = require('worker_threads');
const path = require('path');

require('../src/common/requires');
const consts = require('../src/common/consts');
const config = require('../src/common/config');
config.setName(path.basename(__filename));

const utils = require('../src/common/utils');
const times = require('../src/common/times');

function fn_00() {
  const str = util.formatWithOptions({ colors: true }, 'See object %O', { foo: 42 });
  console.log(str);
}

function fn_01() {
  const a = utils.objectCombine([1, 2], ['a', 'b']);
  console.log(a);
}

function fn_02() {
  const obj = { a: 1, b: 2 };
  Object.freeze(obj);
  obj.b = 5;
  obj.c = 6;
  delete obj.a;
  console.log(obj);
}

function fn_03() {
  const arr = new Array(5);
  arr[0] = utils.validParam(['a'], { a: 1, b: null }); // true
  arr[1] = utils.validParam(['a', 'b'], { a: 1, b: null }); // true
  arr[2] = utils.validParam(['c'], { a: 1, b: null }); // false
  arr[3] = utils.validParam(['a', 'b'], { a: 1, b: null }, true); // false
  arr[4] = utils.validParam(['a', 'b'], { a: 1, b: null }); // true
  console.log(arr);

  const ar = [null, null];
  console.log(utils.isNullArray(ar));
}

function fn_04() {
  const arr = ['%EC%9D%BC', '%25EC%259D%25BC', '%2525EC%25259D%2525BC', '%252525EC%2525259D%252525BC', '%25252525EC%252525259D%25252525BC', '%2525252525EC%25252525259D%2525252525BC', '%uC77C'];

  console.log(arr);
  for (let i = 0, i_len = arr.length; i < i_len; i++) {
    while (utils.isEncoded(arr[i]) == true) {
      arr[i] = decodeURIComponent(arr[i]);
    }
  }
  console.log(arr);

  const str = 'asdf3sgh6544dfg7';
  const regexp = /[a-z]\d/g;
  let a = null;

  a = [...str.matchAll(regexp)];
  console.log(a);

  a = utils.matchAll(str, regexp);
  console.log(a);
}

async function fn_05() {
  // const uri = 'https://gorest.co.in/public/v2/users';
  // const uri = 'http://appl.host';
  const uri = 'http://appl.host/user/test?id=1lvc0e68kzsfrgh9&b=2';
  // const uri = 'http://doesnt-exists-domain.com';

  const param = { safeUDP: true };
  const res = await utils.curl(uri, param);
  console.log('------------------------');
  console.log(res);
  console.log('------------------------');
}

function fn_06() {
  // times.sync(0, 32400);
  const ut = times.unixtime();
  const dt = times.datetime();
  console.log(ut);
  console.log(dt);
}

function fn_07() {
  const arr = [
    "id_test='1lvc0mbcl0o5ve4m' AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b=3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b =3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b= 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b = 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b!=3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b !=3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b!= 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b != 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b<>3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b <>3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b<> 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b <> 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B=3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B =3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B= 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B = 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B!=3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B !=3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B!= 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B != 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B<>3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B <>3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B<> 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B <> 3 AND id IN ('1lvc0mbcl0o5ve4m-1')",

    "id_test='1lvc0mbcl0o5ve4m' OR b=-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b =-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b= -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b = -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b!=-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b !=-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b!= -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b != -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b<>-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b <>-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b<> -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR b <> -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B=-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B =-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B= -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B = -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B!=-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B !=-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B!= -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B != -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B<>-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B <>-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B<> -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR B <> -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",

    "id_test='1lvc0mbcl0o5ve4m' OR x<-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x>-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x<=-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x>=-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x <-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x >-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x <=-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x >=-3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x< -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x> -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x<= -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x>= -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x < -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x > -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x <= -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
    "id_test='1lvc0mbcl0o5ve4m' OR x >= -3 AND id IN ('1lvc0mbcl0o5ve4m-1')",
  ];

  for (let i = 0, i_len = arr.length; i < i_len; i++) {
    //rtn.where = rtn.where.replace(/([a-zA-Z_]+\s*)=(\s*[^\s$]+)/g, '($.$1 === undefined || $.$1=$2)');
    //rtn.where = rtn.where.replace(/([a-zA-Z_]+\s*)([!<>]*[=+\-*/%^&|])(\s*[^\s$]+)/g, '$.$1$2$3');
    const b = arr[i].replace(/([a-zA-Z_]+\s*?)(=|!=|<>|<=?|>=?)(\s*?[^\s$]+)/g, '$.$1$2$3');
    console.log(b);
  }
}

function fn_08() {
  class Abc {}
  const abc = new Abc();
  const arr = [true, 1, null, '1', 0.12, undefined, Math.PI, [], {}, abc, Abc];

  // 0 : boolean
  // 1 : number
  // 2 : null
  // 3 : string
  // 4 : number
  // 5 : undefined
  // 6 : number
  // 7 : array
  // 8 : object
  // 9 : object
  // 10 : function
  arr.forEach((v, i) => {
    console.log(i + ' : ' + utils.getType(v));
  });
}

async function fn_09() {
  const aa = await utils.curl('http://appl.host/ip', {
    header: {
      'x-forwarded-for': '^^',
    },
  });
  console.log(aa);
}

async function fn_10_sub01() {
  const fn_a = async () => {
    await utils.sleep(1000);
    console.log('finished fn_a');
  };
  const fn_b = async () => {
    await utils.sleep(2000);
    console.log('finished fn_b');
  };
  const fn_c = async () => {
    await utils.sleep(3000);
    console.log('finished fn_c');
  };

  // 1. 6000 ms
  // await fn_a();
  // await fn_b();
  // await fn_c();

  // 2. 3000 ms
  // const arr = [fn_a(), fn_b(), fn_c()];
  // return Promise.all(arr);

  // 3. 3000 ms (return void)
  const arr = [fn_a(), fn_b(), fn_c()];
  await Promise.all(arr);
}

async function fn_10() {
  const a = await fn_10_sub01();
  console.log(a);
  fn_00();
}

function fn_11() {
  const cpus = os.cpus();

  let n = 0;
  console.log('fn_11 called');

  if (cluster.isMaster == true) {
    console.log('cpus.length: ' + cpus.length);
    console.log(`Master ${process.pid} is running`);

    for (let i = 0, i_len = Math.max(1, cpus.length - 2); i < i_len; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`);
    });

    setTimeout(() => {
      console.log('process will be terminated after 3 seconds');
      setTimeout(() => {
        cluster.disconnect();
      }, 3000);
    }, 2000);
  } else if (cluster.isWorker) {
    n++;
    console.log(`Worker ${process.pid} started, ${n}`);
  } else {
    console.log('?????????????????????????????');
  }
}

function fn_12() {
  console.log(1111);

  const sab = new SharedArrayBuffer(Uint32Array.BYTES_PER_ELEMENT); // Uint32Array.BYTES_PER_ELEMENT : 4
  const u32 = new Uint32Array(sab);
  // const arr = new Array(4294967295);

  const queue = [];

  if (worker_threads.isMainThread == true) {
    console.log(2222);

    const worker = new worker_threads.Worker(__filename);
    // const worker = new worker_threads.Worker(__filename, { workerData: worker_threads.getEnvironmentData('queue') });
    // const worker = new worker_threads.Worker(path.resolve(__dirname, 'test-worker.js'));
    worker
      .on('error', (err) => {
        console.log('error: ' + err);
      })
      .on('exit', (code) => {
        console.log('exit: ' + code);
        process.exit(code);
      })
      .on('message', (data) => {
        console.log('mainThread: works remain - ' + data.v);
      })
      .on('online', () => {
        console.log('online');
      });
    // times.sync(0, 0 - new Date().getTimezoneOffset() * 60);

    let n = 0;
    setInterval(() => {
      n = n % 10;
      n++;
      worker.postMessage({ k: 'push', v: n });
      if (n % 5 == 0) {
        worker.postMessage({ k: 'remain', v: u32 });
      }
      console.log('u32[0] : ' + u32[0]);
    }, 1000);

    // setInterval(() => {
    //   console.log(`mainThread { pid: ${process.pid}, tid: ${worker.threadId} }`);
    // }, 500);

    console.log(3333);
  } else {
    console.log(4444);

    worker_threads.parentPort.on('message', (data) => {
      if (data.k == 'push') {
        // push & work
        queue.push(data.v);

        if (queue.length > 10) {
          const rnd = utils.randomNumber(1, 10);
          const usages = queue.splice(0, rnd);
          console.log('subThread: done - ' + JSON.stringify(usages));
        }
        console.log('subThread: waiting - ' + JSON.stringify(queue));
      } else if (data.k == 'remain') {
        // inquiry
        worker_threads.parentPort.postMessage({ k: data.k, v: queue.length });
        data.v[0]++;
      }

      // stop thread
      // worker_threads.parentPort.unref();
    });

    console.log(5555);
  }
  console.log(6666);
}

async function main() {
  // fn_00();
  // fn_01();
  // fn_02();
  // fn_03();
  // fn_04();
  // fn_05();
  // fn_06();
  // fn_07();
  // fn_08();
  // fn_09();
  // fn_10();
  // fn_11();
  fn_12();
}

main();
