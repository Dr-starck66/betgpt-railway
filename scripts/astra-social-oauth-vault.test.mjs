import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomBytes} from "node:crypto";
import {getKey,encryptToken,decryptToken,readVault,credentialMap,renew} from "./astra-social-oauth-vault.mjs";
test("AES-GCM round trip, distinct IVs, wrong key rejected",()=>{
 const key=randomBytes(32);
 const a=encryptToken("IG_LONG_LIVED_TEST_TOKEN",key),b=encryptToken("IG_LONG_LIVED_TEST_TOKEN",key);
 assert.notEqual(a.iv,b.iv);assert.notEqual(a.data,b.data);
 assert.equal(decryptToken(a,key),"IG_LONG_LIVED_TEST_TOKEN");
 assert.throws(()=>decryptToken(a,randomBytes(32)));
 assert.throws(()=>getKey("not-a-valid-key"));
});
test("No credentials ever appear in encrypted repository vault",()=>{
 const dir=mkdtempSync(join(tmpdir(),"astra-vault-"));
 try{
  const file=join(dir,"vault.json"),key=randomBytes(32);
  const encryptedToken=encryptToken("IG_SECRET_123456789XYZ",key);
  const vault={schema:1,accounts:{betgpt:{siteId:"betgpt",network:"instagram",authMode:"instagram_login",accountId:"123456789",
    expiresAt:"2100-01-01T00:00:00Z",status:"CONNECTED",encryptedToken}}};
  writeFileSync(file,JSON.stringify(vault));
  assert.equal(readFileSync(file,"utf8").includes("IG_SECRET"),false);
  const accounts=credentialMap({ASTRA_SOCIAL_VAULT_KEY:key.toString("base64")},file);
  assert.equal(accounts.betgpt.instagram.accessToken,"IG_SECRET_123456789XYZ");
  assert.equal(accounts.betgpt.instagram.authMode,"instagram_login");
  assert.equal(accounts.betgpt.instagram.accountId,"123456789");
  assert.equal(accounts.betgpt.x,undefined);
 } finally{rmSync(dir,{recursive:true,force:true});}
});
test("Bootstrap refresh of empty vault requires no token",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"astra-empty-"));
 try{
  const file=join(dir,"vault.json");
  assert.deepEqual(readVault(file),{schema:1,accounts:{}});
  const a=await renew({path:file,env:{}});
  assert.equal(a.status,"NO_AUTHORIZED_ACCOUNTS");
  assert.equal(credentialMap({},file).betgpt,undefined);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test("Expired authorization fails closed, with no external refresh request",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"astra-expired-"));
 try{
  const file=join(dir,"vault.json"),key=randomBytes(32);
  writeFileSync(file,JSON.stringify({schema:1,accounts:{betgpt:{
   siteId:"betgpt",network:"instagram",authMode:"instagram_login",accountId:"1234",
   encryptedToken:encryptToken("IG_TEST_TOKEN_MORE_THAN_12",key),
   expiresAt:"2025-01-01T00:00:00Z",status:"CONNECTED"
  }}}));
  const result=await renew({path:file,env:{ASTRA_SOCIAL_VAULT_KEY:key.toString("base64")},time:Date.parse("2026-10-12")});
  assert.equal(result.status,"RECONNECT_REQUIRED");
  assert.equal(readVault(file).accounts.betgpt.status,"RECONNECT_REQUIRED");
  assert.equal(Object.keys(credentialMap({ASTRA_SOCIAL_VAULT_KEY:key.toString("base64")},file)).length,0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
