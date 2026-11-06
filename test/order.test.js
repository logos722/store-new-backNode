const {test} = require('node:test');
const assert = require('node:assert/strict');
const Order = require('../models/order.model');
const nodemailer = require('nodemailer');
const {createOrder} = require('../controllers/order.controller');

test('valid order saves total and produces an Excel email; SMTP failure preserves order', async (t) => {
  const saved=[];
  t.mock.method(Order.prototype, 'save', async function(){saved.push(this.toObject());return this;});
  for(const name of ['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','EMAIL_FROM','EMAIL_TO']) {
    const old=process.env[name];process.env[name]=name==='SMTP_PORT'?'465':'test';
    t.after(()=>{if(old===undefined)delete process.env[name];else process.env[name]=old;});
  }
  let fail=false, delivered;
  t.mock.method(nodemailer,'createTransport',()=>({sendMail:async message=>{
    if(fail)throw new Error('offline');delivered=message;return {messageId:'test'};
  }}));
  const payload={items:[{id:'sku-1',name:'Product',price:12.5,quantity:2}],total:25,
    customerInfo:{email:'customer@example.com',name:'Test',phone:'79990000000',city:'Moscow',privacyConsent:true}};
  const invoke=async()=>{
    const response={code:0,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
    await createOrder({body:payload},response);return response;
  };
  const ok=await invoke();
  assert.equal(ok.code,201);assert.equal(ok.body.success,true);
  assert.equal(saved[0].total,25);
  assert.ok(Buffer.from(delivered.attachments[0].content).length>1000);
  fail=true;
  const warning=await invoke();
  assert.equal(warning.code,201);assert.equal(saved.length,2);
  assert.ok(warning.body.warning);
});
