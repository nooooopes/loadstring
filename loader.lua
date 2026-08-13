-- loader.lua – Web loader with key validation
local function showGUI()
    local screen = Instance.new("ScreenGui")
    screen.Name = "LoaderGUI"
    screen.ResetOnSpawn = false
    screen.Parent = game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")

    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(0, 360, 0, 200)
    frame.Position = UDim2.new(0.5, -180, 0.5, -100)
    frame.BackgroundColor3 = Color3.fromRGB(20, 20, 20)
    frame.BorderSizePixel = 0
    frame.Parent = screen

    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 40)
    title.BackgroundTransparency = 1
    title.Text = "🔑 Enter Your Key"
    title.TextColor3 = Color3.new(1, 1, 1)
    title.Font = Enum.Font.SourceSansBold
    title.TextSize = 20
    title.Parent = frame

    local sub = Instance.new("TextLabel")
    sub.Size = UDim2.new(1, 0, 0, 20)
    sub.Position = UDim2.new(0, 0, 0, 40)
    sub.BackgroundTransparency = 1
    sub.Text = "Enter your key to load the script"
    sub.TextColor3 = Color3.fromRGB(150, 150, 150)
    sub.Font = Enum.Font.SourceSans
    sub.TextSize = 13
    sub.Parent = frame

    local box = Instance.new("TextBox")
    box.Size = UDim2.new(0.8, 0, 0, 35)
    box.Position = UDim2.new(0.1, 0, 0.4, 0)
    box.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
    box.TextColor3 = Color3.new(1, 1, 1)
    box.Font = Enum.Font.SourceSans
    box.TextSize = 16
    box.ClearTextOnFocus = false
    box.PlaceholderText = "Paste your key here"
    box.Text = ""
    box.Parent = frame

    local btn = Instance.new("TextButton")
    btn.Size = UDim2.new(0.4, 0, 0, 35)
    btn.Position = UDim2.new(0.3, 0, 0.65, 0)
    btn.BackgroundColor3 = Color3.fromRGB(0, 140, 255)
    btn.TextColor3 = Color3.new(1, 1, 1)
    btn.Font = Enum.Font.SourceSansBold
    btn.TextSize = 16
    btn.Text = "Load Script"
    btn.Parent = frame

    local status = Instance.new("TextLabel")
    status.Size = UDim2.new(1, 0, 0, 25)
    status.Position = UDim2.new(0, 0, 0.85, 0)
    status.BackgroundTransparency = 1
    status.Text = ""
    status.TextColor3 = Color3.fromRGB(200, 200, 200)
    status.Font = Enum.Font.SourceSans
    status.TextSize = 13
    status.TextXAlignment = Enum.TextXAlignment.Center
    status.Parent = frame

    local function onLoad()
        local key = box.Text
        if #key == 0 then
            status.Text = "Please enter a key"
            status.TextColor3 = Color3.fromRGB(255, 200, 0)
            return
        end

        status.Text = "Checking key..."
        status.TextColor3 = Color3.fromRGB(200, 200, 200)
        btn.Visible = false

        -- REPLACE THIS URL with your Netlify function URL
        local url = "https://YOUR-SITE.netlify.app/.netlify/functions/loader"
        local data = game:GetService("HttpService"):JSONEncode({ key = key })

        local success, result = pcall(function()
            return game:HttpGet(url, true, data)
        end)

        btn.Visible = true

        if not success then
            status.Text = "Request failed - check your connection"
            status.TextColor3 = Color3.fromRGB(255, 0, 0)
            return
        end

        local ok, parsed = pcall(function()
            return game:GetService("HttpService"):JSONDecode(result)
        end)

        if ok and parsed and parsed.error then
            status.Text = parsed.error
            status.TextColor3 = Color3.fromRGB(255, 0, 0)
            return
        end

        status.Text = "Loading script..."
        status.TextColor3 = Color3.fromRGB(0, 255, 100)

        local fn = loadstring(result)
        if fn then
            screen:Destroy()
            fn()
        else
            status.Text = "Script load error - invalid format"
            status.TextColor3 = Color3.fromRGB(255, 0, 0)
        end
    end

    btn.MouseButton1Click:Connect(onLoad)
    box.FocusLost:Connect(function(enter) if enter then onLoad() end end)
    box.Focused:Connect(function() status.Text = "" end)
end

showGUI()
