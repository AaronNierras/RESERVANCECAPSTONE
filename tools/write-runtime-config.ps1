# Writes frontend/public/runtime-config.js for this PC's LAN IP.
param(
  [Parameter(Mandatory = $true)][string]$Root,
  [string]$PreferHost = ''
)

$ErrorActionPreference = 'SilentlyContinue'
$Root = [System.IO.Path]::GetFullPath($Root.TrimEnd('\', '/'))

function Get-LanIPv4 {
  if ($PreferHost -and $PreferHost -ne '127.0.0.1' -and $PreferHost -ne 'localhost') {
    return $PreferHost
  }
  $candidates = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object -Property InterfaceMetric |
    Select-Object -ExpandProperty IPAddress
  if ($candidates) { return $candidates[0] }
  return '127.0.0.1'
}

$ip = Get-LanIPv4
$out = Join-Path $Root 'frontend\public\runtime-config.js'
# Do not hardcode apiUrl/realtimeUrl to the LAN IP — that breaks login on the
# teacher PC when browsers open http://127.0.0.1:5173. The SPA builds those
# URLs from window.location.hostname (see frontend/src/config.js).
$js = @"
window.RESERVANCE_RUNTIME = {
  realtimeSecret: 'reservance-dev-secret',
}
"@
Set-Content -Path $out -Value $js -Encoding ASCII
Write-Output $ip
