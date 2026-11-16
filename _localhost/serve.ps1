# Simple static file server for local preview (no Python/Node needed).
# Serves the parent folder (the site root) on http://127.0.0.1:<port>/
# Close this window to stop the server.
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8'; '.css'='text/css'
  '.js'='application/javascript'; '.json'='application/json'; '.xml'='application/xml'; '.txt'='text/plain'
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif'; '.svg'='image/svg+xml'
  '.ico'='image/x-icon'; '.webp'='image/webp'; '.woff'='font/woff'; '.woff2'='font/woff2'; '.ttf'='font/ttf'
  '.otf'='font/otf'; '.eot'='application/vnd.ms-fontobject'; '.pdf'='application/pdf'; '.mp4'='video/mp4'
}

$listener = $null; $port = $null
foreach ($p in 8080..8095) {
  try {
    $l = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
    $l.ExclusiveAddressUse = $true
    $l.Start(); $listener = $l; $port = $p; break
  } catch { }
}
if (-not $listener) { Write-Host "No free port between 8080-8095."; exit 1 }

function Send-Response($stream, $method, $code, $status, $ctype, [byte[]]$body, $extra) {
  $head = "HTTP/1.1 $code $status`r`nContent-Type: $ctype`r`nContent-Length: $($body.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n$extra`r`n"
  $hb = [Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length)
  if ($method -ne 'HEAD' -and $body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

function Handle-Client($client) {
  try {
    $s = $client.GetStream(); $s.ReadTimeout = 3000
    $reader = New-Object IO.StreamReader($s, [Text.Encoding]::ASCII)
    $line = $reader.ReadLine()
    while ($true) { $h = $reader.ReadLine(); if ($h -eq $null -or $h -eq '') { break } }
    if (-not $line) { return }
    $parts = $line.Split(' ')
    if ($parts.Length -lt 2) { return }
    $method = $parts[0]
    $urlPath = [Uri]::UnescapeDataString(($parts[1] -split '\?')[0])
    $rel = $urlPath.TrimStart('/') -replace '/', '\'
    $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
    $empty = [byte[]]@()
    if (-not ($path -eq $root -or $path.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase))) {
      Send-Response $s $method 403 'Forbidden' 'text/plain' $empty ''
      Write-Host "403 $urlPath"; return
    }
    if ((Test-Path -LiteralPath $path -PathType Container) -and -not $urlPath.EndsWith('/')) {
      Send-Response $s $method 301 'Moved Permanently' 'text/plain' $empty "Location: $urlPath/`r`n"; return
    }
    if (Test-Path -LiteralPath $path -PathType Container) { $path = Join-Path $path 'index.html' }
    if (Test-Path -LiteralPath $path -PathType Leaf) {
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $ctype = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [IO.File]::ReadAllBytes($path)
      Send-Response $s $method 200 'OK' $ctype $bytes ''
      Write-Host "200 $urlPath"
    } else {
      Send-Response $s $method 404 'Not Found' 'text/plain' ([Text.Encoding]::ASCII.GetBytes("404 Not Found: $urlPath")) ''
      Write-Host "404 $urlPath"
    }
  } catch {
    Write-Host "ERR $($_.Exception.Message)"
  } finally { $client.Close() }
}

$url = "http://127.0.0.1:$port/"
Write-Host "Serving $root"
Write-Host "Open: $url   (close this window to stop the server)"
Start-Process $url

# Non-blocking loop so idle browser pre-connections don't stall other requests.
$pending = New-Object System.Collections.ArrayList
try {
  while ($true) {
    while ($listener.Pending()) {
      [void]$pending.Add(@{ c = $listener.AcceptTcpClient(); t = [DateTime]::UtcNow })
    }
    foreach ($item in @($pending)) {
      $c = $item.c
      if ($c.Available -gt 0) {
        $pending.Remove($item); Handle-Client $c
      } elseif (([DateTime]::UtcNow - $item.t).TotalSeconds -gt 15) {
        $pending.Remove($item); $c.Close()
      }
    }
    Start-Sleep -Milliseconds 5
  }
} finally { $listener.Stop() }
