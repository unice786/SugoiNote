#Requires -Version 5.1
# Builds the full manual PDF and one PDF per part using Microsoft Edge (headless).
# Usage:  powershell -ExecutionPolicy Bypass -File .\build-pdf.ps1

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$source = Join-Path $root "manual-en-b1.html"
if (-not (Test-Path $source)) { throw "Source not found: $source" }

$edgeCandidates = @(
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")
)
$edge = $edgeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw "Microsoft Edge was not found. Install Edge or edit the path in this script." }

$html = Get-Content -Raw -Encoding UTF8 $source
$style = [regex]::Match($html, '(?s)<style>.*?</style>').Value
if (-not $style) { throw "No <style> block found in $source" }

$parts = @(
    @{ N = 1; Title = "Your Account and the Home Page"; Person = "Person 1" },
    @{ N = 2; Title = "Notes and the Editor";            Person = "Person 2" },
    @{ N = 3; Title = "AI Summaries and AI Exams";       Person = "Person 3" },
    @{ N = 4; Title = "Chat IA and the Community";       Person = "Person 4" },
    @{ N = 5; Title = "Profile, Progress, and Help";     Person = "Person 5" }
)

$partsDir = Join-Path $root "partes"
New-Item -ItemType Directory -Force -Path $partsDir | Out-Null
$profileDir = Join-Path $env:TEMP "sugoinote-edge-pdf"
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

function New-Pdf {
    param([string]$HtmlFile, [string]$PdfFile)

    if (Test-Path $PdfFile) { Remove-Item $PdfFile -Force }
    $url = "file:///" + ($HtmlFile -replace '\\', '/')
    $edgeArgs = @(
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--user-data-dir=$profileDir",
        "--no-pdf-header-footer",
        "--print-to-pdf=$PdfFile",
        $url
    )
    Start-Process -FilePath $edge -ArgumentList $edgeArgs -Wait -NoNewWindow | Out-Null
    if (-not (Test-Path $PdfFile)) { throw "PDF was not created: $PdfFile" }
    $size = [math]::Round((Get-Item $PdfFile).Length / 1KB, 1)
    Write-Host ("  OK  {0}  ({1} KB)" -f (Split-Path $PdfFile -Leaf), $size)
}

Write-Host "Building full manual..."
$fullPdf = Join-Path $root "SugoiNote-Manual-EN-B1.pdf"
New-Pdf -HtmlFile $source -PdfFile $fullPdf

foreach ($p in $parts) {
    $n = $p.N
    Write-Host ("Building part {0}..." -f $n)
    $pattern = '(?s)<!--PART:' + $n + ':START-->(.*?)<!--PART:' + $n + ':END-->'
    $m = [regex]::Match($html, $pattern)
    if (-not $m.Success) { throw "Part $n was not found in the source HTML." }
    $body = $m.Groups[1].Value -replace 'class="part"', 'class="part part-standalone"'
    $lead = [regex]::Match($body, '(?s)<p class="lead">(.*?)</p>').Groups[1].Value
    # The cover already shows the title, so remove the repeated section header.
    $body = [regex]::Replace($body, '(?s)<div class="part-head">.*?(?=<div class="box goals">)', '')

    $doc = @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SugoiNote Manual - Part ${n}: $($p.Title)</title>
$style
</head>
<body>
<div class="mini-cover">
  <div class="part-kicker">SugoiNote Web System &middot; User Manual (English B1)</div>
  <h1>$($p.Title)</h1>
  <p class="lead">$lead</p>
  <div class="mini-badge">Part $n of 5 &middot; $($p.Person)</div>
  <div class="who">This part is self-contained. It includes learning goals, key vocabulary, step-by-step instructions, review questions, and an answer key.</div>
</div>
$body
</body>
</html>
"@

    $partHtml = Join-Path $partsDir ("parte-{0}.html" -f $n)
    $partPdf = Join-Path $partsDir ("SugoiNote-Manual-EN-B1-Parte-{0}.pdf" -f $n)
    Set-Content -Path $partHtml -Value $doc -Encoding UTF8
    New-Pdf -HtmlFile $partHtml -PdfFile $partPdf
}

Write-Host ""
Write-Host "Done."
Write-Host ("Full manual : {0}" -f $fullPdf)
Write-Host ("Individual  : {0}" -f $partsDir)
