-- Spark Studio Bridge v1. Preview: additive imports only.
-- Install as a local Studio plugin, never as an in-game Script.
local Http = game:GetService("HttpService")
local History = game:GetService("ChangeHistoryService")
local Selection = game:GetService("Selection")
local Editor = game:GetService("ScriptEditorService")
local Run = game:GetService("RunService")
local ORIGIN = "https://spark-roblox-creative-workspace.puriux.chatgpt.site"
local toolbar = plugin:CreateToolbar("Spark")
local toggle = toolbar:CreateButton("Open Spark", "Review and insert Spark builds", "")
local widget = plugin:CreateDockWidgetPluginGui("SparkBridgeV1", DockWidgetPluginGuiInfo.new(Enum.InitialDockState.Right, false, false, 420, 700, 320, 400))
widget.Title = "Spark Studio · Preview"
local frame = Instance.new("ScrollingFrame")
frame.Size = UDim2.fromScale(1, 1)
frame.CanvasSize = UDim2.new()
frame.AutomaticCanvasSize = Enum.AutomaticSize.Y
frame.ScrollBarThickness = 6
frame.BackgroundColor3 = Color3.fromRGB(24, 22, 32)
frame.Parent = widget
local padding = Instance.new("UIPadding")
padding.PaddingLeft = UDim.new(0, 14)
padding.PaddingRight = UDim.new(0, 14)
padding.PaddingTop = UDim.new(0, 14)
padding.PaddingBottom = UDim.new(0, 14)
padding.Parent = frame
local layout = Instance.new("UIListLayout")
layout.Padding = UDim.new(0, 12)
layout.SortOrder = Enum.SortOrder.LayoutOrder
layout.Parent = frame
local order = 0
local function element(class, text)
  order = order + 1
  local e = Instance.new(class)
  e.LayoutOrder = order
  e.Size = UDim2.new(1, -6, 0, 40)
  e.BackgroundColor3 = Color3.fromRGB(48, 41, 66)
  e.TextColor3 = Color3.fromRGB(240, 235, 255)
  e.Font = Enum.Font.SourceSans
  e.TextSize = 16
  e.Text = text
  e.TextWrapped = true
  e.Parent = frame
  return e
end
local intro = element("TextLabel", "Connect a Spark project, review a build, then approve insertion. Open the intended place before connecting.")
intro.Size = UDim2.new(1, -6, 0, 72)
local code = element("TextBox", "")
code.PlaceholderText = "Paste pairing code from Spark"
code.ClearTextOnFocus = false
local connect = element("TextButton", "Connect project")
local refresh = element("TextButton", "Refresh builds")
local status = element("TextLabel", "Not connected")
status.AutomaticSize = Enum.AutomaticSize.Y
status.TextXAlignment = Enum.TextXAlignment.Left
local preview = element("TextLabel", "No build selected.")
preview.AutomaticSize = Enum.AutomaticSize.Y
preview.TextXAlignment = Enum.TextXAlignment.Left
preview.TextYAlignment = Enum.TextYAlignment.Top
local approve = element("TextButton", "Approve and insert")
local reject = element("TextButton", "Decline this build")
local disconnect = element("TextButton", "Disconnect plugin")
local token, current = nil, nil
local busy = false
local receipts = {} -- Session recovery if the server acknowledgement is interrupted.
local roots = {Workspace=true,ServerScriptService=true,ServerStorage=true,ReplicatedStorage=true,ReplicatedFirst=true,StarterGui=true,StarterPack=true,StarterPlayer=true}

local function request(path, method, body)
  local headers = { ["Content-Type"]="application/json", ["X-Spark-Place-Id"]=tostring(game.PlaceId) }
  if token then headers.Authorization = "Bearer " .. token end
  local options = {Url=ORIGIN.."/api/studio/"..path, Method=method, Headers=headers}
  if body then options.Body = Http:JSONEncode(body) end
  local result = Http:RequestAsync(options)
  local ok, data = pcall(function() return Http:JSONDecode(result.Body) end)
  if not result.Success then
    if result.StatusCode == 401 then token = nil end
    error(ok and type(data.error)=="string" and data.error or ("Spark request failed ("..result.StatusCode.."). Reconnect if needed."), 0)
  end
  if not ok then error("Unexpected server response. Please refresh.", 0) end
  return data
