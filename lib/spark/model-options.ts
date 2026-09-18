import type {StoreModel} from './creator-store.ts';
export const MODEL_OPTIONS_PREFIX='SPARK_MODEL_OPTIONS_V1\n';
export type ModelOptions={query:string;models:StoreModel[];selectedId?:string};
export function readModelOptions(content:string):ModelOptions|null{
 if(!content.startsWith(MODEL_OPTIONS_PREFIX))return null;
 try{const value=JSON.parse(content.slice(MODEL_OPTIONS_PREFIX.length));return typeof value.query==='string'&&Array.isArray(value.models)?value:null;}catch{return null;}
}
export function modelSearchTerms(prompt:string){
 return prompt.replace(/^(?:please\s+)?(?:can you\s+)?(?:make|create|generate|build|design|model)\s+(?:me\s+)?(?:an?\s+)?/i,'').replace(/\s+(?:for|in)\s+(?:my\s+)?(?:roblox|game|studio).*$/i,'').replace(/\b(?:please|downloadable|model)\b/gi,'').replace(/\s+/g,' ').trim().slice(0,120)||prompt.trim().slice(0,120);
}
