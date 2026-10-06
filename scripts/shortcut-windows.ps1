# Bu bilgisayarda create-hazal-app'i Başlat menüsü ve masaüstü kısayoluyla açılabilir yapar.
#
# Neden kurulum dosyası değil: Windows Smart App Control açıkken imzasız ve yeni derlenmiş exe'leri
# engelleyebilir. Kısayol, projedeki Electron'u (node_modules) uygulama klasörüyle başlatır.
# Önce: npm install ve npm run build (arayüz dist/renderer altında derlenmiş olmalı).
#
# Kullanım:  npm run shortcut:win               Kısayolları oluştur
#            npm run shortcut:win -- -Remove    Kısayolları kaldır

param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$project = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$electron = Join-Path $project 'node_modules\electron\dist\electron.exe'
$name = 'create-hazal-app'
$links = @(
  (Join-Path ([Environment]::GetFolderPath('Programs')) "$name.lnk"),
  (Join-Path ([Environment]::GetFolderPath('Desktop')) "$name.lnk")
)

if ($Remove) {
  Remove-Item $links -Force -ErrorAction SilentlyContinue
  Write-Host 'Kısayollar kaldırıldı.'
  exit 0
}

if (-not (Test-Path $electron)) { throw 'Electron bulunamadı. Önce npm install çalıştır.' }
if (-not (Test-Path (Join-Path $project 'dist\renderer\index.html'))) { throw 'Uygulama derlenmemiş. Önce npm run build çalıştır.' }

$shell = New-Object -ComObject WScript.Shell
foreach ($path in $links) {
  $link = $shell.CreateShortcut($path)
  $link.TargetPath = $electron
  $link.Arguments = '"' + $project + '"'
  $link.WorkingDirectory = $project
  $link.IconLocation = (Join-Path $project 'build\icon.ico') + ',0'
  $link.Description = 'Spring Boot projelerini hızlıca kur'
  $link.Save()
}
Write-Host 'Kısayollar oluşturuldu: Başlat menüsü ve masaüstü.'
