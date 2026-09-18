// Retrieve only models already offered in a user's conversation. Credentials
// go to the official delivery endpoint, never to the returned CDN location.
export async function downloadModel(id:string,key:string,fetcher:typeof fetch=fetch){
 if(!/^[1-9][0-9]{0,15}$/.test(id))throw Error('Invalid model ID.');
 if(!key)throw Error('Model downloads are not connected yet. The Spark owner needs to configure Roblox asset delivery.');
 const signal=AbortSignal.timeout(20000);
 const response=await fetcher(`https://apis.roblox.com/asset-delivery-api/v1/assetId/${id}`,{headers:{'x-api-key':key},signal,redirect:'manual'});
 if(!response.ok)throw Error(response.status===401||response.status===403?'Roblox has not authorized Spark to download this model.':'Roblox could not deliver this model. Please try again later.');
 const data:any=await response.json();
 const location=data.location||data.locations?.[0]?.location;
 const url=new URL(location);
 // Roblox delivers assets through both its legacy CDN and its newer byte endpoint.
 const trustedHost=url.hostname.endsWith('.rbxcdn.com')||url.hostname==='contentdelivery.roblox.com';
 if(url.protocol!=='https:'||!trustedHost||url.username||url.password||url.port)throw Error('Roblox returned an unsupported download location.');
 const file=await fetcher(url.href,{signal,redirect:'manual'});
 if(!file.ok||!file.body)throw Error('The model file is unavailable.');
 const limit=20*1024*1024;
 if(Number(file.headers.get('content-length'))>limit){await file.body.cancel();throw Error('This model exceeds the 20 MB download limit.');}
 const reader=file.body.getReader(),chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw Error('This model exceeds the 20 MB download limit.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 const header=new TextDecoder().decode(bytes.slice(0,512));
 const binary=header.startsWith('<roblox!');
 if(!binary&&!/^(?:\uFEFF)?\s*(?:<\?xml[^>]*>\s*)?<roblox\b/.test(header))throw Error('Roblox did not return a model file.');
 return {bytes,extension:binary?'rbxm':'rbxmx'};
}
