export function normalize(value) {
  let u;try{u=new URL(/^https?:\/\//i.test(value)?value:'https://'+value)}catch{throw Error('Enter a valid public website URL.')}
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||u.search||u.hash)throw Error('Use a public URL without login details, ports, query parameters, or fragments.');
  const h=u.hostname.toLowerCase();
  if(h.length>253||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)||/\.(localhost|local|internal|test|invalid|example)$/.test(h))throw Error('Only public domain names are supported.');
  return u;
}
export function publicIP(ip){
  if(ip.includes(':'))return !/^(::|fc|fd|fe[89ab]|ff|2001:db8)/i.test(ip)&&!ip.includes('.')&&/^[23][0-9a-f]{0,3}:/i.test(ip);
  const a=ip.split('.').map(Number);return a.length===4&&a.every(v=>Number.isInteger(v)&&v>=0&&v<=255)&&!([0,10,127].includes(a[0])||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&(a[1]===168||a[1]===0||a[1]===2)||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===198&&(a[1]===18||a[1]===19||a[1]===51)||a[0]===203&&a[1]===0&&a[2]===113);
}
async function limitedText(r,max=700000){
  if(Number(r.headers.get('content-length'))>max)throw Error('Page is too large for this check.');
  const reader=r.body?.getReader();if(!reader)return '';let chunks=[],size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Page is too large for this check.')}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}return new TextDecoder().decode(bytes);
}
async function jsonFetch(url){const r=await fetch(url,{headers:{accept:url.includes('cloudflare-dns.com')?'application/dns-json':'application/rdap+json, application/json'},signal:AbortSignal.timeout(6500)});if(!r.ok)throw Error('Public data provider returned HTTP '+r.status);return JSON.parse(await limitedText(r,300000));}
export async function dns(host){const replies=await Promise.all([1,28].map(type=>jsonFetch('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(host)+'&type='+type)));const ips=replies.flatMap(x=>(x.Answer||[]).filter(a=>[1,28].includes(a.type)).map(a=>a.data));if(!ips.length)throw Error('No public DNS address was found.');if(ips.some(x=>!publicIP(x)))throw Error('The domain resolves to a restricted address.');return ips;}
async function pageFetch(input){let u=normalize(input);for(let i=0;i<5;i++){await dns(u.hostname);const r=await fetch(u.href,{redirect:'manual',headers:{'User-Agent':'ScholarCheck/1.0 public-page research','Accept':'text/html'},signal:AbortSignal.timeout(8000)});if([301,302,303,307,308].includes(r.status)){const location=r.headers.get('location');if(!location)throw Error('Redirect has no destination.');u=normalize(new URL(location,u).href);continue}if(!r.ok)throw Error('Website returned HTTP '+r.status+'. It may block automated visits.');if(!/text\/html/i.test(r.headers.get('content-type')||''))throw Error('This URL is not an HTML webpage.');return {url:u.href,html:await limitedText(r)}}throw Error('Too many redirects.');}
export function textFromHTML(html){return html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/\s+/g,' ').trim()}
export function contentChecks(html,host){
  const text=textFromHTML(html);const emails=[...new Set((text+' '+html).match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[])].slice(0,12);
  const same=emails.filter(e=>{const d=e.split('@')[1].toLowerCase();return host===d||host.endsWith('.'+d)||d.endsWith('.'+host)});
  const fee=/\b(application|registration|processing|upfront|advance)\s+(?:\w+\s+){0,2}fees?\b|\bpay\s+(?:\w+\s+){0,3}(?:fee|deposit)\b/gi;
  const excerpts=[];for(const m of text.matchAll(fee)){const snippet=text.slice(Math.max(0,m.index-65),Math.min(text.length,m.index+m[0].length+95));if(!/\b(no|zero|without|not required|free of)\b.{0,40}(?:fee|deposit)/i.test(snippet))excerpts.push(snippet);if(excerpts.length===3)break}
  return {text,emails,same,excerpts,eligibility:/\beligib(?:ility|le)\b|\bqualif(?:y|ication)\b/i.test(text),contact:/\bcontact\b/i.test(text)||emails.length>0};
}
function registered(host){const parts=host.split('.');const suffix=parts.slice(-2).join('.');const multi=['co.in','ac.in','gov.in','org.in','edu.in','co.uk','org.uk','ac.uk','com.au','edu.au','co.nz','co.za','com.br'];return parts.slice(multi.includes(suffix)?-3:-2).join('.')}
export async function analyze(input){
  const url=normalize(String(input.url||'').trim());const name=String(input.name||'').trim().slice(0,120);const official=input.official?normalize(input.official):null;
  const report={url:url.href,domain:url.hostname,checkedAt:new Date().toISOString(),title:'',checks:[],registrationDomain:registered(url.hostname)};
  const add=(status,title,detail,source,quote)=>report.checks.push({status,title,detail,source,quote});
  const [page,rdap]=await Promise.allSettled([pageFetch(url.href),jsonFetch('https://rdap.org/domain/'+report.registrationDomain)]);
  if(rdap.status==='fulfilled'){
    const created=rdap.value.events?.find(x=>x.eventAction==='registration')?.eventDate;
    if(created&&!isNaN(Date.parse(created))){const days=Math.floor((Date.now()-Date.parse(created))/86400000);add(days<180?'warning':'observed','Domain registration',report.registrationDomain+' was registered on '+created.slice(0,10)+' ('+days+' days ago). '+(days<180?'A recent registration warrants a closer check.':'An older domain is context, not proof of legitimacy.'),'https://rdap.org/domain/'+report.registrationDomain)}else add('unknown','Domain registration','The public record does not expose a usable registration date.','https://rdap.org/domain/'+report.registrationDomain);
  }else add('unknown','Domain registration','Registration data unavailable: '+rdap.reason.message,'https://rdap.org/domain/'+report.registrationDomain);
  if(page.status==='fulfilled'){
    report.url=page.value.url;const host=new URL(report.url).hostname;const c=contentChecks(page.value.html,host);report.title=textFromHTML(page.value.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||host).slice(0,160);
    add(report.url.startsWith('https:')?'observed':'warning','Connection security',report.url.startsWith('https:')?'The webpage was retrieved over HTTPS. Encryption does not establish scholarship authenticity.':'The final webpage uses HTTP without transport encryption.',report.url);
    add(c.emails.length?(c.same.length?'observed':'warning'):'unknown','Contact email',c.same.length?'Matching-domain email found: '+c.same.join(', '):c.emails.length?'Emails on other domains found: '+c.emails.join(', ')+'. A separate email domain can be legitimate; confirm it with the organiser.':'No email was found in the retrieved page. Contact details may be on another page.',report.url);
    add(c.excerpts.length?'warning':'observed','Payment language',c.excerpts.length?'Possible application or processing fee language was found. Read the context and confirm any requested payment independently.':'No upfront-fee phrases matched the rule on this page. Other pages, forms, or messages were not checked.',report.url,c.excerpts.join('\n\n'));
    add(c.eligibility?'observed':'unknown','Eligibility information',c.eligibility?'Eligibility or qualification wording appears on this page. This check does not assess whether the terms are accurate.':'No eligibility wording was found in the retrieved text.',report.url);
    add(c.contact?'observed':'unknown','Contact information',c.contact?'A contact reference or email appears on this page. It has not been independently authenticated.':'No contact reference was found on this page.',report.url);
  }else {add('unknown','Website content','Could not retrieve the page: '+page.reason.message,url.href);for(const t of ['Connection security','Contact email','Payment language','Eligibility information','Contact information'])add('unknown',t,'Page content was unavailable, so this check could not run.',url.href)}
  if(official&&name){try{
    const p=await pageFetch(official.href);const text=textFromHTML(p.html);const nameFound=text.toLowerCase().includes(name.toLowerCase());const links=[...p.html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map(x=>{try{return new URL(x[1],p.url)}catch{return null}}).filter(Boolean);const domainFound=links.some(x=>x.hostname===url.hostname);
    add(nameFound&&domainFound?'observed':'unknown','Official-source comparison',nameFound&&domainFound?'The supplied reference page contains the scholarship name and a link to the submitted domain. Confirm that this reference is genuinely the organiser’s official website.':'The supplied page did not contain both the exact scholarship name and a link to the submitted domain. This is not proof of fraud.',p.url);
  }catch(e){add('unknown','Official-source comparison','Reference page unavailable: '+e.message,official.href)}}else add('unknown','Official-source comparison','Add a scholarship name and a trusted organiser page to compare public references. No automatic search or official approval is claimed.',null);
  report.summary={warnings:report.checks.filter(x=>x.status==='warning').length,observed:report.checks.filter(x=>x.status==='observed').length,unknown:report.checks.filter(x=>x.status==='unknown').length};return report;
}
