param(
    [string]$Source  = "C:\Users\BODEGON\Pictures\logo vectorizado.png",
    [string]$OutFile = "C:\Users\BODEGON\Documents\Default Project\LabelPrinter\label-printer-web\src\lib\labels\pa-picar-logo.ts",
    [int]$TargetW = 200,
    [int]$TargetH = 67,
    [int]$Threshold = 150
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# 1. load and flatten alpha onto white
$src = [System.Drawing.Image]::FromFile($Source)

$flat = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g = [System.Drawing.Graphics]::FromImage($flat)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($src, 0, 0, $src.Width, $src.Height)
$g.Dispose()
$src.Dispose()

# 2. resize to the target dot size
$w = $TargetW
$h = $TargetH
$small = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g2 = [System.Drawing.Graphics]::FromImage($small)
$g2.Clear([System.Drawing.Color]::White)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g2.DrawImage($flat, 0, 0, $w, $h)
$g2.Dispose()
$flat.Dispose()

# 3. threshold to 1 bit
$bits = New-Object 'bool[,]' $w, $h
for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $c = $small.GetPixel($x, $y)
        $lum = (0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B)
        $bits[$x, $y] = ($lum -lt $Threshold)   # true = black
    }
}
$small.Dispose()

# 4. pack rows, byte aligned, MSB = leftmost pixel (ZPL ^GF bit order)
$rowBytes = [math]::Ceiling($w / 8.0)
$sb = New-Object System.Text.StringBuilder
$total = 0
$lineChars = 250
$line = New-Object System.Text.StringBuilder

for ($y = 0; $y -lt $h; $y++) {
    for ($byteIdx = 0; $byteIdx -lt $rowBytes; $byteIdx++) {
        $b = 0
        for ($bit = 0; $bit -lt 8; $bit++) {
            $px = $byteIdx * 8 + $bit
            if ($px -lt $w -and $bits[$px, $y]) { $b = $b -bor (0x80 -shr $bit) }
        }
        [void]$line.Append($b.ToString("X2"))
        $total++
        if ($line.Length -ge $lineChars) { [void]$sb.Append($line.ToString()); [void]$sb.Append("`n"); $line.Clear() | Out-Null }
    }
}
if ($line.Length -gt 0) { [void]$sb.Append($line.ToString()); [void]$sb.Append("`n") }

$data = $sb.ToString()
$totalBytes = $rowBytes * $h
$blackPixels = 0
for ($y = 0; $y -lt $h; $y++) { for ($x = 0; $x -lt $w; $x++) { if ($bits[$x, $y]) { $blackPixels++ } } }
$pct = [math]::Round(100.0 * $blackPixels / ($w * $h), 1)

Write-Host "logo: ${w}x${h} dots, rowBytes=$rowBytes, totalBytes=$totalBytes, hexChars=$($data.Length)"
Write-Host "ink: $blackPixels pixels negros ($pct% del area)"

if ($blackPixels -eq 0) { throw "El logo quedo completamente en blanco: revisa el umbral (Threshold=$Threshold) o la imagen fuente." }

# 5. emit the TypeScript module (template literal: hex data contains no backticks)
$bt = [char]96
$ts = "// GENERATED FILE - do not edit by hand." + "`n" +
      "// Source: $Source" + "`n" +
      "// Regenerate with: powershell -File scripts/generate-logo.ps1" + "`n" +
      "//" + "`n" +
      "// Monochrome bitmap for the ZPL ^GF (graphic field) command, sized in printer" + "`n" +
      "// dots (203 dpi). $w x $h dots, $totalBytes bytes, $pct% ink." + "`n" + "`n" +
      "export const LOGO_DOTS_W = $w;" + "`n" +
      "export const LOGO_DOTS_H = $h;" + "`n" + "`n" +
      "/** ^GFA: ASCII-hex graphic field, $rowBytes bytes per row. */" + "`n" +
      "export const LOGO_GF = " + $bt + "^GFA,$totalBytes,$totalBytes,$rowBytes," + "`n" +
      $data + "^FS" + $bt + ";" + "`n"

[System.IO.File]::WriteAllText($OutFile, $ts, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "written: $OutFile ($((Get-Item $OutFile).Length) bytes)"
