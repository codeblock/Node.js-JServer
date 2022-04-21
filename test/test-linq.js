const linq = require('linq');

const data = [
  { id: 1, name: 'a', field_1: 1, field_2: 1, field_3: 1, field_4: 1 },
  { id: 2, name: 'b', field_1: 1, field_2: 1, field_3: 1, field_4: 2 },
  { id: 3, name: 'c', field_1: 1, field_2: 1, field_3: 2, field_4: 3 },
  { id: 4, name: 'd', field_1: 1, field_2: 2, field_3: 3, field_4: 4 },
  { id: 5, name: 'e', field_1: 2, field_2: 3, field_3: 4, field_4: 5 },
  { id: 6, name: 'a', field_1: 1, field_2: 1, field_3: 1, field_4: 1 },
  { id: 7, name: 'b', field_1: 1, field_2: 1, field_3: 1, field_4: 2 },
  { id: 8, name: 'c', field_1: 1, field_2: 1, field_3: 2, field_4: 3 },
  { id: 9, name: 'd', field_1: 1, field_2: 2, field_3: 3, field_4: 4 },
  { id: 10, name: 'e', field_1: 2, field_2: 3, field_3: 4, field_4: 5 },
];
const tbl = linq.from(data);

let tmp = null;
let selector_key = null;
let selector_element = null;
let selector_result = null;
let selector_compare = null;

// https://www.google.com/search?q=linqjs+group+by+multiple+columns&biw=1125&bih=596&sxsrf=APq-WBtaYfyEIqi0QIEQPH8NrAXiDyAOBQ%3A1645455082471&ei=6qYTYsuTHJqB1e8P1uqS-As&ved=0ahUKEwjLsLzthZH2AhWaQPUHHVa1BL84ChDh1QMIDg&uact=5&oq=linqjs+group+by+multiple+columns&gs_lcp=Cgdnd3Mtd2l6EAMyBwgjELACECc6BwgAEEcQsANKBAhBGABKBAhGGABQ4AZY4AZg2yFoAXABeACAAW-IAW-SAQMwLjGYAQCgAQHIAQrAAQE&sclient=gws-wiz
// https://stackoverflow.com/questions/17824008/linqjs-group-by-with-a-sum
selector_key = '$.field_1, $.field_2';
// selector_element = '{field_1: $.field_1, field_2: $.field_2, field_3: $.field_3, field_4: $.field_4}';
selector_compare = null;

// tmp = tbl.groupBy(selector_key, selector_element, selector_result, selector_compare).toArray();
tmp = tbl
  .groupBy(
    selector_key,
    selector_element,
    (key, group) => {
      return { field_1: group.select('$.field_1').elementAt(0), field_2: group.max('$.field_2'), field_3: group.min('$.field_3'), field_4: group.min('$.field_4') };
    },
    selector_compare,
  )
  .toArray();
console.log(tmp);

const command_arr = /** @type {Array<Array<string>>} */ ([]);
/*let value_arr = null;

const command = {
  cmd: 'hmget',
  key: 'map',
  arg: ['k1', 'k2'],
};

value_arr = [command.cmd, command.key, JSON.stringify(command.arg)];
// value_arr = [command.cmd, command.key, null];
command_arr.push(value_arr);

console.log(value_arr);
console.log(command_arr);*/
