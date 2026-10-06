import{api,h,inr}from'./api.js';
const $=s=>document.querySelector(s),app=$('#app');let user=null,cartN=0,orderKey=null;
const msg=(t,c='e')=>`<div class="msg ${c}" role="alert">${h(t)}</div>`;
async function nav(){try{user=(await api('/auth/me')).user}catch{user=null}
 if(user){try{cartN=(await api('/cart')).items.reduce((s,i)=>s+i.qty,0)}catch{cartN=0}}else cartN=0;
 $('#nav').innerHTML=`<a href="#/">Shop</a><a href="#/cart">Cart (${cartN})</a>`+(user?`<a href="#/orders">Orders</a>${user.role==='admin'?'<a href="/admin.html">Admin</a>':''}<a href="#" id="out">Logout (${h(user.name.split(' ')[0])})</a>`:`<a href="#/login">Login</a><a href="#/register">Register</a>`);
 const o=$('#out');if(o)o.onclick=async e=>{e.preventDefault();await api('/auth/logout',{method:'POST'});location.hash='#/';route()}}
const card=p=>{const d=p.mrp>p.price?Math.round(100-p.price*100/p.mrp):0;
 return`<article class="card"><img loading="lazy" src="${h(p.images[0]||'')}" alt="${h(p.name)}" onerror="this.style.visibility='hidden'"><div><span class="mu">${h(p.brand)}</span><a href="#/p/${h(p.slug)}"><strong>${h(p.name)}</strong></a>
 <span><span class="price">${inr(p.price)}</span> ${d?`<span class="old">${inr(p.mrp)}</span> <span class="off">${d}% off</span>`:''}</span>
 <span class="${p.stock?'off':'mu'}">${p.stock?(p.stock<6?'Only '+p.stock+' left':'In stock'):'Out of stock'}</span>
 <div class="row" style="padding:0"><a class="btn ghost" href="#/p/${h(p.slug)}">Details</a><button data-add="${p._id}" ${p.stock?'':'disabled'}>Add to Cart</button></div></div></article>`};
async function add(id,n=1){if(!user){location.hash='#/login';return}
 try{await api('/cart/items',{method:'POST',body:{productId:id,qty:n}});await nav();flash('Added to cart','s')}catch(e){flash(e.message)}}
function flash(t,c='e'){const d=document.createElement('div');d.innerHTML=msg(t,c);d.style.cssText='position:fixed;bottom:16px;right:16px;z-index:9';document.body.append(d);setTimeout(()=>d.remove(),3000)}
app.addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(b)add(b.dataset.add,+(document.getElementById('qty')?.value||1))});
async function shop(){const hp=new URLSearchParams(location.hash.split('?')[1]||'');
 const fac=await api('/facets').catch(()=>({categories:[],brands:[]}));
 app.innerHTML=`<section class="hero"><h1>Find Your Sound.<br>Play Your Passion.</h1><p>Discover instruments and music gear that bring your creativity to life, from your first chord to your next stage performance.</p></section>
 <form class="filters" id="f" role="search"><input name="q" placeholder="Search name, brand, SKU" aria-label="Search" value="${h(hp.get('q')||'')}">
 <select name="category" aria-label="Category"><option value="">All categories</option>${fac.categories.map(c=>`<option ${hp.get('category')===c?'selected':''}>${h(c)}</option>`).join('')}</select>
 <select name="brand" aria-label="Brand"><option value="">All brands</option>${fac.brands.map(c=>`<option ${hp.get('brand')===c?'selected':''}>${h(c)}</option>`).join('')}</select>
 <input name="min" type="number" min="0" placeholder="Min ₹" aria-label="Min price" value="${h(hp.get('min')||'')}"><input name="max" type="number" min="0" placeholder="Max ₹" aria-label="Max price" value="${h(hp.get('max')||'')}">
 <select name="sort" aria-label="Sort"><option value="">Newest</option><option value="popular">Popular</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option></select>
 <label style="display:flex;align-items:center;gap:6px"><input type="checkbox" name="inStock" value="1" style="width:auto"> In stock</label><button>Apply</button></form><div id="list">Loading…</div>`;
 const f=$('#f');f.sort.value=hp.get('sort')||'';f.inStock.checked=hp.get('inStock')==='1';
 f.onsubmit=e=>{e.preventDefault();const p=new URLSearchParams();new FormData(f).forEach((v,k)=>v&&p.set(k,v));location.hash='#/?'+p}; 
 try{const d=await api('/products?'+hp+(hp.has('limit')?'':'&limit=12'));const pg=+hp.get('page')||1;
  const pl=n=>{const p=new URLSearchParams(hp);p.set('page',n);return'#/?'+p};
  $('#list').innerHTML=d.items.length?`<div class="grid">${d.items.map(card).join('')}</div><p class="mu">${d.total} products · page ${d.page}/${d.pages||1}</p><div class="row">${pg>1?`<a class="btn ghost" href="${pl(pg-1)}">← Prev</a>`:''}${pg<d.pages?`<a class="btn ghost" href="${pl(pg+1)}">Next →</a>`:''}</div>`:`<div class="box">No products match your filters.</div>`}
 catch(e){$('#list').innerHTML=msg(e.message)+'<button onclick="location.reload()">Retry</button>'}}
