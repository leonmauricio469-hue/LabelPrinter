# Medidas sobre el catalogo real para fijar el umbral de escaneo parcial.
# No modifica nada: solo escribe en pantalla.
$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$j = Get-Content (Join-Path (Split-Path -Parent $raiz) "data\catalog.json") -Raw -Encoding UTF8 | ConvertFrom-Json

Write-Output "### Codigos de producto: forma"
$ejemplo = ($j | Select-Object -First 3 | ForEach-Object { $_.code }) -join ", "
Write-Output ("  los 3 primeros: " + $ejemplo)
$lens = @($j | ForEach-Object { $_.code.Length })
Write-Output ("  longitud: min=" + ($lens | Measure-Object -Minimum).Minimum + "  max=" + ($lens | Measure-Object -Maximum).Maximum)

Write-Output ""
Write-Output "### Barcodes de solo digitos, por longitud (los que un escaner puede leer)"
$soloDig = @($j | Where-Object { $_.barcode -match '^[0-9]+$' -and $_.barcode -notmatch '^0+$' })
$grupos = $soloDig | Group-Object -Property { $_.barcode.Length } | Sort-Object { [int]$_.Name }
foreach ($g in $grupos) {
  $ej = $g.Group[0]
  Write-Output ("  " + $g.Name + " digitos: " + $g.Count + " productos   ej. " + $ej.barcode + " = " + $ej.name)
}

Write-Output ""
Write-Output "### De esos, los que tienen menos de 7 digitos (NO hay ninguno util)"
$cortos = @($soloDig | Where-Object { $_.barcode.Length -lt 7 })
if ($cortos.Count -eq 0) {
  Write-Output "  ninguno. El barcode numerico mas corto del catalogo tiene 7 digitos."
} else {
  foreach ($c in $cortos) { Write-Output ("  " + $c.barcode + "  " + $c.name) }
}

Write-Output ""
Write-Output "### Barcodes no numericos de menos de 7 caracteres"
$noNum = @($j | Where-Object { $_.barcode -match '[^\d]' -and $_.barcode.Length -lt 7 })
foreach ($c in $noNum) { Write-Output ("  " + $c.barcode + "  " + $c.name) }

Write-Output ""
Write-Output "### Un barcode puede ser igual a un code de producto?"
$codes = @{}
foreach ($p in $j) { $codes[$p.code] = $true }
$colision = @($j | Where-Object { $codes.ContainsKey($_.barcode) })
Write-Output ("  productos cuyo barcode es IGUAL a un code: " + $colision.Count)
foreach ($c in ($colision | Select-Object -First 10)) {
  Write-Output ("    code=" + $c.code + "  barcode=" + $c.barcode + "  " + $c.name)
}

Write-Output ""
Write-Output "### Cuantos codigos de producto son prefijo de algun barcode (el riesgo real)"
$riesgo = 0
$ejemplos = @()
foreach ($c in ($j.code | Select-Object -Unique)) {
  if ($c.Length -ge 7) { continue }
  $n = @($j | Where-Object { $_.barcode -like ($c + "*") -and $_.barcode -ne $c })
  if ($n.Count -gt 0) {
    $riesgo = $riesgo + $n.Count
    if ($ejemplos.Count -lt 8) {
      foreach ($x in ($n | Select-Object -First 1)) {
        $ejemplos += ("    teclean " + $c + " -> cae en el code del producto " + $c + ", pero el barcode " + $x.barcode + " (" + $x.name + ") empieza por ahi")
      }
    }
  }
}
Write-Output ("  productos cuyo barcode empieza por un code corto: " + $riesgo)
$ejemplos | ForEach-Object { Write-Output $_ }
