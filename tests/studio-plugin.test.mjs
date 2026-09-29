// Run with the official Luau CLI path as argv[2]. Roblox services below are test doubles;
// this exercises plugin control flow, not Roblox's rendering, permissions or Undo engine.
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const prelude=String.raw`
local nodes={}
local signal={Connect=function() end}
local methods={}
function methods:IsA(kind) return self.ClassName==kind or kind=="BaseScript" and (self.ClassName=="Script" or self.ClassName=="LocalScript") end
function methods:GetAttribute(k) return self.attrs[k] end
function methods:SetAttribute(k,v) self.attrs[k]=v end
function methods:GetChildren() local out={} for _,v in ipairs(nodes) do if v.Parent==self and not v.dead then table.insert(out,v) end end return out end
function methods:GetDescendants() local out={} for _,v in ipairs(self:GetChildren()) do table.insert(out,v) for _,d in ipairs(v:GetDescendants()) do table.insert(out,d) end end return out end
function methods:FindFirstChild(name) for _,v in ipairs(self:GetChildren()) do if v.Name==name then return v end end end
function methods:Destroy() for _,v in ipairs(self:GetChildren()) do v:Destroy() end self.Parent=nil self.dead=true end
local Instance={new=function(class)
 local values={ClassName=class,Name=class,attrs={},Click=signal,MouseButton1Click=signal}
 local node=setmetatable({}, {__index=function(_,k)return methods[k] or values[k]end,__newindex=function(_,k,v)values[k]=v end})
 table.insert(nodes,node) return node
end}
local UDim={new=function(...)return {...}end}
local UDim2={new=function(...)return {...}end,fromScale=function(...)return {...}end}
local Color3={fromRGB=function(...)return {...}end}
local Vector3={new=function(...)return {...}end}
local DockWidgetPluginGuiInfo={new=function(...)return {...}end}
local Enum={InitialDockState={Right=1},AutomaticSize={Y=1},SortOrder={LayoutOrder=1},Font={SourceSans=1},TextXAlignment={Left=1},TextYAlignment={Top=1},PartType={Block=1,Ball=0,Cylinder=2},FinishRecordingOperation={Commit='commit',Cancel='cancel'}}
local commits,playing,selection=0,false,nil
local services={}
local game=Instance.new('DataModel') game.PlaceId=123 game.Name='Test place'
function game:GetService(name)return services[name]end
for _,name in ipairs({'Workspace','ServerScriptService','ServerStorage','ReplicatedStorage','ReplicatedFirst','StarterGui','StarterPack','StarterPlayer'}) do local v=Instance.new(name) v.Parent=game services[name]=v end
services.HttpService={}
services.ChangeHistoryService={TryBeginRecording=function()return 'recording'end,FinishRecording=function(_,_,op)if op=='commit' then commits+=1 end end}
services.Selection={Set=function(_,value)selection=value end}
services.ScriptEditorService={UpdateSourceAsync=function(_,node,callback)node.Source=callback()end}
services.RunService={IsRunning=function()return playing end}
services.AssetService={LoadAssetAsync=function()local m=Instance.new('Model') m.Sandboxed=true local s=Instance.new('Script') s.Parent=m return m end}
local plugin={Unloading=signal,CreateToolbar=function()return {CreateButton=function()return Instance.new('TextButton')end}end,CreateDockWidgetPluginGui=function()return Instance.new('Frame')end}
`;
const tests=String.raw`
local function fails(job,pattern)
 local before=#game:GetDescendants()
 local ok,err=pcall(function()insertBuild(job)end)
 assert(not ok and tostring(err):find(pattern),tostring(err))
 assert(#game:GetDescendants()==before,'failed insertion changed the place')
end
local function job(id,items)return {id=string.rep('0',35)..id,version=1,items=items}end
local scriptItem={kind='script',name='Checkpoint',title='Checkpoint',location='ServerScriptService',scriptType='Script',source='print("hello")'}
insertBuild(job('1',{scriptItem}))
assert(commits==1 and #selection==1)
local inserted=services.ServerScriptService:FindFirstChild('Checkpoint')
assert(inserted and inserted.Disabled==true and inserted.Source==scriptItem.source)
fails(job('1',{scriptItem}),'already has objects')
fails(job('2',{scriptItem}),'already exists')
local bad={kind='script',name='Other',title='Other',location='StarterPack/MissingTool',scriptType='LocalScript',source='print("x")'}
fails(job('3',{bad}),'Missing parent')
playing=true fails(job('4',{scriptItem}),'Stop Play') playing=false
local model={kind='model',name='Bench',title='Bench',location='Workspace',model={parts={{name='Seat',shape='Block',size={4,1,2},position={0,2,0},color={128,128,128}}}}}
local child={kind='script',name='BenchBehavior',title='Behavior',location='Workspace/Bench',scriptType='Script',source='print("bench")'}
insertBuild(job('5',{child,model}))
local bench=services.Workspace:FindFirstChild('Bench')
assert(bench and bench:FindFirstChild('Seat').Anchored)
assert(bench:FindFirstChild('BenchBehavior').Disabled)
assert(commits==2)
insertBuild(job('6',{{kind='catalog',name='Dog',title='Dog',location='Workspace',assetId=123}}))
local dog=services.Workspace:FindFirstChild('Dog')
assert(dog and dog.Sandboxed and dog:GetChildren()[1].Disabled)
assert(dog:GetAttribute('SparkSourceAssetId')=='123')
assert(receipts[string.rep('0',35)..'6']=='applied')
fails(job('7',{{kind='script',name='Bad',title='Bad',location='Workspace',scriptType='Executable',source='x'}}),'Unsupported script')
assert(commits==3)
print('PASS plugin insertion, disabled scripts, dependent parents, collision/duplicate/Play guards, cleanup and sandbox preservation (mocked Roblox services)')
`;
if(!process.argv[2])throw new Error('Pass the official Luau CLI executable path as the first argument.');
const dir=mkdtempSync(join(tmpdir(),'spark-studio-test-'));
try{
 const file=join(dir,'plugin-test.luau');
 writeFileSync(file,prelude+'\n'+readFileSync('public/spark-studio-plugin.lua','utf8')+'\n'+tests);
 const result=spawnSync(process.argv[2],[file],{encoding:'utf8'});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
 if(result.error)throw result.error;
 if(result.status!==0)process.exitCode=result.status||1;
}finally{rmSync(dir,{recursive:true,force:true});}
