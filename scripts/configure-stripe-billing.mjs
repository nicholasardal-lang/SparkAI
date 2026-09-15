import { readFileSync } from 'node:fs';
const secret=readFileSync(new URL('../.env.stripe',import.meta.url),'utf8').match(/^STRIPE_SECRET_KEY\s*=\s*["']?([^\s"']+)/m)?.[1];
if(!secret?.startsWith('sk_test_'))throw new Error('A sandbox Stripe key is required');
const origin='https://spark-roblox-creative-workspace.puriux.chatgpt.site';
async function call(path,params){
 const response=await fetch('https://api.stripe.com/v1/'+path,{method:params?'POST':'GET',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/x-www-form-urlencoded'},body:params?.toString()});
 const data=await response.json();if(!response.ok)throw new Error(`Stripe configuration failed (${response.status}, ${data.error?.code||data.error?.type})`);return data;
}
const hooks=await call('webhook_endpoints?limit=100');
const hook=hooks.data.find(h=>h.url===origin+'/api/stripe/webhook');
if(!hook)throw new Error('Spark webhook was not found');
const events=[...new Set([...hook.enabled_events,'invoice.paid','invoice.payment_failed','customer.subscription.updated','customer.subscription.deleted','checkout.session.completed'])];
const hookParams=new URLSearchParams();events.forEach((e,i)=>hookParams.set(`enabled_events[${i}]`,e));
await call('webhook_endpoints/'+hook.id,hookParams);
const configs=await call('billing_portal/configurations?limit=100');
const config=configs.data.find(c=>c.is_default&&c.active);
const params=new URLSearchParams({'business_profile[headline]':'Manage your Spark subscription','default_return_url':origin+'/account?tab=billing','features[invoice_history][enabled]':'true','features[payment_method_update][enabled]':'true','features[subscription_cancel][enabled]':'true','features[subscription_cancel][mode]':'at_period_end'});
const result=await call('billing_portal/configurations'+(config?'/'+config.id:''),params);
console.log(JSON.stringify({webhookEvents:events,portalConfigured:result.active,cancellation:result.features.subscription_cancel.mode,paymentMethods:result.features.payment_method_update.enabled,invoices:result.features.invoice_history.enabled}));
