import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGoods, parseHousing } from '../../lib/match/housing-goods.ts';
const post=(body,extra={})=>({id:'focused-parser-test',title:'',body,category:'other',createdAt:'2026-09-11T04:00:00Z',...extra});

test('housing recognizes multilingual numbers without merging UG and PG namespaces',()=>{
  const [intent]=parseHousing(post('PG Hall XI double → 本科十三舍 single, female eligibility, Spring 2027.'));
  assert.equal(intent.from,'pg-hall-11');assert.equal(intent.to,'ug-hall-13');
  assert.equal(intent.room,'double');assert.equal(intent.wantedRoom,'single');assert.equal(intent.term,'spring:2027');
});
test('housing associates room types before hall names and explicit target alternatives',()=>{
  const intents=parseHousing(post('女本科生，2027春季。单人房，目前本科五舍，想去六舍或九舍，必须单人房。',{category:'hall',currentHall:'UG Hall V',targetHall:'UG Hall VI or UG Hall IX'}));
  assert.deepEqual(intents.map(i=>i.to).sort((a,b)=>a<b?-1:a>b?1:0),['ug-hall-6','ug-hall-9']);
  for(const i of intents){assert.equal(i.from,'ug-hall-5');assert.equal(i.room,'single');assert.equal(i.wantedRoom,'single');assert.equal(i.eligibility,'female');}
});
test('housing preserves explicit negative targets and abstains after withdrawal',()=>{
  const value=post('2026秋季女生本科五舍单人房。已不想去二舍了，只去四舍单人房。',{category:'hall',currentHall:'UG Hall V',targetHall:'UG Hall IV'});
  assert.deepEqual(parseHousing(value).map(i=>i.to),['ug-hall-4']);
  assert.deepEqual(parseHousing({...value,title:'已取消换宿',body:value.body+' 不换了。'}),[]);
  assert.deepEqual(parseHousing(post('随便看看',{category:'hall',currentHall:'x',targetHall:'x'})),[]);
});
test('named university apartment aliases preserve actual tower destinations',()=>{
  const [intent]=parseHousing(post('University Apartments Tower B single for UA Towers C and D double, Fall 2026 male.',{category:'hall',currentHall:'UA Tower B',targetHall:'UA Towers C-D'}));
  assert.equal(intent.from,'ua-tower-b');assert.equal(intent.to,'ua-tower-c-d');
});
test('currency is not confused with comma-separated dates or handover time intervals',()=>{
  const [a]=parseGoods(post('出一个台灯，HK$90，9月20日15:00–17:00图书馆交收。'));
  const [b]=parseGoods(post('Selling a monitor for HK$1,200. Pickup on 20 Sep from 14:00 to 16:00.'));
  assert.equal(a.price,90);assert.equal(b.price,1200);
});
test('one model and its common noun form one item with shared price and condition',()=>{
  const items=parseGoods(post('Selling Casio fx-991EX scientific calculator for HK$140, working.'));
  assert.equal(items.length,1);assert.equal(items[0].entity,'calculator');assert.equal(items[0].model,'fx991ex');assert.equal(items[0].price,140);assert.equal(items[0].condition,'working');
});
test('a title can supply direction while the public body supplies product constraints',()=>{
  const [item]=parseGoods(post('罗技 K580，白色，150港币。',{title:'K580出售',category:'goods'}));
  assert.equal(item.entity,'keyboard');assert.equal(item.side,'offer');assert.equal(item.model,'logitechk580');assert.equal(item.price,150);assert.deepEqual(item.colors,['white']);
});
test('postfix offers remain active when another named item is withdrawn',()=>{
  const items=parseGoods(post('不再卖鼠标了，Logitech MX Keys Mini 键盘仍出，420港币。'));
  assert.equal(items.length,1);assert.equal(items[0].entity,'keyboard');assert.equal(items[0].side,'offer');assert.equal(items[0].price,420);
  assert.deepEqual(parseGoods(post('Not selling my Nintendo Switch OLED. No offers please.')),[]);
});
test('independent buying and selling clauses keep their own budgets and roles',()=>{
  const items=parseGoods(post('Selling a chair HK$70; need a monitor, budget HK$300.'));
  assert.deepEqual(items.map(({entity,side,price})=>({entity,side,price})),[{entity:'chair',side:'offer',price:70},{entity:'monitor',side:'seek',price:300}]);
});
test('edition, explicit quantity and acceptable color alternatives remain constraints',()=>{
  const [book]=parseGoods(post('Selling ISBN 9780262046305, fourth edition, HKD250.'));
  assert.equal(book.entity,'textbook');assert.equal(book.model,'isbn:9780262046305');assert.equal(book.edition,'4');assert.equal(book.price,250);
  const [monitor]=parseGoods(post('必须买到两台 Dell P2422H，黑色或银色都可以，总预算1000港币。'));
  assert.equal(monitor.quantity,2);assert.deepEqual(monitor.colors.sort((a,b)=>a<b?-1:a>b?1:0),['black','silver']);assert.equal(monitor.priceBasis,'total');
});
test('unsupported loans and undecided role/price never become definite purchase evidence',()=>{
  assert.deepEqual(parseGoods(post('Need to borrow Sony A6400 for one day, not buying.')),[]);
  const [item]=parseGoods(post('Selling a monitor; price to be discussed.'));
  assert.equal(item.price,undefined);assert.ok(item.missing.includes('price'));
});
test('evidence is always a literal substring of a supplied public field',()=>{
  const p=post('Selling a desk lamp, HKD90. Pickup at the library tomorrow.',{title:'Desk lamp'});
  for(const intent of parseGoods(p))for(const evidence of intent.evidence)assert.ok([p.title,p.body].some(field=>field.includes(evidence)));
});
test('free delivery and free time never overwrite an item asking price',()=>{
 for(const body of ['Selling my calculator. HKD150. Free delivery.', 'Selling my calculator. Asking HKD150. Free after18:00.']){
  const result=parseGoods({id:'delivery',category:'goods',title:'Calculator',body,createdAt:'2026-09-11T04:00:00Z'});
  assert.ok(result.some(i=>i.price===150));assert.ok(result.every(i=>i.price!==0));
 }
});
