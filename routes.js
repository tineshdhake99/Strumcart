const {Router}=require('express'),bcrypt=require('bcryptjs'),crypto=require('crypto'),{User,Product,Cart,Order}=require('./models');
const R=Router(),w=f=>(q,r,n)=>f(q,r,n).catch(n),bad=(m,s=400)=>Object.assign(new Error(m),{status:s});
const need=w(async(q,r,n)=>{if(!q.session.uid)throw bad('Login required',401);q.user=await User.findById(q.session.uid);if(!q.user||!q.user.active)throw bad('Login required',401);n()});
const admin=[need,(q,r,n)=>q.user.role==='admin'?n():n(bad('Forbidden',403))];
const esc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),pub=u=>({id:u._id,name:u.name,email:u.email,phone:u.phone,role:u.role});
const login=(q,u)=>new Promise((ok,no)=>q.session.regenerate(e=>{if(e)return no(e);q.session.uid=String(u._id);q.session.csrf=crypto.randomBytes(24).toString('hex');ok(q.session.csrf)}));

R.post('/auth/register',w(async(q,r)=>{const{name,email,password,phone}=q.body;
 if(!name||name.length>80||!/^\S+@\S+\.\S+$/.test(email||'')||!password||password.length<8||(phone&&!/^\d{10}$/.test(phone)))throw bad('Invalid name, email, phone (10 digits) or password (min 8 chars)');
 const u=await User.create({name,email,phone,password:await bcrypt.hash(password,12)});
 r.status(201).json({user:pub(u),csrf:await login(q,u)})}));
R.post('/auth/login',w(async(q,r)=>{const u=await User.findOne({email:String(q.body.email||'').toLowerCase()});
 if(!u||!u.active||!await bcrypt.compare(String(q.body.password||''),u.password))throw bad('Wrong email or password',401);
 r.json({user:pub(u),csrf:await login(q,u)})}));
R.post('/auth/logout',(q,r)=>q.session.destroy(()=>{r.clearCookie('sc.sid');r.json({ok:true})}));
R.get('/auth/me',w(async(q,r)=>{const u=q.session.uid&&await User.findById(q.session.uid);r.json({user:u?pub(u):null})}));

R.get('/products',w(async(q,r)=>{const{q:s,category,brand,min,max,inStock,sort,featured}=q.query,f={active:true};
 if(s)f.$or=['name','brand','sku'].map(k=>({[k]:new RegExp(esc(s).slice(0,60),'i')}));
 if(category)f.category=String(category);if(brand)f.brand=String(brand);if(featured)f.featured=true;
 if(min||max){f.price={};if(min)f.price.$gte=+min||0;if(max)f.price.$lte=+max||1e9}
 if(inStock==='1')f.stock={$gt:0};
 const so={price_asc:{price:1},price_desc:{price:-1},popular:{sold:-1},new:{createdAt:-1}}[sort]||{createdAt:-1};
 const page=Math.max(1,+q.query.page||1),lim=Math.min(48,+q.query.limit||12);
 const[items,total]=await Promise.all([Product.find(f).sort(so).skip((page-1)*lim).limit(lim).lean(),Product.countDocuments(f)]);
 r.set('Cache-Control','public,max-age=30').json({items,total,page,pages:Math.ceil(total/lim)})}));
R.get('/products/:id',w(async(q,r)=>{const k=q.params.id,p=await Product.findOne({active:true,...(/^[a-f\d]{24}$/i.test(k)?{_id:k}:{slug:k})}).lean();
 if(!p)throw bad('Product not found',404);r.json(p)}));
R.get('/facets',w(async(q,r)=>r.json({categories:await Product.distinct('category',{active:true}),brands:await Product.distinct('brand',{active:true})})));

const cartView=async uid=>{const c=await Cart.findOne({user:uid}).populate('items.product').lean();
 const items=(c?c.items:[]).filter(i=>i.product&&i.product.active).map(i=>({product:i.product,qty:Math.min(i.qty,i.product.stock)}));
 const subtotal=items.reduce((s,i)=>s+i.product.price*i.qty,0),delivery=subtotal&&subtotal<5000?99:0;return{items,subtotal,delivery,total:subtotal+delivery}};
