// ASTRA isolated audit mode: deny all active operations BEFORE entrypoint execution.
if (process.env.ASTRA_RISK_MODE === "audit") {
  process.stderr.write("ASTRA_RISK_EFFECTS_BLOCKED "+JSON.stringify({entrypoint:"scripts/astra-social-oauth-vault.mjs",status:"BLOCKED",operationStatus:"UNVERIFIED",exitCode:78})+"\n");
  process.exit(78);
}
/**
 * ASTRA Social credential vault (server / GitHub Actions only).
 * Stores ONLY AES-256-GCM ciphertext in Git; never store OAuth secrets or passwords in the repository.
 * Instagram Login long-lived token refresh is supported. Revoked connections fail closed.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export const VAULT_PATH="data/social/account-vault.json";
const SITES_PATH="config/astra-social-sites.json";
const GRAPH="https://graph.instagram.com";
const DAYS=24*60*60*1000;
const RENEW_BEFORE_MS=21*DAYS;
const j=(file)=>JSON.parse(readFileSync(file,"utf8"));
export function readVault(path=VAULT_PATH) {
 const vault=existsSync(path)?j(path):{schema:1,accounts:{}};
 if(vault.schema!==1 || typeof vault.accounts!=="object" || !vault.accounts || Array.isArray(vault.accounts))throw Error("SOCIAL_VAULT_SCHEMA_INVALID");
 return vault;
}
export function getKey(raw=process.env.ASTRA_SOCIAL_VAULT_KEY) {
 if(!raw)throw Error("ASTRA_SOCIAL_VAULT_KEY_MISSING");
 const value=Buffer.from(raw,"base64");
 if(value.length!==32)throw Error("ASTRA_SOCIAL_VAULT_KEY_MUST_BE_32_BYTES_BASE64");
 return value;
}
export function encryptToken(token,key) {
 if(typeof token!=="string" || token.length<12)throw Error("SOCIAL_ACCESS_TOKEN_INVALID");
 const iv=randomBytes(12),enc=createCipheriv("aes-256-gcm",key,iv);
 const data=Buffer.concat([enc.update(token,"utf8"),enc.final()]);
 return {v:1,alg:"aes-256-gcm",iv:iv.toString("base64"),data:data.toString("base64"),tag:enc.getAuthTag().toString("base64")};
}
export function decryptToken(blob,key) {
 if(!blob || blob.v!==1 || blob.alg!=="aes-256-gcm")throw Error("SOCIAL_VAULT_ENCRYPTION_UNRECOGNIZED");
 const iv=Buffer.from(blob.iv,"base64"),tag=Buffer.from(blob.tag,"base64");
 if(iv.length!==12 || tag.length!==16)throw Error("SOCIAL_VAULT_CIPHERTEXT_INVALID");
 const dec=createDecipheriv("aes-256-gcm",key,iv);dec.setAuthTag(tag);
 return Buffer.concat([dec.update(Buffer.from(blob.data,"base64")),dec.final()]).toString("utf8");
}
function persist(vault,path=VAULT_PATH) {
 // Never write plaintext tokens; only account metadata and authenticated ciphertext.
 writeFileSync(path,JSON.stringify(vault,null,2)+"\n",{mode:0o600});
}
export function credentialMap(env=process.env, path=VAULT_PATH) {
 let external={};
 if(env.ASTRA_SOCIAL_META_ACCOUNTS_JSON){
  try {external=JSON.parse(env.ASTRA_SOCIAL_META_ACCOUNTS_JSON);if(!external||typeof external!=="object")throw Error();}
  catch {throw Error("ASTRA_SOCIAL_META_ACCOUNTS_JSON_INVALID");}
 }
 const vault=readVault(path),accounts=Object.values(vault.accounts);
 if(!accounts.length)return external;
 const key=getKey(env.ASTRA_SOCIAL_VAULT_KEY);
 for(const account of accounts) {
  if(account.status==="RECONNECT_REQUIRED" || !account.encryptedToken)continue;
  if(!account.siteId || !account.accountId)continue;
  if(account.expiresAt && Date.parse(account.expiresAt)<=Date.now())continue;
  external[account.siteId]={...external[account.siteId],instagram:{
   accountId:account.accountId,accessToken:decryptToken(account.encryptedToken,key),
   authMode:account.authMode||"instagram_login"
  }};
 }
 return external;
}
async function metaGet(url) {
 const resp=await fetch(url,{headers:{"user-agent":"ASTRA-SOCIAL-OAUTH/1.0"},signal:AbortSignal.timeout(18000)});
 const data=await resp.json().catch(()=>({}));
 if(!resp.ok || data.error){
  const err=new Error("INSTAGRAM_OAUTH_HTTP_"+resp.status+"_CODE_"+String(data.error?.code??"unknown"));
  err.httpStatus=resp.status; err.oauthCode=data.error?.code;throw err;
 }
 return data;
}
async function exchangeAuthorizationCode({code,siteId,redirectUri,env=process.env}) {
 if(!/^[a-z][a-z0-9_-]{1,40}$/.test(siteId))throw Error("INVALID_SITE_ID");
 const sites=j(SITES_PATH).sites;
 if(!sites.some(s=>s.id===siteId))throw Error("UNKNOWN_SITE_ID");
 const appId=env.ASTRA_SOCIAL_INSTAGRAM_APP_ID,appSecret=env.ASTRA_SOCIAL_INSTAGRAM_APP_SECRET;
 if(!appId || !appSecret || !redirectUri?.startsWith("https://"))throw Error("SOCIAL_INSTAGRAM_APP_CONFIGURATION_MISSING");
 // POST short token exchange. No logging of code, secret, token or response body.
 const response=await fetch("https://api.instagram.com/oauth/access_token",{
  method:"POST",body:new URLSearchParams({client_id:appId,client_secret:appSecret,grant_type:"authorization_code",redirect_uri:redirectUri,code}),
  signal:AbortSignal.timeout(18000)
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw Error("INSTAGRAM_AUTHORIZATION_CODE_HTTP_"+response.status);
 const short=payload.access_token||payload.data?.[0]?.access_token;
 const accountId=String(payload.user_id||payload.data?.[0]?.user_id||"");
 if(!short||!accountId)throw Error("INSTAGRAM_AUTHORIZATION_CODE_MISSING_TOKEN_OR_ACCOUNT");
 const longUrl=new URL(GRAPH+"/access_token");
 longUrl.searchParams.set("grant_type","ig_exchange_token");
 longUrl.searchParams.set("client_secret",appSecret);
 longUrl.searchParams.set("access_token",short);
 const long=await metaGet(longUrl);
 if(!long.access_token||!Number.isFinite(Number(long.expires_in)))throw Error("INSTAGRAM_LONG_LIVED_EXCHANGE_FAILED");
 return {accountId,token:long.access_token,expiresIn:Number(long.expires_in)};
}
export async function enroll({siteId,code,redirectUri,env=process.env,path=VAULT_PATH}) {
 const key=getKey(env.ASTRA_SOCIAL_VAULT_KEY);
 const result=await exchangeAuthorizationCode({siteId,code,redirectUri,env});
 const vault=readVault(path),stamp=new Date();
 vault.accounts[siteId]={siteId,network:"instagram",authMode:"instagram_login",accountId:result.accountId,
  status:"CONNECTED",encryptedToken:encryptToken(result.token,key),
  issuedAt:stamp.toISOString(),expiresAt:new Date(stamp.getTime()+result.expiresIn*1000).toISOString(),
  refreshedAt:stamp.toISOString(),errorCode:null};
 persist(vault,path);
 // Only print public status, never token or OAuth code.
 return {siteId,status:"CONNECTED",accountId:result.accountId,expiresAt:vault.accounts[siteId].expiresAt};
}
export async function renew({path=VAULT_PATH,env=process.env,force=false,time=Date.now()}={}) {
 const vault=readVault(path);let renewed=0,reconnect=0,retry=0,healthy=0;
 const records=Object.values(vault.accounts);
 if(!records.length)return {status:"NO_AUTHORIZED_ACCOUNTS",renewed,reconnect,retry,healthy};
 const key=getKey(env.ASTRA_SOCIAL_VAULT_KEY);
 for(const row of records){
  if(row.status==="RECONNECT_REQUIRED"){reconnect++;continue;}
  if(row.authMode!=="instagram_login"){healthy++;continue;}
  const expires=Date.parse(row.expiresAt||"");
  if(!Number.isFinite(expires)){row.status="RECONNECT_REQUIRED";row.errorCode="MISSING_EXPIRATION";reconnect++;continue;}
  if(!force && expires-time>RENEW_BEFORE_MS){healthy++;continue;}
  if(expires<=time){row.status="RECONNECT_REQUIRED";row.errorCode="EXPIRED";reconnect++;continue;}
  try{
   const token=decryptToken(row.encryptedToken,key);
   const url=new URL(GRAPH+"/refresh_access_token");
   url.searchParams.set("grant_type","ig_refresh_token");url.searchParams.set("access_token",token);
   const result=await metaGet(url);
   if(!result.access_token || !Number.isFinite(Number(result.expires_in)))throw Error("INSTAGRAM_REFRESH_MISSING_TOKEN");
   row.encryptedToken=encryptToken(result.access_token,key);
   row.expiresAt=new Date(time+Number(result.expires_in)*1000).toISOString();
   row.refreshedAt=new Date(time).toISOString();row.errorCode=null;row.status="CONNECTED";renewed++;
  }catch(err){
   // 400/401 usually means revoked or an invalid token; 429/5xx are recoverable.
   const status=err.httpStatus;
   const authFailure=status===400||status===401;
   row.errorCode=String(err.message||"REFRESH_FAILED").slice(0,90);
   if(authFailure){row.status="RECONNECT_REQUIRED";reconnect++;}
   else{row.status="RETRY_REFRESH";retry++;}
  }
 }
 persist(vault,path);
 return {status:reconnect?"RECONNECT_REQUIRED":retry?"PARTIAL_REFRESH":"REFRESH_OK",renewed,reconnect,retry,healthy};
}
async function main(){
 const command=process.argv[2];
 if(command==="renew"){console.log("ASTRA_SOCIAL_TOKEN_REFRESH",JSON.stringify(await renew()));return;}
 if(command==="health"){
  const vault=readVault(),out=Object.values(vault.accounts).map(x=>({siteId:x.siteId,network:x.network,status:x.status,expiresAt:x.expiresAt,errorCode:x.errorCode}));
  console.log(JSON.stringify({accounts:out}));return;
 }
 if(command==="enroll"){
  const siteId=process.env.ASTRA_SOCIAL_IG_SITE_ID,code=process.env.ASTRA_SOCIAL_IG_AUTHORIZATION_CODE,redirectUri=process.env.ASTRA_SOCIAL_IG_REDIRECT_URI;
  if(!siteId||!code||!redirectUri)throw Error("ENROLL_INPUT_MISSING");
  console.log("ASTRA_SOCIAL_ENROLL",JSON.stringify(await enroll({siteId,code,redirectUri})));return;
 }
 throw Error("Use renew|health|enroll");
}
if(process.argv[1]===fileURLToPath(import.meta.url))main().catch(e=>{console.error("ASTRA_SOCIAL_OAUTH_FAIL",String(e.message||e));process.exitCode=1;});
