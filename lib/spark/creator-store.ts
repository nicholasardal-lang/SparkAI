// Public Roblox Creator Store discovery. No Roblox account cookies, purchases,
// executable model downloads, or OpenAI requests are involved.
export type StoreModel = {id:string;name:string;creator:string;verified:boolean;scriptCount:number|null;thumbnail:string|null;url:string};
const SEARCH='https://apis.roblox.com/toolbox-service/v2/assets:search';
export function freeModels(data:any):StoreModel[]{
 if(!Array.isArray(data?.creatorStoreAssets))throw Error('Invalid Creator Store response');
 const seen=new Set<string>();
 return data.creatorStoreAssets.slice(0,24).flatMap((item:any)=>{
  const a=item.asset,p=item.creatorStoreProduct,q=p?.purchasePrice?.quantity,id=String(a?.id??'');
  if(!/^[1-9][0-9]{0,15}$/.test(id)||!Number.isSafeInteger(Number(id))||seen.has(id)||a?.assetTypeId!==10||p?.purchasable!==true||!q||!['0',0].includes(q.significand)||typeof a.name!=='string')return [];
  seen.add(id);
  return [{id,name:a.name.slice(0,160),creator:String(item.creator?.name||'Roblox creator').slice(0,100),verified:item.creator?.verified===true,scriptCount:Number.isInteger(a.scriptCount)&&a.scriptCount>=0?a.scriptCount:null,thumbnail:null,url:`https://create.roblox.com/store/asset/${id}`}];
 });
}
export async function searchCreatorStore(query:string,pageToken='',fetcher:typeof fetch=fetch){
 if(!query.trim()||query.length>120||pageToken.length>1024)throw Error('Invalid search');
 const signal=AbortSignal.timeout(12000);
 const init={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({searchCategoryType:'Model',query:query.trim(),maxPageSize:12,minPriceCents:0,maxPriceCents:0,...(pageToken?{pageToken}:{})}),signal};
 let response=await fetcher(SEARCH,init);
 const csrf=response.headers.get('x-csrf-token');
 // Roblox's normal anonymous CSRF handshake; no authentication is bypassed.
 if(response.status===403&&csrf)response=await fetcher(SEARCH,{...init,headers:{...init.headers,'x-csrf-token':csrf}});
 if(!response.ok)throw Error('Creator Store unavailable');
 const data:any=await response.json();
 const models=freeModels(data);
 if(models.length)try{
  const thumbs=await fetcher(`https://thumbnails.roblox.com/v1/assets?assetIds=${models.map(m=>m.id).join(',')}&size=420x420&format=Png&isCircular=false`,{signal});
  if(thumbs.ok){const images=await thumbs.json() as any;for(const image of Array.isArray(images.data)?images.data:[]){
   const model=models.find(m=>m.id===String(image.targetId));
   if(model&&image.state==='Completed'&&typeof image.imageUrl==='string'){
    const u=new URL(image.imageUrl);if(u.protocol==='https:'&&u.hostname.endsWith('.rbxcdn.com')&&!u.username&&!u.password)model.thumbnail=u.href;
   }
  }}
 }catch{/* Search remains usable if Roblox thumbnails are delayed. */}
 return {models,nextPageToken:typeof data.nextPageToken==='string'&&data.nextPageToken.length<=1024?data.nextPageToken:null};
}
