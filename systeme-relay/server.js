import http from 'node:http';
const PORT=process.env.PORT||3000;
const API='https://api.systeme.io/api';
const KEY=process.env.SYSTEME_API_KEY;
const TOKEN=process.env.RELAY_TOKEN;
function json(res,status,data){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));}
async function sio(path,opts={}){const r=await fetch(API+path,{...opts,headers:{'X-API-Key':KEY,'accept':'application/json','content-type':'application/json',...(opts.headers||{})}});const t=await r.text();let d;try{d=JSON.parse(t)}catch{d=t}return {status:r.status,ok:r.ok,data:d,headers:{remaining:r.headers.get('x-ratelimit-remaining')}};}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/health')return json(res,200,{ok:true});if(u.searchParams.get('token')!==TOKEN)return json(res,403,{ok:false,error:'forbidden'});
if(u.pathname==='/probe'){const [contacts,funnels]=await Promise.all([sio('/contacts?limit=1'),sio('/funnels?limit=20')]);return json(res,200,{contacts:{status:contacts.status,ok:contacts.ok},funnels});}
if(u.pathname==='/docs'){const r=await fetch('https://developer.systeme.io/llms.txt');const t=await r.text();const lines=t.split('\n').filter(x=>/funnel|page editor|website|schema/i.test(x));return json(res,200,{status:r.status,lines:lines.slice(0,500)});}
return json(res,404,{ok:false,error:'not found'});}catch(e){return json(res,500,{ok:false,error:String(e?.message||e)});}});
server.listen(PORT,()=>console.log('systeme relay listening',PORT));