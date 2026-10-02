const q=s=>document.querySelector(s);
const chat=q("#chat");
document.addEventListener("click",e=>{
 if(e.target.closest("[data-open-chat]")){chat?.classList.add("open");chat?.setAttribute("aria-hidden","false")}
 if(e.target.closest("[data-close-chat]")){chat?.classList.remove("open");chat?.setAttribute("aria-hidden","true")}
 const b=e.target.closest("[data-product]");
 if(b){const p=b.dataset.product;const out=q("#quoteResult");out.hidden=false;out.innerHTML=`<strong>${b.textContent.trim()}</strong><br>We’re preparing the comparison path for this category. No fake premium will be shown. Once an approved quote partner is connected, this step will route to the verified partner flow with disclosure and tracking.`;}
});
q("#chatForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const input=q("#chatInput");const body=q("#chatBody");const msg=input.value.trim();if(!msg)return;
 body.insertAdjacentHTML("beforeend",`<div class="user">${msg.replace(/[<>&]/g,"")}</div>`);input.value="";
 try{const r=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:msg})});const j=await r.json();body.insertAdjacentHTML("beforeend",`<div class="bot">${String(j.reply||"").replace(/[<>&]/g,"")}</div>`)}catch{body.insertAdjacentHTML("beforeend",'<div class="bot">I could not answer that request right now.</div>')}
 body.scrollTop=body.scrollHeight;
});