const qty=v=>{v=+v;if(!Number.isInteger(v)||v<1||v>10)throw bad('Quantity must be 1-10');return v};
R.get('/cart',need,w(async(q,r)=>r.json(await cartView(q.user._id))));
R.post('/cart/items',need,w(async(q,r)=>{const n=qty(q.body.qty||1),p=await Product.findOne({_id:q.body.productId,active:true});
 if(!p)throw bad('Product not found',404);const c=await Cart.findOne({user:q.user._id})||new Cart({user:q.user._id,items:[]});
 const i=c.items.find(x=>String(x.product)===String(p._id)),t=(i?i.qty:0)+n;if(t>p.stock||t>10)throw bad(`Only ${Math.min(p.stock,10)} available`,409);
 i?i.qty=t:c.items.push({product:p._id,qty:n});await c.save();r.json(await cartView(q.user._id))}));
R.patch('/cart/items/:id',need,w(async(q,r)=>{const n=qty(q.body.qty),p=await Product.findById(q.params.id);if(!p||n>p.stock)throw bad('Not enough stock',409);
 await Cart.updateOne({user:q.user._id,'items.product':p._id},{$set:{'items.$.qty':n}});r.json(await cartView(q.user._id))}));
R.delete('/cart/items/:id',need,w(async(q,r)=>{await Cart.updateOne({user:q.user._id},{$pull:{items:{product:q.params.id}}});r.json(await cartView(q.user._id))}));

R.post('/orders',need,w(async(q,r)=>{const a=q.body.address||{},key=String(q.body.key||'').slice(0,64);
 if(!key)throw bad('Missing idempotency key');
 const dup=await Order.findOne({user:q.user._id,key});if(dup)return r.json({order:dup});
 const L=(v,m)=>String(v||'').trim().slice(0,m);const A={name:L(a.name,80),phone:L(a.phone,10),line:L(a.line,200),city:L(a.city,60),state:L(a.state,60),pin:L(a.pin,6),notes:L(a.notes,200)};
 if(!A.name||!/^\d{10}$/.test(A.phone)||!A.line||!A.city||!A.state||!/^\d{6}$/.test(A.pin))throw bad('Please complete a valid delivery address (10-digit phone, 6-digit PIN)');
 const c=await Cart.findOne({user:q.user._id});if(!c||!c.items.length)throw bad('Cart is empty');
 const done=[],lines=[];
 try{for(const i of c.items){const p=await Product.findOneAndUpdate({_id:i.product,active:true,stock:{$gte:i.qty}},{$inc:{stock:-i.qty,sold:i.qty}});
  if(!p)throw bad('An item is out of stock or unavailable. Please review your cart.',409);done.push(i);lines.push({product:p._id,name:p.name,sku:p.sku,price:p.price,qty:i.qty})}
  const subtotal=lines.reduce((s,l)=>s+l.price*l.qty,0),delivery=subtotal<5000?99:0;
  const o=await Order.create({number:'SC'+Date.now().toString(36).toUpperCase()+crypto.randomBytes(2).toString('hex').toUpperCase(),user:q.user._id,key,items:lines,address:A,email:q.user.email,subtotal,delivery,total:subtotal+delivery});
  await Cart.updateOne({user:q.user._id},{$set:{items:[]}});r.status(201).json({order:o});
 }catch(e){for(const i of done)await Product.updateOne({_id:i.product},{$inc:{stock:i.qty,sold:-i.qty}});
  if(e.code===11000&&e.keyPattern&&e.keyPattern.key)return r.json({order:await Order.findOne({user:q.user._id,key})});throw e}}));