async function pdp(slug){app.textContent='Loading…';try{const p=await api('/products/'+encodeURIComponent(slug));document.title=p.name+' — StrumCart';
 app.innerHTML=`<div class="pdp"><img src="${h(p.images[0]||'')}" alt="${h(p.name)}" onerror="this.style.visibility='hidden'"><div><span class="mu">${h(p.brand)} · ${h(p.category)}</span><h1>${h(p.name)}</h1><p class="price">${inr(p.price)}</p>
 <p>${h(p.desc)}</p><p class="mu">Warranty: ${h(p.warranty||'N/A')}</p><p class="${p.stock?'off':'mu'}">${p.stock?p.stock+' in stock':'Out of stock'}</p>
 <div class="row"><input id="qty" type="number" min="1" max="${Math.min(10,p.stock)}" value="1" aria-label="Quantity"><button data-add="${p._id}" ${p.stock?'':'disabled'}>Add to Cart</button><button id="buy" ${p.stock?'':'disabled'}>Buy Now</button></div></div></div>`;
 $('#buy').onclick=async()=>{await add(p._id,+$('#qty').value);if(user)location.hash='#/checkout'}}
 catch(e){app.innerHTML=msg(e.status===404?'Product not found.':e.message)+'<a class="btn" href="#/">Back to shop</a>'}}
async function cart(){if(!user)return location.hash='#/login';const c=await api('/cart');
 if(!c.items.length){app.innerHTML='<div class="box"><h2>Your cart is empty</h2><a class="btn" href="#/">Shop Now</a></div>';return}
 app.innerHTML=`<h1>Cart</h1>${c.items.map(i=>`<div class="box row" style="align-items:center"><span>${h(i.product.name)}<br><span class="mu">${inr(i.product.price)}</span></span><input type="number" min="1" max="${Math.min(10,i.product.stock)}" value="${i.qty}" data-q="${i.product._id}" aria-label="Quantity"><button class="ghost" data-rm="${i.product._id}">Remove</button></div>`).join('')}
 <div class="box">Subtotal ${inr(c.subtotal)}<br>Delivery ${c.delivery?inr(c.delivery):'Free'}<br><strong>Total ${inr(c.total)}</strong></div><div class="row"><a class="btn ghost" href="#/">Continue shopping</a><a class="btn" href="#/checkout">Checkout</a></div>`;
 app.querySelectorAll('[data-q]').forEach(i=>i.onchange=async()=>{try{await api('/cart/items/'+i.dataset.q,{method:'PATCH',body:{qty:i.value}})}catch(e){flash(e.message)}await nav();cart()});
 app.querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{await api('/cart/items/'+b.dataset.rm,{method:'DELETE'});await nav();cart()})}
