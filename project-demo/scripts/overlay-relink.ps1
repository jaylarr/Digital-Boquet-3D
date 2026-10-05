param([string]$ProjectPath = '')
$ErrorActionPreference = 'Stop'
$taskMap = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'media-paths.json') -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($ProjectPath)) { $ProjectPath = Join-Path $PSScriptRoot $taskMap.project }
$taskProjectRoot = (Resolve-Path -LiteralPath $ProjectPath).ProviderPath
$taskDraftPath = Join-Path $taskProjectRoot 'draft_content.json'
$taskMetaPath = Join-Path $taskProjectRoot 'draft_meta_info.json'
$taskContent = Get-Content -LiteralPath $taskDraftPath -Raw | ConvertFrom-Json
$taskMeta = Get-Content -LiteralPath $taskMetaPath -Raw | ConvertFrom-Json
$taskManifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'package-manifest.json') -Raw | ConvertFrom-Json
$taskCount = 0
foreach ($taskCategory in $taskContent.materials.PSObject.Properties) {
    foreach ($taskMaterial in $taskCategory.Value) {
        if ($null -eq $taskMaterial -or $null -eq $taskMaterial.id) { continue }
        $taskMapping = $taskMap.materialPaths.PSObject.Properties[$taskMaterial.id]
        if ($null -eq $taskMapping) { continue }
        $taskMediaPath = [IO.Path]::GetFullPath((Join-Path $taskProjectRoot $taskMapping.Value))
        if (-not $taskMediaPath.StartsWith($taskProjectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Media path escaped project folder' }
        if (-not (Test-Path -LiteralPath $taskMediaPath -PathType Leaf)) { throw ('Missing media: ' + $taskMapping.Value) }
        if ([IO.Path]::GetFileName($taskMaterial.path) -ne [IO.Path]::GetFileName($taskMediaPath)) { throw 'A packaged material was manually replaced; preserve that edit before relinking' }
        $taskManifestPath = ($taskMap.project + '/' + $taskMapping.Value).Replace('\','/')
        $taskEntry = @($taskManifest.files | Where-Object path -EQ $taskManifestPath)
        if ($taskEntry.Count -ne 1) { throw 'Media missing from package manifest' }
        if ((Get-FileHash -LiteralPath $taskMediaPath -Algorithm SHA256).Hash -ne $taskEntry[0].sha256) { throw ('Changed media: ' + $taskMapping.Value) }
        $taskMaterial.path = $taskMediaPath
        $taskCount++
    }
}
if ($taskCount -ne @($taskMap.materialPaths.PSObject.Properties).Count) { throw 'Draft does not contain the complete packaged media family' }
$taskMeta.draft_fold_path = $taskProjectRoot
$taskMeta.draft_root_path = [IO.Path]::GetDirectoryName($taskProjectRoot)
$taskMeta.draft_cover = Join-Path $taskProjectRoot 'cover.png'
$taskBeforeHash = (Get-FileHash -LiteralPath $taskDraftPath -Algorithm SHA256).Hash.Substring(0,12)
$taskBackup = Join-Path $taskProjectRoot ('draft_content.before-relink-' + $taskBeforeHash + '.json')
if (-not (Test-Path -LiteralPath $taskBackup)) { Copy-Item -LiteralPath $taskDraftPath -Destination $taskBackup }
$taskUtf8 = New-Object System.Text.UTF8Encoding($false)
$taskDraftJson = $taskContent | ConvertTo-Json -Depth 100
$taskMetaJson = $taskMeta | ConvertTo-Json -Depth 100
[IO.File]::WriteAllText($taskDraftPath + '.pending', $taskDraftJson, $taskUtf8)
[IO.File]::WriteAllText($taskMetaPath + '.pending', $taskMetaJson, $taskUtf8)
$null = Get-Content -LiteralPath ($taskDraftPath + '.pending') -Raw | ConvertFrom-Json
$null = Get-Content -LiteralPath ($taskMetaPath + '.pending') -Raw | ConvertFrom-Json
Move-Item -LiteralPath ($taskDraftPath + '.pending') -Destination $taskDraftPath -Force
Move-Item -LiteralPath ($taskMetaPath + '.pending') -Destination $taskMetaPath -Force
Write-Output ('Relinked ' + $taskCount + ' media references. Open PetalPop - Overlay Ad V2 in CapCut.')