R.get('/orders/my',need,w(async(q,r)=>r.json(await Order.find({user:q.user._id}).sort('-createdAt').lean())));
R.get('/orders/:id',need,w(async(q,r)=>{const o=await Order.findOne({_id:q.params.id,user:q.user._id}).lean();if(!o)throw bad('Order not found',404);r.json(o)}));
const restock=async o=>{for(const i of o.items)await Product.updateOne({_id:i.product},{$inc:{stock:i.qty,sold:-i.qty}})};
R.post('/orders/:id/cancel',need,w(async(q,r)=>{const o=await Order.findOneAndUpdate({_id:q.params.id,user:q.user._id,status:{$in:['Pending','Confirmed']}},{status:'Cancelled'},{new:true});
 if(!o)throw bad('This order can no longer be cancelled',409);await restock(o);r.json(o)}));

const next={Pending:['Confirmed','Cancelled'],Confirmed:['Processing','Cancelled'],Processing:['Shipped','Cancelled'],Shipped:['Delivered'],Delivered:[],Cancelled:[]};
R.get('/admin/dashboard',admin,w(async(q,r)=>{const g=await Order.aggregate([{$group:{_id:'$status',n:{$sum:1},t:{$sum:'$total'}}}]);const by=Object.fromEntries(g.map(x=>[x._id,x.n]));
 r.json({products:await Product.countDocuments(),customers:await User.countDocuments({role:'customer'}),lowStock:await Product.countDocuments({stock:{$lte:5}}),orders:by,revenue:(g.find(x=>x._id==='Delivered')||{t:0}).t})}));
const pf=b=>{const o={};for(const k of['name','sku','brand','category','desc','warranty'])if(b[k]!==undefined)o[k]=String(b[k]).slice(0,2000);
 for(const k of['price','mrp','stock']){if(b[k]!==undefined){const v=+b[k];if(!(v>=0))throw bad(k+' must be >= 0');o[k]=k==='stock'?Math.floor(v):v}}
 if(b.images)o.images=[].concat(b.images).map(String).filter(u=>/^(https?:\/\/|\/)/.test(u)).slice(0,8);
 for(const k of['featured','active'])if(b[k]!==undefined)o[k]=!!b[k];return o};
R.post('/admin/products',admin,w(async(q,r)=>{const o=pf(q.body);if(!o.name||o.price===undefined)throw bad('Name and price required');
 o.slug=o.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+crypto.randomBytes(2).toString('hex');r.status(201).json(await Product.create(o))}));
R.patch('/admin/products/:id',admin,w(async(q,r)=>{const p=await Product.findByIdAndUpdate(q.params.id,pf(q.body),{new:true});if(!p)throw bad('Not found',404);r.json(p)}));
R.delete('/admin/products/:id',admin,w(async(q,r)=>{const p=await Product.findByIdAndUpdate(q.params.id,{active:false},{new:true});if(!p)throw bad('Not found',404);r.json({ok:true})}));
R.get('/admin/products',admin,w(async(q,r)=>r.json(await Product.find().sort('stock').limit(200).lean())));
R.get('/admin/orders',admin,w(async(q,r)=>{const f=q.query.status?{status:String(q.query.status)}:{};if(q.query.q)f.number=new RegExp(esc(q.query.q).slice(0,30),'i');
 r.json(await Order.find(f).sort('-createdAt').limit(100).lean())}));
R.patch('/admin/orders/:id/status',admin,w(async(q,r)=>{const o=await Order.findById(q.params.id);if(!o)throw bad('Not found',404);const s=q.body.status;
 if(!(next[o.status]||[]).includes(s))throw bad(`Cannot move ${o.status} to ${s}`,409);
 const u=await Order.findOneAndUpdate({_id:o._id,status:o.status},{status:s,...(s==='Delivered'?{paymentStatus:'Paid'}:{})},{new:true});
 if(!u)throw bad('Order changed, reload',409);if(s==='Cancelled')await restock(u);r.json(u)}));
R.get('/admin/customers',admin,w(async(q,r)=>r.json(await User.find({role:'customer'}).select('-password').sort('-createdAt').limit(200).lean())));
R.get('/admin/inventory',admin,w(async(q,r)=>r.json(await Product.find({stock:{$lte:+q.query.max||5}}).select('name sku stock').sort('stock').lean())));
module.exports=R;
