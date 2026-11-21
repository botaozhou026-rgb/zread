param(
    [string]$ShortcutDirectory = [Environment]::GetFolderPath('DesktopDirectory')
)

$ErrorActionPreference = 'Stop'
$edge = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path -LiteralPath $edge -PathType Leaf)) {
    throw 'Microsoft Edge was not found.'
}
$page = [Uri](Join-Path $PSScriptRoot 'index.html')
$shortcutName = '班级成绩统计器.lnk'
$shortcutPath = Join-Path $ShortcutDirectory $shortcutName
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $edge
$shortcut.Arguments = '--app="' + $page.AbsoluteUri + '"'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = '班级成绩统计器'
$shortcut.IconLocation = (Join-Path $PSScriptRoot 'gradebook.ico') + ',0'
$shortcut.Save()

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class GradebookShell {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    public static extern void SHChangeNotify(uint eventId, uint flags, string path, IntPtr unused);
}
"@
[GradebookShell]::SHChangeNotify(0x2000, 0x0005, $shortcutPath, [IntPtr]::Zero)
Write-Output $shortcutPath
