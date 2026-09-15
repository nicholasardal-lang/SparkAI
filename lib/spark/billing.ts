import type {DB,Runtime} from "./core.ts";
import {plans,stripePrices} from "./plans.ts";
export async function stripe(env:Runtime,path:string,fetcher:typeof fetch=fetch,params?:URLSearchParams){
 if(!env.STRIPE_SECRET_KEY)throw new Error("Stripe is not configured");
 const r=await fetcher("https://api.stripe.com/v1/"+path,{method:params?"POST":"GET",headers:{Authorization:`Bearer ${env.STRIPE_SECRET_KEY}`,"Content-Type":"application/x-www-form-urlencoded"},...(params?{body:params.toString()}:{}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error("Stripe could not verify billing");return r.json() as Promise<any>;
}
export function monthAt(start:number,n:number){const d=new Date(start);const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return d.getTime();}
export function estimateCredits(inputChars:number,contextChars=0,maxOutputTokens=2048){return Math.max(1,Math.ceil((Math.max(0,inputChars)+Math.max(0,contextChars)+2000+maxOutputTokens*5)/1000));}
export async function syncSubscription(env:Runtime,userId:string,subId:string,fetcher:typeof fetch=fetch){
 const s=await stripe(env,`subscriptions/${encodeURIComponent(subId)}?expand[]=latest_invoice`,fetcher);
 const item=s.items?.data?.[0];const price=item?.price?.id;
 const plan=plans.find(p=>Object.values(stripePrices[p.id]).includes(price));
 if(!plan||s.metadata?.user_id!==userId)throw new Error("Subscription does not match this account");
 const start=Number(item.current_period_start||s.current_period_start)*1000,end=Number(item.current_period_end||s.current_period_end)*1000;
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)throw new Error("Invalid billing period");
 const old=await env.DB.prepare("SELECT paid_until,period_start FROM billing_accounts WHERE user_id=?").bind(userId).first();
 // Only a paid invoice extends the entitlement. A failed renewal never advances it.
 const paid=s.latest_invoice?.status==="paid"?end:Number(old?.paid_until||0);
 const yearly=price===stripePrices[plan.id].yearly;
 if(s.latest_invoice?.status!=="paid"&&old?.period_start){
   await env.DB.prepare("UPDATE billing_accounts SET subscription_status=?,cancel_at_period_end=?,updated_at=? WHERE user_id=?").bind(s.status,s.cancel_at_period_end?1:0,Date.now(),userId).run();
   return;
 }
 await env.DB.prepare("INSERT INTO billing_accounts (user_id,stripe_customer_id,stripe_subscription_id,plan_id,billing_period,subscription_status,updated_at,paid_until,period_start,cancel_at_period_end) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET stripe_customer_id=excluded.stripe_customer_id,stripe_subscription_id=excluded.stripe_subscription_id,plan_id=excluded.plan_id,billing_period=excluded.billing_period,subscription_status=excluded.subscription_status,updated_at=excluded.updated_at,paid_until=excluded.paid_until,period_start=excluded.period_start,cancel_at_period_end=excluded.cancel_at_period_end").bind(userId,s.customer,s.id,plan.id,yearly?"yearly":"monthly",s.status,Date.now(),paid,start,s.cancel_at_period_end?1:0).run();
}
export async function balance(env:Runtime,userId:string,fetcher:typeof fetch=fetch){
 let b=await env.DB.prepare("SELECT * FROM billing_accounts WHERE user_id=?").bind(userId).first();
 if(b?.stripe_subscription_id&&(!b.paid_until||Date.now()-b.updated_at>60000)){
  try{await syncSubscription(env,userId,b.stripe_subscription_id,fetcher);b=await env.DB.prepare("SELECT * FROM billing_accounts WHERE user_id=?").bind(userId).first();}catch{ /* Expiration remains enforced even when Stripe is unavailable. */ }
 }
 const now=Date.now(),active=!!b&&b.paid_until>now&&["active","past_due"].includes(b.subscription_status);
 if(active&&b?.period_start){
  const p=plans.find(p=>p.id===b.plan_id);
  if(p){
   let n=0;while(n<12&&monthAt(b.period_start,n+1)<=now)n++;
   const start=monthAt(b.period_start,n),end=Math.min(monthAt(b.period_start,n+1),b.paid_until);
   if(start<=now&&end>now){
    const bucketId=`plan:${b.stripe_subscription_id}:${start}`;
    await env.DB.batch([
     env.DB.prepare("INSERT INTO credit_buckets (id,user_id,remaining,expires,source) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(bucketId,userId,p.credits,end,"plan"),
     env.DB.prepare("INSERT INTO credit_ledger (id,user_id,amount,source,stripe_reference,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(stripe_reference) DO NOTHING").bind(crypto.randomUUID(),userId,p.credits,"subscription_grant",`grant:${bucketId}`,Date.now()),
    ]);
   }
  }
 } else {
  await env.DB.prepare("UPDATE credit_buckets SET expires=? WHERE user_id=? AND source='plan' AND expires>?").bind(now,userId,now).run();
 }
 const row=await env.DB.prepare("SELECT COALESCE(SUM(remaining),0) AS credits FROM credit_buckets WHERE user_id=? AND (expires IS NULL OR expires>?)").bind(userId,now).first();
 return {credits:Number(row.credits),active,plan:b?.plan_id||null,paidUntil:b?.paid_until||null,cancelAtPeriodEnd:!!b?.cancel_at_period_end,status:b?.subscription_status||"none"};
}
// Reservation serializes spending across projects. It cannot exceed available credits.
export async function reserve(db:DB,userId:string,id:string,amount:number){
 const now=Date.now();
 await db.batch([
  db.prepare("UPDATE credit_buckets SET remaining=remaining+COALESCE((SELECT SUM(json_extract(value,'$.amount')) FROM credit_locks,json_each(credit_locks.parts) WHERE credit_locks.user_id=? AND credit_locks.expires<? AND json_extract(value,'$.id')=credit_buckets.id),0) WHERE user_id=?").bind(userId,now,userId),
  db.prepare("DELETE FROM credit_locks WHERE user_id=? AND expires<?").bind(userId,now),
 ]);
 const lock=await db.prepare("INSERT INTO credit_locks (user_id,request_id,expires) VALUES (?,?,?) ON CONFLICT(user_id) DO NOTHING RETURNING user_id").bind(userId,id,now+120000).first();
 if(!lock)throw new Error("Another AI request is still using credits. Please wait.");
 const buckets=(await db.prepare("SELECT * FROM credit_buckets WHERE user_id=? AND remaining>0 AND (expires IS NULL OR expires>?) ORDER BY expires IS NULL,expires,id").bind(userId,Date.now()).all()).results;
 if(buckets.reduce((n:number,b:any)=>n+b.remaining,0)<amount){await db.prepare("DELETE FROM credit_locks WHERE user_id=? AND request_id=?").bind(userId,id).run();throw new Error("Not enough Spark Credits for this request. Add credits or ask for a smaller response.");}
 let left=amount;const parts:any[]=[];for(const b of buckets){const take=Math.min(left,b.remaining);if(take){parts.push({id:b.id,amount:take});left-=take;}if(!left)break;}
 await db.batch([...parts.map(p=>db.prepare("UPDATE credit_buckets SET remaining=remaining-? WHERE id=?").bind(p.amount,p.id)),db.prepare("UPDATE credit_locks SET parts=? WHERE user_id=? AND request_id=?").bind(JSON.stringify(parts),userId,id)]);
 return parts;
}
export async function settle(db:DB,userId:string,id:string,parts:any[],cost:number,extra:any[]=[]){
 if(!(await db.prepare("SELECT request_id FROM credit_locks WHERE user_id=? AND request_id=?").bind(userId,id).first()))throw new Error("Credit reservation expired. Please retry.");
 let charged=cost;const statements=[];for(const p of parts){const use=Math.min(charged,p.amount);charged-=use;statements.push(db.prepare("UPDATE credit_buckets SET remaining=remaining+? WHERE id=?").bind(p.amount-use,p.id));}
 if(cost)statements.push(db.prepare("INSERT INTO credit_ledger (id,user_id,amount,source,stripe_reference,created_at) VALUES (?,?,?,'ai_usage',?,?) ON CONFLICT(stripe_reference) DO NOTHING").bind(crypto.randomUUID(),userId,-cost,`ai:${id}`,Date.now()));
 statements.push(...extra,db.prepare("DELETE FROM credit_locks WHERE user_id=? AND request_id=?").bind(userId,id));await db.batch(statements);
}
