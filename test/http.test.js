const {test, before, after} = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
let server, base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve=>server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(()=>new Promise(resolve=>server.close(resolve)));
test('liveness does not require MongoDB; readiness does', async()=>{
  assert.equal((await fetch(base+'/health/live')).status,200);
  assert.equal((await fetch(base+'/health/ready')).status,503);
});
test('invalid orders rejected before database or SMTP',async()=>{
  assert.equal((await fetch(base+'/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,400);
});
test('security and CORS headers',async()=>{
  const response=await fetch(base+'/health/live',{headers:{origin:'https://untrusted.example'}});
  assert.equal(response.headers.get('x-powered-by'),null);
  assert.notEqual(response.headers.get('access-control-allow-origin'),'https://untrusted.example');
});