async function checkout(){if(!user)return location.hash='#/login';const c=await api('/cart');if(!c.items.length)return location.hash='#/cart';
 orderKey=orderKey||crypto.randomUUID();
 app.innerHTML=`<h1>Checkout</h1><div class="box">${c.items.map(i=>`<div>${h(i.product.name)} × ${i.qty} — ${inr(i.product.price*i.qty)}</div>`).join('')}<hr>Delivery: ${c.delivery?inr(c.delivery):'Free'}<br><strong>Total payable on delivery: ${inr(c.total)}</strong></div>
 <form class="form" id="co"><label>Full name<input name="name" required value="${h(user.name)}"></label><label>Phone (10 digits)<input name="phone" required pattern="\\d{10}" value="${h(user.phone||'')}"></label><label>Address<input name="line" required></label>
 <label>City<input name="city" required></label><label>State<input name="state" required></label><label>PIN code<input name="pin" required pattern="\\d{6}"></label><label>Delivery instructions (optional)<textarea name="notes" maxlength="200"></textarea></label>
 <p class="mu">Payment: Cash on Delivery</p><div id="err"></div><button id="place">Place Order</button></form>`;
 $('#co').onsubmit=async e=>{e.preventDefault();const b=$('#place');b.disabled=true;
  try{const d=await api('/orders',{method:'POST',body:{key:orderKey,address:Object.fromEntries(new FormData(e.target))}});orderKey=null;await nav();
   app.innerHTML=`<div class="box">${msg('Order placed!','s')}<h2>${h(d.order.number)}</h2><p>Total ${inr(d.order.total)} · Cash on Delivery · Payment pending</p><a class="btn" href="#/orders">View orders</a></div>`}
  catch(er){$('#err').innerHTML=msg(er.message);b.disabled=false}}}
async function orders(){if(!user)return location.hash='#/login';const o=await api('/orders/my');
 app.innerHTML=`<h1>My Orders</h1>${o.length?`<div class="scroll"><table><tr><th>Order</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr>${o.map(x=>`<tr><td>${h(x.number)}</td><td>${new Date(x.createdAt).toLocaleDateString()}</td><td>${inr(x.total)}</td><td>${h(x.payment)} · ${h(x.paymentStatus)}</td><td><span class="badge">${h(x.status)}</span></td><td>${['Pending','Confirmed'].includes(x.status)?`<button class="ghost" data-c="${x._id}">Cancel</button>`:''}</td></tr>`).join('')}</table></div>`:'<div class="box">No orders yet. <a href="#/">Shop now</a></div>'}`;
 app.querySelectorAll('[data-c]').forEach(b=>b.onclick=async()=>{if(!confirm('Cancel this order?'))return;try{await api('/orders/'+b.dataset.c+'/cancel',{method:'POST'});orders()}catch(e){flash(e.message)}})}
function authForm(reg){app.innerHTML=`<h1>${reg?'Create account':'Login'}</h1><form class="form" id="af">${reg?'<label>Name<input name="name" required></label><label>Phone (optional)<input name="phone" pattern="\\d{10}"></label>':''}<label>Email<input name="email" type="email" required></label><label>Password${reg?' (min 8)':''}<input name="password" type="password" minlength="${reg?8:1}" required></label><div id="err"></div><button>${reg?'Register':'Login'}</button></form>`;
 $('#af').onsubmit=async e=>{e.preventDefault();try{await api(reg?'/auth/register':'/auth/login',{method:'POST',body:Object.fromEntries(new FormData(e.target))});await nav();location.hash='#/'}catch(er){$('#err').innerHTML=msg(er.message)}}}
async function route(){document.title='StrumCart — Find Your Sound. Play Your Passion.';const[p,a]=location.hash.slice(2).split('?')[0].split('/');
 try{if(!p)await shop();else if(p==='p')await pdp(a);else if(p==='cart')await cart();else if(p==='checkout')await checkout();else if(p==='orders')await orders();else if(p==='login')authForm(0);else if(p==='register')authForm(1);else app.innerHTML=msg('Page not found.')}
 catch(e){if(e.status===401){user=null;location.hash='#/login'}else app.innerHTML=msg(e.message)}}
addEventListener('hashchange',route);nav().then(route);
