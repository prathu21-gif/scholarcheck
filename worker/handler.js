const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"};
const recent=new Map();let active=0;
export default{async fetch(req){const path=new URL(req.url).pathname;if(path==='/'&&req.method==='GET')return new Response(page,{headers:{...security,'Content-Type':'text/html; charset=utf-8'}});
if(path==='/api/analyze'&&req.method==='POST'){
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...security,'Content-Type':'application/json'}});
 if(req.headers.get('origin')&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'Request origin not allowed.'},403);
 const key=req.headers.get('CF-Connecting-IP')||'local';const now=Date.now();for(const[k,v]of recent)if(now-v>60000)recent.delete(k);if(recent.has(key))return json({error:'Please wait one minute between live checks.'},429);if(active>=5)return json({error:'The checker is busy. Please retry shortly.'},429);
 try{const raw=await req.text();if(raw.length>5000)return json({error:'Request too large.'},413);let body;try{body=JSON.parse(raw)}catch{return json({error:'Invalid request.'},400)}normalize(String(body.url||''));if(body.official)normalize(body.official);recent.set(key,now);active++;try{return json(await analyze(body))}finally{active--}}catch(e){return json({error:e.message},400)}
}return new Response('Not found',{status:404,headers:security})}};
