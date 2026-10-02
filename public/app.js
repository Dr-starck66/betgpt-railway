const q=s=>document.querySelector(s);
const chat=q("#chat");
document.addEventListener("click",e=>{
 if(e.target.closest("[data-open-chat]")){chat?.classList.add("open");chat?.setAttribute("aria-hidden","false")}
 if(e.target.closest("[data-close-chat]")){chat?.classList.remove("open");chat?.setAttribute("aria-hidden","true")}
 const b=e.target.closest("[data-product]");
 if(b){const p=b.dataset.product;const out=q("#quoteResult");out.hidden=false;out.innerHTML=`<strong>${b.textContent.trim()}</strong><br>Checking verified partner routes…`;
 fetch("/api/partner?product="+encodeURIComponent(p)).then(r=>r.json()).then(j=>{
   if(j.active&&j.partner?.url){out.innerHTML=`<strong>${b.textContent.trim()}</strong><br>Verified partner available: ${j.partner.name}. Partner compensation may apply. <a class="primary" rel="sponsored nofollow" href="${j.partner.url}">Continue to quote partner</a>`;}
   else{out.innerHTML=`<strong>${b.textContent.trim()}</strong><br>No verified commercial partner is active for this category yet, so we will not fabricate a quote or affiliate destination.`;}
 }).catch(()=>{out.textContent="Partner route unavailable right now.";});}
});
q("#chatForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const input=q("#chatInput");const body=q("#chatBody");const msg=input.value.trim();if(!msg)return;
 body.insertAdjacentHTML("beforeend",`<div class="user">${msg.replace(/[<>&]/g,"")}</div>`);input.value="";
 try{const r=await fetch("/api/chat",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:msg})});const j=await r.json();body.insertAdjacentHTML("beforeend",`<div class="bot">${String(j.reply||"").replace(/[<>&]/g,"")}</div>`)}catch{body.insertAdjacentHTML("beforeend",'<div class="bot">I could not answer that request right now.</div>')}
 body.scrollTop=body.scrollHeight;
});