end
local function work(callback)
  if busy then return end
  busy = true
  approve.Active = false
  local ok, err = pcall(callback)
  if not ok then status.Text = tostring(err) end
  busy = false
  approve.Active = true
end
local function ack(id, result)
  request("transfers/"..id, "POST", {status=result})
end
local function showBuild()
  if not current then preview.Text = "No pending builds. Send a response from Spark, then refresh."; return end
  local lines = {"Insert into: "..game.Name, "New objects only. Existing names are never replaced.", "Scripts stay disabled. Review source before enabling them.", ""}
  for _, item in ipairs(current.items) do
    table.insert(lines, item.title .. "\n" .. item.location .. "/" .. item.name)
    if item.kind == "script" then table.insert(lines, item.scriptType .. " (disabled unless ModuleScript)\n" .. item.source)
    elseif item.kind == "model" then table.insert(lines, tostring(#item.model.parts).." anchored parts")
    elseif item.kind == "catalog" then table.insert(lines, "Library asset "..tostring(item.assetId)..". Loaded with Roblox sandbox protection; embedded scripts stay disabled.") end
    table.insert(lines, "\n----------------\n")
  end
  preview.Text = table.concat(lines, "\n")
end
local function refreshBuilds()
  if not token then error("Connect your Spark project first.", 0) end
  local data = request("transfers", "GET")
  current = nil
  for _, job in ipairs(data.transfers) do
    if receipts[job.id] then ack(job.id, receipts[job.id])
    elseif not current then current = job end
  end
  showBuild()
  status.Text = current and "Review the build below before approving." or "Connected. No builds awaiting review."
end
local function safeName(name)
  return type(name)=="string" and #name>0 and #name<=80 and not name:find("[/\\%c]")
end
local function vec(v, min, max)
  assert(type(v)=="table" and #v==3, "Invalid model vector")
  for _, n in ipairs(v) do assert(type(n)=="number" and n==n and n>=min and n<=max, "Invalid model coordinate") end
  return Vector3.new(v[1],v[2],v[3])
end
local function insertBuild(job)
  assert(not Run:IsRunning(), "Stop Play mode before inserting a build.")
  assert(job.version==1 and type(job.id)=="string" and #job.id==36, "Unsupported build version")
  assert(type(job.items)=="table" and #job.items>0 and #job.items<=12, "Invalid build size")
  -- Attributes on inserted roots survive saving/reopening and prevent uncertain retries.
  for _, instance in ipairs(game:GetDescendants()) do
    if instance:GetAttribute("SparkTransferId")==job.id then
      error("This build already has objects in this place. Nothing was added. Inspect those objects before making another build.", 0)
    end
  end
  local staged, targets, created = {}, {}, {}
  local recording
  local ok, err = pcall(function()
    for _, item in ipairs(job.items) do
      assert(safeName(item.name) and type(item.location)=="string", "Invalid object name or destination")
      local node
      if item.kind=="script" then
        assert(item.scriptType=="Script" or item.scriptType=="LocalScript" or item.scriptType=="ModuleScript", "Unsupported script type")
        assert(type(item.source)=="string" and #item.source<=100000, "Invalid script source")
        node = Instance.new(item.scriptType)
        table.insert(created, node)
        if node:IsA("BaseScript") then node.Disabled = true end
        Editor:UpdateSourceAsync(node, function() return item.source end)
      elseif item.kind=="model" then
        assert(type(item.model.parts)=="table" and #item.model.parts>0 and #item.model.parts<=50, "Invalid model")
        node = Instance.new("Model")
        table.insert(created, node)
        for i, p in ipairs(item.model.parts) do
          assert(p.shape=="Wedge" or p.shape=="Block" or p.shape=="Ball" or p.shape=="Cylinder", "Unsupported shape")
          local part = Instance.new(p.shape=="Wedge" and "WedgePart" or "Part")
          part.Parent = node
          part.Name = safeName(p.name) and p.name or "Part"..i
          part.Anchored = true
          part.CanCollide = true
          part.Size = vec(p.size,0.05,2048)
          part.Position = vec(p.position,-10000,10000)
          vec(p.color,0,255)
          part.Color = Color3.fromRGB(p.color[1],p.color[2],p.color[3])
          if p.shape~="Wedge" then part.Shape = Enum.PartType[p.shape] end
        end
      elseif item.kind=="catalog" then
        assert(type(item.assetId)=="number" and item.assetId>0 and item.assetId%1==0, "Invalid library asset")
        local loaded, value = pcall(function() return game:GetService("AssetService"):LoadAssetAsync(item.assetId) end)
        if not loaded then error("Model could not load. Check Studio's Allow Loading Third Party Assets setting and your access to the model. Nothing has been inserted.", 0) end
        node = value
        table.insert(created, node)
        for _, descendant in ipairs(node:GetDescendants()) do
          if descendant:IsA("BaseScript") then descendant.Disabled = true end
        end
        node:SetAttribute("SparkSourceAssetId", tostring(item.assetId))
      else error("Unsupported build item", 0) end
      node.Name = item.name
      node:SetAttribute("SparkTransferId", job.id)
      local key = item.location.."/"..item.name
      assert(not staged[key], "Duplicate build destination")
      staged[key] = node
    end
    -- Resolve every parent before changing the place. Missing dependencies block the whole build.
    for _, item in ipairs(job.items) do
      local pieces = string.split(item.location, "/")
      assert(roots[pieces[1]], "Unsupported destination")
      local parent = game:GetService(pieces[1])
      local path = pieces[1]
      for i=2,#pieces do
        path = path.."/"..pieces[i]
        local nextParent = parent:FindFirstChild(pieces[i]) or staged[path]
        assert(nextParent, "Missing parent: "..path..". Ask Spark to include this dependency first.")
        parent = nextParent
      end
      assert(not parent:FindFirstChild(item.name), "An object already exists at "..item.location.."/"..item.name..". Nothing was replaced.")
      table.insert(targets,{node=staged[item.location.."/"..item.name],parent=parent})
    end
    assert(not Run:IsRunning(), "Stop Play mode before inserting.")
    recording = History:TryBeginRecording("SparkInsert", "Insert Spark build")
    assert(recording, "Finish the current Studio edit before inserting.")
    for _, entry in ipairs(targets) do entry.node.Parent = entry.parent end
    History:FinishRecording(recording, Enum.FinishRecordingOperation.Commit)
    recording = nil
  end)
  if not ok then
    for _, node in ipairs(created) do node:Destroy() end
    if recording then History:FinishRecording(recording, Enum.FinishRecordingOperation.Cancel) end
    error(err, 0)
  end
  receipts[job.id] = "applied"
  Selection:Set(created)
end
toggle.Click:Connect(function() widget.Enabled = not widget.Enabled end)
connect.MouseButton1Click:Connect(function() work(function()
  assert(not Run:IsRunning(), "Stop Play mode before connecting.")
  local data = request("pair", "POST", {code=code.Text:gsub("%s", ""), placeId=tostring(game.PlaceId)})
  token = data.token
  code.Text = ""
  status.Text = "Connected to "..data.project
  current = nil
  preview.Text = "Connected to "..data.project..". Send a build from Spark, then refresh."
end) end)
refresh.MouseButton1Click:Connect(function() work(refreshBuilds) end)
approve.MouseButton1Click:Connect(function() work(function()
  assert(token and current, "Refresh and review a build first.")
  -- Recheck revocation and queue state immediately before any place mutation.
  local fresh = request("transfers", "GET")
  local available = false
  for _, job in ipairs(fresh.transfers) do if job.id==current.id then available=true end end
  assert(available, "This build is no longer pending. Refresh the list.")
  local id = current.id
  if not receipts[id] then insertBuild(current) end
  status.Text = "Inserted. Scripts are disabled for review. Use Studio Undo to remove this insertion."
  local ok = pcall(function() ack(id, "applied") end)
  current = nil
  preview.Text = "Build inserted. Select Refresh for the next build."
  if not ok then status.Text = "Inserted, but the receipt could not reach Spark. Refresh to resend it; do not insert again." end
end) end)
reject.MouseButton1Click:Connect(function() work(function()
  assert(current, "No build selected.")
  ack(current.id,"rejected")
  receipts[current.id]="rejected"
  current=nil
  refreshBuilds()
end) end)
disconnect.MouseButton1Click:Connect(function()
  if busy then return end
  token=nil;current=nil;code.Text=""
  status.Text="Disconnected. You can also revoke the connection from Spark."
  preview.Text="No build selected."
end)
plugin.Unloading:Connect(function() token=nil;widget:Destroy() end)
