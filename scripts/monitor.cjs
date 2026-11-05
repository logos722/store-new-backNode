const tls = require('node:tls');
const nodemailer = require('nodemailer');
async function check() {
  for (const route of ['/health','/health/ready','/api/categories']) {
    const response=await fetch('https://gelionaqua.ru'+route,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('HTTP availability check failed');
  }
  await new Promise((resolve,reject)=>{
    const socket=tls.connect({host:'gelionaqua.ru',port:443,servername:'gelionaqua.ru',rejectUnauthorized:true},()=>{
      const remaining=Date.parse(socket.getPeerCertificate().valid_to)-Date.now();
      socket.end();remaining>14*86400000?resolve():reject(new Error('Certificate expires within 14 days'));
    });
    socket.setTimeout(20000,()=>socket.destroy(new Error('TLS timeout')));
    socket.on('error',reject);
  });
}
check().catch(async()=>{
  console.error('External Gelion check failed');
  try {
    // Notify only on transition to failure. Scheduled runs are not an SLA monitor.
    const runs=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/monitor.yml/runs?per_page=10`,{
      headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(10000),
    });
    if(!runs.ok)throw new Error('Cannot read previous check');
    const previous=(await runs.json()).workflow_runs.find(run=>run.status==='completed'&&String(run.id)!==process.env.GITHUB_RUN_ID);
    if(previous?.conclusion!=='failure') {
      await nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT),secure:process.env.SMTP_PORT==='465',
        auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},connectionTimeout:10000,socketTimeout:15000}).sendMail({
        from:process.env.EMAIL_FROM,to:process.env.EMAIL_TO,subject:'Gelion: external check failed',text:'Check HTTPS, application health and certificate expiry. See GitHub Actions logs.',
      });
    }
  } catch { console.error('Monitoring notification failed; inspect Actions run'); }
  process.exitCode=1;
});
