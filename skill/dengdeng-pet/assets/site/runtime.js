/* Runtime templates that get written into the exported desktop-pet package.
   Pure text, no network, no dependencies besides Windows PowerShell 5.1. */
(function (global) {
  'use strict';

  const WIN_PET_PS1 = String.raw`# 灯灯桌宠 - 零依赖 Windows 运行时
# Requires: Windows 10/11 with PowerShell 5.1 and .NET Framework (both built in).
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$cfgFile = Join-Path $root 'pet-config.json'
$petDir = Join-Path $root 'assets\pet'
if (-not (Test-Path -LiteralPath $cfgFile)) {
  [System.Windows.Forms.MessageBox]::Show('pet-config.json is missing. Please unzip the whole pet package.', 'Dengdeng Pet') | Out-Null
  exit 1
}

$cfg = Get-Content -LiteralPath $cfgFile -Raw -Encoding UTF8 | ConvertFrom-Json
$script:petName = [string]$cfg.name
$script:size = [Math]::Max(80, [Math]::Min(520, [int]$cfg.size))
$script:step = [Math]::Max(1, [Math]::Min(12, [int]$cfg.speed))
$script:auto = [bool]$cfg.auto
$script:lines = @($cfg.lines)
$script:imgs = @{}
$script:keys = @()
if (Test-Path -LiteralPath $petDir) {
  Get-ChildItem -LiteralPath $petDir -Filter '*.png' | Sort-Object Name | ForEach-Object {
    $script:imgs[$_.BaseName] = [System.Drawing.Image]::FromFile($_.FullName)
    $script:keys += $_.BaseName
  }
}
if ($script:keys.Count -eq 0) {
  [System.Windows.Forms.MessageBox]::Show('No sprite found in assets\pet.', 'Dengdeng Pet') | Out-Null
  exit 1
}

$script:current = $script:keys[0]
$script:dragging = $false
$script:offX = 0
$script:offY = 0
$script:dir = -1
$script:walk = $true
$script:tick = 0
$script:bubbleUntil = 0
$script:hideUntil = 0

$script:form = New-Object System.Windows.Forms.Form
$script:form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$script:form.ShowInTaskbar = $false
$script:form.TopMost = [bool]$cfg.topmost
$script:form.BackColor = [System.Drawing.Color]::Magenta
$script:form.TransparencyKey = [System.Drawing.Color]::Magenta
$script:form.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
$script:form.ClientSize = New-Object System.Drawing.Size($script:size, ($script:size + 54))
$wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$script:form.Location = New-Object System.Drawing.Point(($wa.Right - $script:size - 36), ($wa.Bottom - $script:size - 54 - 24))
$script:form.Text = $script:petName

$script:bubble = New-Object System.Windows.Forms.Label
$script:bubble.Size = New-Object System.Drawing.Size($script:size, 40)
$script:bubble.Location = New-Object System.Drawing.Point(2, 2)
$script:bubble.BackColor = [System.Drawing.Color]::FromArgb(255, 250, 240)
$script:bubble.ForeColor = [System.Drawing.Color]::FromArgb(88, 62, 44)
$script:bubble.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$script:bubble.Font = New-Object System.Drawing.Font('Microsoft YaHei', 10)
$script:bubble.Visible = $false
$script:form.Controls.Add($script:bubble)

$script:pic = New-Object System.Windows.Forms.PictureBox
$script:pic.Location = New-Object System.Drawing.Point(0, 48)
$script:pic.Size = New-Object System.Drawing.Size($script:size, $script:size)
$script:pic.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::Zoom
$script:pic.BackColor = [System.Drawing.Color]::Magenta
$script:pic.Image = $script:imgs[$script:current]
$script:form.Controls.Add($script:pic)

$onDown = {
  param($s, $e)
  if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) {
    $p = [System.Windows.Forms.Control]::MousePosition
    $script:dragging = $true
    $script:offX = $p.X - $script:form.Left
    $script:offY = $p.Y - $script:form.Top
  }
}
$onMove = {
  param($s, $e)
  if ($script:dragging) {
    $p = [System.Windows.Forms.Control]::MousePosition
    $script:form.Location = New-Object System.Drawing.Point(($p.X - $script:offX), ($p.Y - $script:offY))
  }
}
$onUp = { param($s, $e) $script:dragging = $false }
$onDouble = {
  param($s, $e)
  $txt = '摸摸就有精神啦'
  if ($script:lines.Count -gt 0) { $txt = $script:lines[(Get-Random -Maximum $script:lines.Count)] }
  $script:bubble.Text = $txt
  $script:bubble.Visible = $true
  $script:bubbleUntil = [Environment]::TickCount + 2800
}
foreach ($c in @($script:form, $script:pic)) {
  $c.add_MouseDown($onDown)
  $c.add_MouseMove($onMove)
  $c.add_MouseUp($onUp)
  $c.add_DoubleClick($onDouble)
}

$menu = New-Object System.Windows.Forms.ContextMenuStrip
foreach ($k in $script:keys) {
  $poseName = $k
  $mi = $menu.Items.Add($poseName)
  $mi.add_Click({
    $script:current = $poseName
    $script:pic.Image = $script:imgs[$script:current]
    $script:walk = $false
  }.GetNewClosure())
}
$menu.Items.Add('-') | Out-Null
$miWalk = $menu.Items.Add('Walk / pause')
$miWalk.add_Click({ $script:walk = -not $script:walk })
$miSay = $menu.Items.Add('Say something')
$miSay.add_Click({
  if ($script:lines.Count -gt 0) {
    $script:bubble.Text = $script:lines[(Get-Random -Maximum $script:lines.Count)]
    $script:bubble.Visible = $true
    $script:bubbleUntil = [Environment]::TickCount + 3000
  }
})
$miTop = $menu.Items.Add('Toggle always on top')
$miTop.add_Click({ $script:form.TopMost = -not $script:form.TopMost })
$miHide = $menu.Items.Add('Hide for 10 seconds')
$miHide.add_Click({
  $script:hideUntil = [Environment]::TickCount + 10000
  $script:form.Hide()
})
$menu.Items.Add('-') | Out-Null
$miQuit = $menu.Items.Add('Quit')
$miQuit.add_Click({ $script:timer.Stop(); $script:form.Close() })
$script:form.ContextMenuStrip = $menu
$script:pic.ContextMenuStrip = $menu

$script:timer = New-Object System.Windows.Forms.Timer
$script:timer.Interval = 60
$script:timer.add_Tick({
  $script:tick++
  $now = [Environment]::TickCount
  if ($script:hideUntil -gt 0 -and $now -gt $script:hideUntil) {
    $script:form.Show()
    $script:hideUntil = 0
  }
  if ($script:bubble.Visible -and $now -gt $script:bubbleUntil) { $script:bubble.Visible = $false }
  if ($script:walk -and -not $script:dragging) {
    $x = $script:form.Left + ($script:dir * $script:step)
    $max = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width - $script:form.Width
    if ($x -lt 0) { $x = 0; $script:dir = 1 }
    if ($x -gt $max) { $x = $max; $script:dir = -1 }
    $script:form.Left = $x
  }
  if ($script:auto -and $script:tick % 90 -eq 0) {
    $script:current = $script:keys[(Get-Random -Maximum $script:keys.Count)]
    $script:pic.Image = $script:imgs[$script:current]
  }
  if ($script:lines.Count -gt 0 -and $script:tick % 240 -eq 0) {
    $script:bubble.Text = $script:lines[(Get-Random -Maximum $script:lines.Count)]
    $script:bubble.Visible = $true
    $script:bubbleUntil = $now + 3200
  }
})
$script:timer.Start()
$script:bubble.Text = $script:petName + ' 来陪你啦'
$script:bubble.Visible = $true
$script:bubbleUntil = [Environment]::TickCount + 3200
[System.Windows.Forms.Application]::Run($script:form)
`;

  const START_BAT = String.raw`@echo off
title Dengdeng Desktop Pet
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0win_pet.ps1"
if errorlevel 1 (
  echo.
  echo Something went wrong. Make sure the whole zip was extracted first.
  pause
)
`;

  const README_TXT = String.raw`灯灯桌宠 · 使用说明
========================================

1. 请先【解压整个压缩包】，不要直接在压缩软件里双击运行。
2. 双击 "start.bat"，你的桌宠就会出现在屏幕右下角。
3. 左键拖动它、双击摸摸它、右键可以换动作 / 散步 / 置顶 / 退出。
4. 想改名字、大小、速度、台词，用记事本打开 pet-config.json 修改后保存，
   再重新双击 start.bat 即可生效。
5. 想换形象，把新的 PNG 放进 assets\pet\ 目录（背景需为纯洋红 #FF00FF，
   或直接使用本网站重新生成一个包）。
6. 想开机自动陪伴：给 start.bat 建一个快捷方式，放进
   %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

完全离线运行：不需要 Python、不需要安装任何软件、不联网、不上传照片。
若被杀毒软件误报，请添加信任 PowerShell 脚本（本包只做本机窗口显示）。

本包由「灯灯桌宠 · 免费定制」网页生成，可自由分享给朋友。
`;

  global.PET_RUNTIME = {
    winPetPs1: '\uFEFF' + WIN_PET_PS1,
    startBat: START_BAT,
    readme: '\uFEFF' + README_TXT,
  };
})(window);
