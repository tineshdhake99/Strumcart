require("dotenv").config();

const express=require('express'),mongoose=require('mongoose'),session=require('express-session'),MongoStore=require('connect-mongo'),helmet=require('helmet'),rl=require('express-rate-limit'),comp=require('compression'),path=require('path');
const {SESSION_SECRET,MONGO_URI,NODE_ENV}=process.env;
if(!SESSION_SECRET||!MONGO_URI){console.error('Set SESSION_SECRET and MONGO_URI in .env');throw new Error('Missing env')}
const conn=global._mongo||(global._mongo=mongoose.connect(MONGO_URI));
conn.catch(()=>{global._mongo=null});
const app=express();const prod=NODE_ENV==='production';
if(prod||process.env.VERCEL)app.set('trust proxy',1);
app.use((q,r,n)=>conn.then(()=>n(),n));
app.use(helmet({contentSecurityPolicy:{useDefaults:true,directives:{'img-src':["'self'",'data:','https:']}}}));
app.use(comp(),express.json({limit:'50kb'}));
app.use(session({name:'sc.sid',secret:SESSION_SECRET,resave:false,saveUninitialized:false,store:MongoStore.create({clientPromise:conn.then(m=>m.connection.getClient())}),cookie:{httpOnly:true,sameSite:'lax',secure:prod,maxAge:7*864e5}}));
app.get('/api/csrf',(q,r)=>{q.session.csrf=q.session.csrf||require('crypto').randomBytes(24).toString('hex');r.json({csrf:q.session.csrf})});
app.use('/api',(q,r,n)=>{if(['GET','HEAD'].includes(q.method))return n();if(!q.session.csrf||q.get('x-csrf-token')!==q.session.csrf)return r.status(403).json({error:'Invalid CSRF token'});n()});
app.use('/api/auth/login',rl({windowMs:9e5,max:20}));app.use('/api/auth/register',rl({windowMs:36e5,max:20}));
app.use('/api',require('./server/routes'));
app.use('/api',(q,r)=>r.status(404).json({error:'Not found'}));
app.use(express.static(path.join(__dirname,'public'),{maxAge:prod?'1h':0}));
app.use((e,q,r,n)=>{if(e.code===11000)return r.status(409).json({error:'Already exists'});if(e.name==='CastError')return r.status(400).json({error:'Invalid id'});if(e.status)return r.status(e.status).json({error:e.message});console.error(e);r.status(500).json({error:'Server error'})});
module.exports=app;

if(require.main===module)app.listen(process.env.PORT||3000,()=>console.log('StrumCart on http://localhost:'+(process.env.PORT||3000)));
