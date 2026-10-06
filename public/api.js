let csrf='';
export const h=s=>String(s??'').replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
export const inr=n=>'₹'+Number(n).toLocaleString('en-IN');
export async function api(path,{method='GET',body}={}){
 if(method!=='GET'&&!csrf)csrf=(await(await fetch('/api/csrf')).json()).csrf;
 const res=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:body?JSON.stringify(body):undefined});
 const d=await res.json().catch(()=>({}));if(d.csrf)csrf=d.csrf;
 if(!res.ok)throw Object.assign(new Error(d.error||'Request failed'),{status:res.status});return d}
