-- Replace the old WaterFloorBuilder with this Script in ServerScriptService.
-- Enable the Script and press Play. This is walkable simulated water.
local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")
local Workspace = game:GetService("Workspace")

local old = Workspace:FindFirstChild("BlueWaterArea")
if old then old:Destroy() end
local area = Instance.new("Model")
area.Name = "BlueWaterArea"
area.Parent = Workspace
local base = Workspace:FindFirstChild("Baseplate")
local baseTop = base and base:IsA("BasePart") and base.Position.Y + base.Size.Y / 2 or 0
local spawn = Workspace:FindFirstChildWhichIsA("SpawnLocation", true)
local center = spawn and spawn.Position or Vector3.zero
local top = baseTop + 0.25
-- Keep the existing spawn above the surface where possible.
if spawn then top = math.max(baseTop + 0.05, math.min(top, spawn.Position.Y - spawn.Size.Y / 2)) end
local function part(name, size, cf, color, transparency)
    local p = Instance.new("Part")
    p.Name = name
    p.Anchored = true
    p.Size = size
    p.CFrame = cf
    p.Color = color
    p.Transparency = transparency or 0
    p.TopSurface = Enum.SurfaceType.Smooth
    p.BottomSurface = Enum.SurfaceType.Smooth
    p.Parent = area
    return p
end
local surface = part("WaterSurface", Vector3.new(240, 0.25, 240), CFrame.new(center.X, top - 0.125, center.Z), Color3.fromRGB(30, 140, 225))
surface.Material = Enum.Material.SmoothPlastic
local function effect(name, size, cf)
    local p = part(name, size, cf, Color3.fromRGB(170, 235, 255), 0.2)
    p.CanCollide = false
    p.CanTouch = false
    p.CanQuery = false
    p.Material = Enum.Material.Neon
    return p
end
local function ripple(position, big)
    local duration = big and 0.9 or 0.55
    local radius = big and 5 or 1.8
    local segments = 16
    for i = 1, segments do
        local angle = i * math.pi * 2 / segments
        local direction = Vector3.new(math.cos(angle), 0, math.sin(angle))
        local start = position + direction * 0.4
        local finish = position + direction * radius
        local p = effect("Ripple", Vector3.new(0.18, 0.06, 0.18), CFrame.new(start))
        TweenService:Create(p, TweenInfo.new(duration), {
            CFrame = CFrame.new(finish) * CFrame.Angles(0, -angle, 0),
            Size = Vector3.new(0.14, 0.06, 2 * math.pi * radius / segments),
            Transparency = 1,
        }):Play()
        Debris:AddItem(p, duration + 0.1)
    end
end
local function splash(position, big)
    ripple(position, big)
    local count = big and 10 or 3
    for i = 1, count do
        local angle = i * math.pi * 2 / count
        local spread = big and 3.5 or 0.8
        local height = big and 4 or 0.7
        local p = effect("SplashDrop", Vector3.new(0.3, 0.5, 0.3), CFrame.new(position))
        p.Shape = Enum.PartType.Ball
        TweenService:Create(p, TweenInfo.new(big and 0.55 or 0.3, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
            Position = position + Vector3.new(math.cos(angle) * spread, height, math.sin(angle) * spread),
            Transparency = 1,
            Size = Vector3.new(0.08, 0.08, 0.08),
        }):Play()
        Debris:AddItem(p, 0.7)
    end
end
local tracked = {}
local elapsed = 0
local RunService = game:GetService("RunService")
local connection
connection = RunService.Heartbeat:Connect(function(dt)
    if area.Parent ~= Workspace then connection:Disconnect() return end
    elapsed += dt
    if elapsed < 0.1 then return end
    elapsed = 0
    local now = os.clock()
    local current = {}
    for _, player in Players:GetPlayers() do
        current[player] = true
        local character = player.Character
        local root = character and character:FindFirstChild("HumanoidRootPart")
        local humanoid = character and character:FindFirstChildOfClass("Humanoid")
        if not root or not humanoid or humanoid.Health <= 0 then tracked[player] = nil continue end
        local state = tracked[player]
        if not state or state.character ~= character then
            state = {character = character, grounded = false, lastStep = 0}
            tracked[player] = state
        end
        local params = RaycastParams.new()
        params.FilterType = Enum.RaycastFilterType.Exclude
        params.FilterDescendantsInstances = {character}
        local reach = humanoid.HipHeight + root.Size.Y / 2 + (humanoid.RigType == Enum.HumanoidRigType.R6 and 2 or 0) + 0.5
        local hit = Workspace:Raycast(root.Position, Vector3.new(0, -reach, 0), params)
        local grounded = hit ~= nil and hit.Instance == surface and math.abs(root.AssemblyLinearVelocity.Y) < 5
        local localPosition = surface.CFrame:PointToObjectSpace(root.Position)
        local overWater = math.abs(localPosition.X) <= 119 and math.abs(localPosition.Z) <= 119
        local position = Vector3.new(root.Position.X, top + 0.08, root.Position.Z)
        if state.grounded and not grounded and overWater and root.AssemblyLinearVelocity.Y > 5 then
            splash(position, true)
        elseif grounded and not state.grounded and state.airborne then
            splash(position, true)
        elseif grounded and humanoid.MoveDirection.Magnitude > 0.1 and now - state.lastStep >= 0.35 then
            splash(position, false)
            state.lastStep = now
        end
        state.airborne = overWater and not grounded and root.Position.Y > top + reach
        state.grounded = grounded
    end
    for player in tracked do if not current[player] then tracked[player] = nil end end
end)
script.Destroying:Connect(function() connection:Disconnect() end)
print("BlueWaterArea ready near spawn. Walk for ripples; jump for a larger splash.")
