# RESERVANCE setup tutorial popup.
# Checkboxes are read-only. ASCII-only so Windows PowerShell parses this on any PC.

param(
  [Parameter(Mandatory = $true)]
  [string]$Root
)

$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$Root = [System.IO.Path]::GetFullPath($Root.TrimEnd('\', '/'))
$SkipFile = Join-Path $Root '.reservance-skip-setup-guide'
$IconPath = Join-Path $Root 'frontend\public\logosymbol.ico'
$LogoPath = Join-Path $Root 'frontend\public\logosymbol.png'
$WordPath = Join-Path $Root 'frontend\public\logotext.png'

$Purple = [System.Drawing.Color]::FromArgb(73, 20, 100)
$Plum = [System.Drawing.Color]::FromArgb(92, 41, 124)
$Ink = [System.Drawing.Color]::FromArgb(46, 0, 70)
$Gold = [System.Drawing.Color]::FromArgb(255, 183, 54)
$Canvas = [System.Drawing.Color]::FromArgb(250, 250, 250)
$OkGreen = [System.Drawing.Color]::FromArgb(30, 110, 60)
$BadRed = [System.Drawing.Color]::FromArgb(150, 30, 50)

function Find-XamppRoot {
  $candidates = @()
  $candidates += [System.IO.Path]::GetFullPath((Join-Path $Root '..\..'))
  $candidates += [System.IO.Path]::GetFullPath((Join-Path $Root '..'))
  foreach ($drive in @('C', 'D', 'E', 'F', 'G')) {
    $candidates += "$drive`:\xampp"
    $candidates += "$drive`:\XAMPP"
  }
  if ($env:LOCALAPPDATA) {
    $candidates += (Join-Path $env:LOCALAPPDATA 'Programs\xampp')
  }
  foreach ($path in $candidates) {
    if (Test-Path (Join-Path $path 'mysql\bin\mysqld.exe')) { return $path }
  }
  return $null
}

function Test-CommandExists([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-CheckResults {
  $xampp = Find-XamppRoot
  $inHtdocs = $false
  if ($xampp) {
    $htdocs = [System.IO.Path]::GetFullPath((Join-Path $xampp 'htdocs'))
    $inHtdocs = $Root.StartsWith($htdocs, [System.StringComparison]::OrdinalIgnoreCase)
  }

  $phpOk = ($xampp -and (Test-Path (Join-Path $xampp 'php\php.exe'))) -or (Test-CommandExists 'php')
  $nodeOk = Test-CommandExists 'node'
  $npmOk = (Test-CommandExists 'npm') -or (Test-CommandExists 'npm.cmd')
  $mysqlBinOk = $xampp -and (Test-Path (Join-Path $xampp 'mysql\bin\mysqld.exe'))
  $projectOk = (Test-Path (Join-Path $Root 'backend\artisan')) -and
    (Test-Path (Join-Path $Root 'frontend\package.json')) -and
    (Test-Path (Join-Path $Root 'realtime-server\package.json'))

  $correctHint = "Recommended path:`nC:\xampp\htdocs\RESERVANCECAPSTONE`n`nCurrent path:`n$Root"
  if ($xampp) {
    $correctHint = "Recommended path:`n$xampp\htdocs\RESERVANCECAPSTONE`n`nCurrent path:`n$Root"
  }

  return [ordered]@{
    ProjectFiles = [pscustomobject]@{ Ok = [bool]$projectOk; Title = 'RESERVANCE project files are complete'; Hint = "Need backend, frontend, and realtime-server inside:`n$Root" }
    CorrectPath = [pscustomobject]@{ Ok = [bool]$inHtdocs; Title = 'Project is inside xampp\htdocs'; Hint = $correctHint }
    Xampp = [pscustomobject]@{ Ok = [bool]$xampp; Title = 'XAMPP is installed (download)'; Hint = "Download: https://www.apachefriends.org/`nInstall to C:\xampp (or any drive:\xampp)" }
    Php = [pscustomobject]@{ Ok = [bool]$phpOk; Title = 'PHP is available (comes with XAMPP)'; Hint = 'After XAMPP install, PHP should be at xampp\php\php.exe' }
    Mysql = [pscustomobject]@{ Ok = [bool]$mysqlBinOk; Title = 'MySQL is available (comes with XAMPP)'; Hint = 'XAMPP Control Panel should show MySQL. Path: xampp\mysql\bin' }
    Node = [pscustomobject]@{ Ok = [bool]$nodeOk; Title = 'Node.js is installed (download)'; Hint = "Download Node.js LTS:`nhttps://nodejs.org/`nThen reopen this guide." }
    Npm = [pscustomobject]@{ Ok = [bool]$npmOk; Title = 'npm is available (comes with Node.js)'; Hint = 'Install Node.js LTS, then open a new window and run RESERVANCE again.' }
    BackendVendor = [pscustomobject]@{ Ok = Test-Path (Join-Path $Root 'backend\vendor\autoload.php'); Title = 'Backend packages installed (composer)'; Hint = 'Missing backend\vendor. The launcher can install this when you continue.' }
    FrontendModules = [pscustomobject]@{ Ok = Test-Path (Join-Path $Root 'frontend\node_modules'); Title = 'Frontend packages installed (npm)'; Hint = 'Missing frontend\node_modules. The launcher can install this when you continue.' }
    RealtimeModules = [pscustomobject]@{ Ok = Test-Path (Join-Path $Root 'realtime-server\node_modules'); Title = 'Realtime packages installed (npm)'; Hint = 'Missing realtime-server\node_modules. The launcher can install this when you continue.' }
  }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'RESERVANCE - Setup Tutorial'
$form.StartPosition = 'CenterScreen'
$form.Size = New-Object System.Drawing.Size(760, 700)
$form.MinimumSize = New-Object System.Drawing.Size(700, 640)
$form.BackColor = $Canvas
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$form.TopMost = $true
if (Test-Path $IconPath) {
  try { $form.Icon = New-Object System.Drawing.Icon($IconPath) } catch {}
}

$hero = New-Object System.Windows.Forms.Panel
$hero.Location = New-Object System.Drawing.Point(0, 0)
$hero.Size = New-Object System.Drawing.Size(760, 118)
$hero.BackColor = $Purple
$form.Controls.Add($hero)

$logoBox = New-Object System.Windows.Forms.PictureBox
$logoBox.Location = New-Object System.Drawing.Point(22, 18)
$logoBox.Size = New-Object System.Drawing.Size(72, 72)
$logoBox.SizeMode = 'Zoom'
$logoBox.BackColor = [System.Drawing.Color]::Transparent
if (Test-Path $LogoPath) {
  try { $logoBox.Image = [System.Drawing.Image]::FromFile($LogoPath) } catch {}
}
$hero.Controls.Add($logoBox)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'RESERVANCE'
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 20)
$title.ForeColor = $Gold
$title.Location = New-Object System.Drawing.Point(110, 22)
$title.AutoSize = $true
$hero.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'Setup tutorial  |  School classroom ready'
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(255, 240, 210)
$subtitle.Location = New-Object System.Drawing.Point(114, 62)
$subtitle.AutoSize = $true
$hero.Controls.Add($subtitle)

$goldLine = New-Object System.Windows.Forms.Panel
$goldLine.Location = New-Object System.Drawing.Point(0, 118)
$goldLine.Size = New-Object System.Drawing.Size(760, 4)
$goldLine.BackColor = $Gold
$form.Controls.Add($goldLine)

$sub = New-Object System.Windows.Forms.Label
$sub.Text = 'This checklist is checked automatically. You cannot tick the boxes yourself - install what is missing, and RESERVANCE will mark it.'
$sub.ForeColor = $Plum
$sub.Location = New-Object System.Drawing.Point(26, 136)
$sub.Size = New-Object System.Drawing.Size(700, 36)
$form.Controls.Add($sub)

$pathBox = New-Object System.Windows.Forms.TextBox
$pathBox.ReadOnly = $true
$pathBox.BorderStyle = 'FixedSingle'
$pathBox.BackColor = [System.Drawing.Color]::White
$pathBox.ForeColor = $Ink
$pathBox.Location = New-Object System.Drawing.Point(26, 176)
$pathBox.Size = New-Object System.Drawing.Size(700, 28)
$pathBox.Text = "Project path: $Root"
$form.Controls.Add($pathBox)

$panel = New-Object System.Windows.Forms.Panel
$panel.Location = New-Object System.Drawing.Point(24, 216)
$panel.Size = New-Object System.Drawing.Size(704, 300)
$panel.AutoScroll = $true
$panel.BorderStyle = 'FixedSingle'
$panel.BackColor = [System.Drawing.Color]::White
$form.Controls.Add($panel)

$status = New-Object System.Windows.Forms.Label
$status.Location = New-Object System.Drawing.Point(26, 528)
$status.Size = New-Object System.Drawing.Size(700, 24)
$status.ForeColor = $Purple
$form.Controls.Add($status)

$hint = New-Object System.Windows.Forms.Label
$hint.Location = New-Object System.Drawing.Point(26, 554)
$hint.Size = New-Object System.Drawing.Size(700, 36)
$hint.ForeColor = $Plum
$hint.Text = 'Missing items show below. Downloads: XAMPP + Node.js LTS.'
$form.Controls.Add($hint)

$script:checks = @{}
$y = 12
$script:keys = @(
  'ProjectFiles', 'CorrectPath', 'Xampp', 'Php', 'Mysql',
  'Node', 'Npm', 'BackendVendor', 'FrontendModules', 'RealtimeModules'
)

foreach ($key in $script:keys) {
  $cb = New-Object System.Windows.Forms.CheckBox
  $cb.AutoCheck = $false
  $cb.Enabled = $true
  $cb.AutoSize = $true
  $cb.Location = New-Object System.Drawing.Point(14, $y)
  $cb.ForeColor = $Ink
  $cb.Tag = $key
  $cb.TabStop = $false
  $cb.Cursor = [System.Windows.Forms.Cursors]::Arrow
  $panel.Controls.Add($cb)
  $script:checks[$key] = $cb
  $y += 28
}

$btnXampp = New-Object System.Windows.Forms.Button
$btnXampp.Text = 'Download XAMPP'
$btnXampp.Location = New-Object System.Drawing.Point(26, 604)
$btnXampp.Size = New-Object System.Drawing.Size(130, 36)
$btnXampp.FlatStyle = 'Flat'
$btnXampp.BackColor = [System.Drawing.Color]::White
$btnXampp.ForeColor = $Purple
$btnXampp.FlatAppearance.BorderColor = $Purple
$btnXampp.Add_Click({ Start-Process 'https://www.apachefriends.org/' })
$form.Controls.Add($btnXampp)

$btnNode = New-Object System.Windows.Forms.Button
$btnNode.Text = 'Download Node.js'
$btnNode.Location = New-Object System.Drawing.Point(166, 604)
$btnNode.Size = New-Object System.Drawing.Size(140, 36)
$btnNode.FlatStyle = 'Flat'
$btnNode.BackColor = [System.Drawing.Color]::White
$btnNode.ForeColor = $Purple
$btnNode.FlatAppearance.BorderColor = $Purple
$btnNode.Add_Click({ Start-Process 'https://nodejs.org/' })
$form.Controls.Add($btnNode)

$btnRefresh = New-Object System.Windows.Forms.Button
$btnRefresh.Text = 'Recheck now'
$btnRefresh.Location = New-Object System.Drawing.Point(316, 604)
$btnRefresh.Size = New-Object System.Drawing.Size(110, 36)
$btnRefresh.FlatStyle = 'Flat'
$btnRefresh.BackColor = [System.Drawing.Color]::White
$btnRefresh.ForeColor = $Purple
$btnRefresh.FlatAppearance.BorderColor = $Plum
$form.Controls.Add($btnRefresh)

$btnDont = New-Object System.Windows.Forms.Button
$btnDont.Text = "Don't show again"
$btnDont.Enabled = $false
$btnDont.Location = New-Object System.Drawing.Point(436, 604)
$btnDont.Size = New-Object System.Drawing.Size(140, 36)
$btnDont.FlatStyle = 'Flat'
$btnDont.BackColor = [System.Drawing.Color]::White
$btnDont.ForeColor = $Ink
$btnDont.FlatAppearance.BorderColor = $Plum
$btnDont.Add_Click({
  '1' | Set-Content -Path $SkipFile -Encoding ASCII
  $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $form.Close()
})
$form.Controls.Add($btnDont)

$btnStart = New-Object System.Windows.Forms.Button
$btnStart.Text = 'Start RESERVANCE'
$btnStart.Location = New-Object System.Drawing.Point(586, 604)
$btnStart.Size = New-Object System.Drawing.Size(140, 36)
$btnStart.FlatStyle = 'Flat'
$btnStart.BackColor = $Gold
$btnStart.ForeColor = $Ink
$btnStart.FlatAppearance.BorderColor = $Gold
$btnStart.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10)
$btnStart.Add_Click({
  $form.DialogResult = [System.Windows.Forms.DialogResult]::OK
  $form.Close()
})
$form.Controls.Add($btnStart)

function Update-Ui {
  $results = Get-CheckResults
  $missing = New-Object System.Collections.Generic.List[string]
  $allOk = $true

  foreach ($key in $script:keys) {
    $item = $results[$key]
    $cb = $script:checks[$key]
    $cb.Checked = [bool]$item.Ok
    if ($item.Ok) {
      $cb.Text = "  OK - $($item.Title)"
      $cb.ForeColor = $OkGreen
    } else {
      $allOk = $false
      $cb.Text = "  MISSING - $($item.Title)"
      $cb.ForeColor = $BadRed
      [void]$missing.Add($item.Hint)
    }
  }

  if ($allOk) {
    $status.Text = "All checks passed. You can start RESERVANCE, or choose Don't show again."
    $status.ForeColor = $OkGreen
    $btnDont.Enabled = $true
    $hint.Text = 'Everything needed on this PC was found. Classroom mode supports 100+ students on the school LAN.'
  } else {
    $status.Text = 'Some requirements are still missing. See the red lines above.'
    $status.ForeColor = $BadRed
    $btnDont.Enabled = $false
    $hint.Text = ($missing | Select-Object -First 1)
  }

  return $allOk
}

$btnRefresh.Add_Click({ [void](Update-Ui) })
$form.AcceptButton = $btnStart

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000
$timer.Add_Tick({ [void](Update-Ui) })
$form.Add_Shown({
  [void](Update-Ui)
  $timer.Start()
})
$form.Add_FormClosed({
  $timer.Stop()
  $timer.Dispose()
})

$result = $form.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) { exit 0 }
exit 1
