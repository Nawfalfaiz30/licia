const base=process.env.LICIA_URL||"http://127.0.0.1:3000";
const url=`${base.replace(/\/$/,"")}/api/health`;
try{const r=await fetch(url);const body=await r.text();console.log(`${r.status} ${url}\n${body}`);process.exit(r.ok?0:1)}catch(e){console.error(e);process.exit(1)}
