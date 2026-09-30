# Sends raw bytes to a Windows printer queue (no rendering, no driver wrapping).
# Used by the USB transport: the Zebra interprets the bytes as ZPL.
# ASCII only on purpose: Windows PowerShell 5.1 reads .ps1 as ANSI without a BOM.

param(
    [Parameter(Mandatory = $true)][string]$Printer,
    [Parameter(Mandatory = $true)][ValidateSet('Send', 'Check', 'Status')][string]$Mode,
    [string]$Base64 = ""
)

$ErrorActionPreference = 'Stop'

function Emit($ok, $error, $extra) {    $o = [ordered]@{ ok = $ok; error = $error }
    if ($extra) { foreach ($k in $extra.Keys) { $o[$k] = $extra[$k] } }
    Write-Output ($o | ConvertTo-Json -Compress)
}

# --- Status mode: what Windows knows about the queue ---
# Deliberately before Add-Type: this mode does not open the queue, and compiling the
# P/Invoke block costs a few hundred ms on every call. Measured on this PC: a powershell.exe
# spawn costs ~2 s end to end, so anything avoidable here is worth avoiding.
if ($Mode -eq 'Status') {
    # Exact name only, the same one OpenPrinter uses to send. A substring fallback could
    # report the status of a different queue than the one that receives the labels.
    $q = Get-Printer -Name $Printer -ErrorAction SilentlyContinue
    if (-not $q) {
        Emit $true $null @{ queue = $Printer; found = $false }
        exit 0
    }
    # PrinterStatus is a FLAGS enum, so the integer matters more than the name: the name is
    # only printed when a single bit is set. statusFlags is what the app interprets.
    Emit $true $null @{
        queue       = $q.Name
        found       = $true
        statusFlags = [int]$q.PrinterStatus
        statusText  = "$($q.PrinterStatus)"
        jobCount    = [int]$q.JobCount
        port        = $q.PortName
        driver      = $q.DriverName
    }
    exit 0
}

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class Spool
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFOW
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr pDefault);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr handle);

    // CharSet.Unicode resolves this to StartDocPrinterW, so it MUST take DOCINFOW.
    // Native contract: 3 parameters, returns the spooler job id (0 = failure). It used to be
    // declared as bool with a 4th `out jobId` that nothing native ever filled.
    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern int StartDocPrinter(IntPtr handle, int level, ref DOCINFOW docInfo);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr handle);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool AbortPrinter(IntPtr handle);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr handle, byte[] buffer, int count, out int written);

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool SetPrinter(IntPtr handle, uint level, IntPtr pPrinterParam, IntPtr pcb);

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool GetPrinter(IntPtr handle, uint level, IntPtr pPrinter, ref uint cb);

    [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool DocumentProperties(IntPtr hWnd, IntPtr hPrinter, string pDeviceName,
        IntPtr pDevModeOutput, IntPtr pDevModeInput, IntPtr fMode);
}

public static class Win32Message
{
    public static string Get(int code)
    {
        try { return new System.ComponentModel.Win32Exception(code).Message; }
        catch { return "Win32=" + code; }
    }
}
"@

# --- resolve the queue by exact name, the same one OpenPrinter opens ---
$queue = Get-Printer -Name $Printer -ErrorAction SilentlyContinue

$handle = [IntPtr]::Zero
$jobId = 0

try {
    $di = New-Object Spool+DOCINFOW
    $di.pDocName = "LabelPrinter"
    $di.pOutputFile = $null
    $di.pDataType = "RAW"   # raw passthrough: no PJL, no driver rendering

    if (-not [Spool]::OpenPrinter($Printer, [ref]$handle, [IntPtr]::Zero)) {
        $e = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Emit $false "OpenPrinter('$Printer') fallo: $([Win32Message]::Get($e)) (Win32=$e)" @{ matchedName = $(if ($queue) { $queue.Name } else { $null }) }
        exit 1
    }

    if ($Mode -eq 'Check') {
        Emit $true $null @{ queue = $Printer; port = $(if ($queue) { $queue.PortName } else { $null }) }
        exit 0
    }

    # The app sends the payload on stdin: a batch passed as -Base64 overflows the
    # 32,767-char Windows command line at ~7 labels. -Base64 stays for manual tests.
    if (-not $Base64 -and [Console]::IsInputRedirected) {
        $Base64 = [Console]::In.ReadToEnd().Trim()
    }
    $bytes = [Convert]::FromBase64String($Base64)
    if ($bytes.Length -eq 0) { Emit $false "payload vacio" $null; exit 1 }

    $jobId = [Spool]::StartDocPrinter($handle, 1, [ref]$di)
    if ($jobId -eq 0) {
        $e = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Emit $false "StartDocPrinter fallo: $([Win32Message]::Get($e)) (Win32=$e)" $null
        exit 1
    }

    # WritePrinter may accept fewer bytes than asked: a successful call is not a full job.
    # Keep writing the rest; if it stops making progress, cancel the job instead of
    # reporting a partial label as sent.
    $offset = 0
    while ($offset -lt $bytes.Length) {
        $chunk = if ($offset -eq 0) { $bytes } else { $bytes[$offset..($bytes.Length - 1)] }
        $written = 0
        $okWrite = [Spool]::WritePrinter($handle, $chunk, $chunk.Length, [ref]$written)
        if (-not $okWrite -or $written -le 0) {
            $e = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
            # If the abort fails too (a degraded spooler often fails both), the job may stay
            # queued and print later: report it as uncertain so the app never auto-retries it.
            $aborted = [Spool]::AbortPrinter($handle)
            $what = if ($aborted) { "Trabajo $jobId cancelado." } else { "No se pudo cancelar el trabajo ${jobId}: puede imprimirse igual." }
            Emit $false "WritePrinter fallo tras $offset de $($bytes.Length) bytes: $([Win32Message]::Get($e)) (Win32=$e). $what" @{
                uncertain = -not $aborted
            }
            exit 1
        }
        $offset += $written
    }

    if (-not [Spool]::EndDocPrinter($handle)) {
        # Every byte already reached the spooler: the label may still print. Uncertain.
        $e = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        Emit $false "EndDocPrinter fallo con todo enviado: $([Win32Message]::Get($e)) (Win32=$e)" @{
            uncertain = $true
        }
        exit 1
    }

    Emit $true $null @{ bytes = $offset; queue = $Printer; jobId = $jobId }
    exit 0
}
catch {
    Emit $false $_.Exception.Message $null
    exit 1
}
finally {
    if ($handle -ne [IntPtr]::Zero) { [void][Spool]::ClosePrinter($handle) }
}
