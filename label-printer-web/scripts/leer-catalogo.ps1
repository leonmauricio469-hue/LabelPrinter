<#
    Lee la lista de precios exportada por el sistema de PA PICAR y la deja en un CSV.

    El export es un .xls binario de verdad (OLE2, bytes D0 CF 11 E0), asi que no se puede
    leer como texto: hace falta Excel por COM. Se abre en SOLO LECTURA, con las macros
    deshabilitadas, y se cierra sin guardar. El archivo original no se toca nunca.

    Como leer celda por celda 3080 filas por COM tarda varios minutos, se pide el
    UsedRange entero de una vez (`$ws.UsedRange.Value2`), que es una sola llamada.

    Uso:  powershell -NoProfile -File scripts\leer-catalogo.ps1 -Entrada "ruta\al\archivo.xls"
#>
param(
    [Parameter(Mandatory = $true)][string]$Entrada,
    [string]$Salida = ".tmp-catalogo.csv"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $Entrada)) {
    throw "No existe el archivo: $Entrada"
}

$ErrorActionPreference = "Stop"
$xl = $null
$wb = $null
try {
    $xl = New-Object -ComObject Excel.Application
    $xl.Visible = $false
    $xl.DisplayAlerts = $false
    $xl.AskToUpdateLinks = $false
    # 3 = msoAutomationSecurityForceDisable: no ejecutar macros aunque el .xls las traiga.
    $xl.AutomationSecurity = 3

    # UpdateLinks = 0, ReadOnly = $true
    $wb = $xl.Workbooks.Open($Entrada, 0, $true)
    $ws = $wb.Worksheets.Item(1)
    $rango = $ws.UsedRange
    $datos = $rango.Value2
    $filas = $rango.Rows.Count
    $columnas = $rango.Columns.Count

    Write-Host ("leidas {0} filas x {1} columnas" -f $filas, $columnas)

    $sb = New-Object System.Text.StringBuilder
    for ($r = 1; $r -le $filas; $r++) {
        $campos = @()
        for ($c = 1; $c -le $columnas; $c++) {
            $v = $datos[$r, $c]
            if ($null -eq $v) { $v = "" }
            $s = ([string]$v).Trim()
            # El export usa ";" como separador y hay nombres con comas, asi que se entrecomilla
            # cuando aparece cualquier caracter que rompa el formato.
            if ($s -match '[",;]') { $s = '"' + $s.Replace('"', '""') + '"' }
            $campos += $s
        }
        [void]$sb.AppendLine(($campos -join ";"))
    }

    # UTF-8 SIN BOM. Con BOM, el primer nombre del catalogo salia con un caracter invisible
    # delante y no coincidia con nada (bug ya encontrado una vez en otro archivo).
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Salida, $sb.ToString(), $utf8)

    Write-Host ("escrito: {0} ({1} bytes)" -f $Salida, (Get-Item -LiteralPath $Salida).Length)
}
finally {
    if ($null -ne $wb) { $wb.Close($false) }   # False = no guardar
    if ($null -ne $xl) { $xl.Quit() }
    if ($null -ne $xl) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) }
}
