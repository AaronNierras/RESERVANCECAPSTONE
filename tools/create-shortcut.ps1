# Builds a square RESERVANCE icon and desktop shortcut for this PC.
# The shortcut may live on the Desktop, outside the project folder.
# A copied .bat file cannot keep a custom icon, so the shortcut is the launcher.
param(
  [Parameter(Mandatory = $true)][string]$Root
)

$ErrorActionPreference = 'Stop'
$Root = [System.IO.Path]::GetFullPath($Root.TrimEnd('\', '/'))
$bat = Join-Path $Root 'start-reservance.bat'
$png = Join-Path $Root 'frontend\public\logosymbol.png'
$ico = Join-Path $Root 'frontend\public\reservance.ico'
$logoIco = Join-Path $Root 'frontend\public\logosymbol.ico'
$favicon = Join-Path $Root 'frontend\public\favicon.ico'

if (-not (Test-Path $bat)) {
  Write-Error "start-reservance.bat was not found in $Root"
}

Add-Type -AssemblyName System.Drawing

function New-SquareBitmap {
  param($Source, [int]$Size)
  $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $scale = [Math]::Min($Size / $Source.Width, $Size / $Source.Height)
  $dw = [Math]::Max(1, [int][Math]::Round($Source.Width * $scale))
  $dh = [Math]::Max(1, [int][Math]::Round($Source.Height * $scale))
  $dx = [int](($Size - $dw) / 2)
  $dy = [int](($Size - $dh) / 2)
  $graphics.DrawImage($Source, $dx, $dy, $dw, $dh)
  $graphics.Dispose()
  return $bmp
}

function Get-BottomUpBgra {
  param($Bitmap)
  $rect = New-Object System.Drawing.Rectangle 0, 0, $Bitmap.Width, $Bitmap.Height
  $data = $Bitmap.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $stride = [Math]::Abs($data.Stride)
    $raw = New-Object byte[] ($Bitmap.Height * $stride)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $raw, 0, $raw.Length)
    $out = New-Object System.Collections.Generic.List[byte]
    for ($y = $Bitmap.Height - 1; $y -ge 0; $y--) {
      $start = $y * $stride
      for ($x = 0; $x -lt ($Bitmap.Width * 4); $x++) {
        $out.Add($raw[$start + $x])
      }
    }
    return $out.ToArray()
  } finally {
    $Bitmap.UnlockBits($data)
  }
}

function Get-AndMask {
  param($Bitmap)
  $rowBytes = [int]([Math]::Ceiling($Bitmap.Width / 32.0) * 4)
  $mask = New-Object byte[] ($rowBytes * $Bitmap.Height)
  for ($y = 0; $y -lt $Bitmap.Height; $y++) {
    $srcY = $Bitmap.Height - 1 - $y
    for ($x = 0; $x -lt $Bitmap.Width; $x++) {
      $alpha = $Bitmap.GetPixel($x, $srcY).A
      if ($alpha -lt 16) {
        $byteIndex = ($y * $rowBytes) + [Math]::Floor($x / 8)
        $bit = [byte](128 / [Math]::Pow(2, ($x % 8)))
        $mask[$byteIndex] = $mask[$byteIndex] -bor $bit
      }
    }
  }
  return $mask
}

function Save-MultiIcon {
  param($SourcePath, $DestPath)
  $source = [System.Drawing.Image]::FromFile($SourcePath)
  $sizes = @(16, 32, 48, 256)
  $frames = @()
  try {
    foreach ($size in $sizes) {
      $bmp = New-SquareBitmap -Source $source -Size $size
      $xor = Get-BottomUpBgra -Bitmap $bmp
      $mask = Get-AndMask -Bitmap $bmp
      $header = New-Object byte[] 40
      [BitConverter]::GetBytes([uint32]40).CopyTo($header, 0)
      [BitConverter]::GetBytes([int32]$size).CopyTo($header, 4)
      [BitConverter]::GetBytes([int32]($size * 2)).CopyTo($header, 8)
      [BitConverter]::GetBytes([uint16]1).CopyTo($header, 12)
      [BitConverter]::GetBytes([uint16]32).CopyTo($header, 14)
      $frames += [pscustomobject]@{
        Size = $size
        Bytes = ($header + $xor + $mask)
      }
      $bmp.Dispose()
    }
  } finally {
    $source.Dispose()
  }

  $count = $frames.Count
  $offset = 6 + (16 * $count)
  $stream = New-Object System.IO.MemoryStream
  $writer = New-Object System.IO.BinaryWriter $stream
  $writer.Write([uint16]0)
  $writer.Write([uint16]1)
  $writer.Write([uint16]$count)
  foreach ($frame in $frames) {
    $dim = if ($frame.Size -ge 256) { [byte]0 } else { [byte]$frame.Size }
    $writer.Write($dim)
    $writer.Write($dim)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$frame.Bytes.Length)
    $writer.Write([uint32]$offset)
    $offset += $frame.Bytes.Length
  }
  $writer.Flush()
  foreach ($frame in $frames) {
    $stream.Write($frame.Bytes, 0, $frame.Bytes.Length)
  }
  [System.IO.File]::WriteAllBytes($DestPath, $stream.ToArray())
  $writer.Dispose()
  $stream.Dispose()
}

if (Test-Path $png) {
  Save-MultiIcon -SourcePath $png -DestPath $ico
  Copy-Item -Path $ico -Destination $logoIco -Force
  Copy-Item -Path $ico -Destination $favicon -Force
  Write-Host "Icon rebuilt: $ico"
} elseif (-not (Test-Path $ico)) {
  Write-Error "logosymbol.png and logosymbol.ico are both missing."
}

$shell = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$links = @(
  (Join-Path $Root 'RESERVANCE.lnk'),
  (Join-Path $desktop 'RESERVANCE.lnk')
)
foreach ($linkPath in $links) {
  $shortcut = $shell.CreateShortcut($linkPath)
  $shortcut.TargetPath = $bat
  $shortcut.WorkingDirectory = $Root
  $shortcut.WindowStyle = 1
  $shortcut.Description = 'Start RESERVANCE on this computer'
  if (Test-Path $ico) {
    $shortcut.IconLocation = "$ico,0"
  }
  $shortcut.Save()
  Write-Host "Created: $linkPath"
}
