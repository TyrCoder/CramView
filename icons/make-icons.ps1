# Re-creates the PNG icons. Run:  powershell -ExecutionPolicy Bypass -File icons/make-icons.ps1
Add-Type -AssemblyName System.Drawing
function New-Icon($size, $path, $maskable) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $indigo = [System.Drawing.ColorTranslator]::FromHtml('#4f46e5')
  $g.Clear($indigo)   # full-bleed square: iOS rounds corners itself
  $k = $size / 512.0
  $scale = if ($maskable) { 0.78 } else { 1.0 }   # maskable keeps content inside the safe zone
  $g.TranslateTransform($size/2, $size/2); $g.ScaleTransform($k*$scale, $k*$scale); $g.TranslateTransform(-256, -256)
  $white = [System.Drawing.Brushes]::White
  $ghost = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(90,255,255,255))
  $state = $g.Save(); $g.TranslateTransform(256,256); $g.RotateTransform(-8); $g.TranslateTransform(-256,-256)
  $g.FillRectangle($ghost, 132, 120, 248, 272); $g.Restore($state)
  $g.FillRectangle($white, 132, 120, 248, 272)
  $pen = New-Object System.Drawing.Pen $indigo, 22; $pen.StartCap='Round'; $pen.EndCap='Round'
  $g.DrawLine($pen, 178,196,334,196); $g.DrawLine($pen, 178,244,334,244); $g.DrawLine($pen, 178,292,274,292)
  $star = New-Object System.Drawing.PointF[] 10
  for ($i=0; $i -lt 10; $i++) { $r = if ($i % 2 -eq 0) { 34 } else { 14 }; $a = [Math]::PI * $i / 5 - [Math]::PI/2
    $star[$i] = New-Object System.Drawing.PointF (366 + $r*[Math]::Cos($a)), (338 + $r*[Math]::Sin($a)) }
  $g.FillPolygon((New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#fbbf24'))), $star)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $g.Dispose(); $bmp.Dispose()
}
$dir = $PSScriptRoot
New-Icon 192 "$dir\icon-192.png" $false
New-Icon 512 "$dir\icon-512.png" $false
New-Icon 512 "$dir\maskable-512.png" $true
New-Icon 180 "$dir\apple-touch-icon.png" $false
