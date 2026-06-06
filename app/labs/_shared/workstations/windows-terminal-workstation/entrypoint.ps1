# Isolated Windows Terminal Workstation entrypoint — keeps container alive; no host shell.
$ErrorActionPreference = 'Stop'

$Username = if ($env:SGQ_USERNAME) { $env:SGQ_USERNAME } elseif ($env:LAB_USERNAME) { $env:LAB_USERNAME } else { 'user' }
$Hostname = if ($env:LAB_HOSTNAME) { $env:LAB_HOSTNAME } else { 'lab-workstation' }
$TargetIp = $env:SGQ_TARGET_INTERNAL_IP
$Label = if ($env:SGQ_WORKSTATION_LABEL) { $env:SGQ_WORKSTATION_LABEL } else { 'Windows Terminal Workstation' }
$Distro = if ($env:SGQ_WORKSTATION_DISTRO) { $env:SGQ_WORKSTATION_DISTRO } else { 'Windows' }

try { Rename-Computer -NewName $Hostname -Force -ErrorAction SilentlyContinue } catch { }

$pwPlain = if ($env:LAB_PASSWORD) { $env:LAB_PASSWORD } elseif ($env:SGQ_PASSWORD) { $env:SGQ_PASSWORD } else { $null }
if (-not (Get-LocalUser -Name $Username -ErrorAction SilentlyContinue)) {
  if (-not $pwPlain) {
    Write-Error 'LAB_PASSWORD is required to create the lab workstation user.'
    exit 1
  }
  $securePassword = ConvertTo-SecureString $pwPlain -AsPlainText -Force
  New-LocalUser -Name $Username -Password $securePassword -FullName 'Lab User' -Description 'SysAdmin Game lab workstation account' | Out-Null
  Add-LocalGroupMember -Group 'Users' -Member $Username
}

$profileDir = "C:\Users\$Username"
if (-not (Test-Path $profileDir)) {
  New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
}

$sshDir = Join-Path $profileDir '.ssh'
New-Item -ItemType Directory -Force -Path $sshDir | Out-Null

$config = @"
Host lab-target
  HostName lab-target
  User $Username
  PreferredAuthentications password
  PubkeyAuthentication no
  StrictHostKeyChecking no
  UserKnownHostsFile NUL
"@

if ($TargetIp) {
  $config += @"

Host lab-target-ip
  HostName $TargetIp
  User $Username
  PreferredAuthentications password
  PubkeyAuthentication no
  StrictHostKeyChecking no
  UserKnownHostsFile NUL
"@
}

Set-Content -Path (Join-Path $sshDir 'config') -Value $config -Encoding ASCII

$motd = @"
SysAdmin Game — $Label
$Distro admin jump box on an isolated Docker network.
Connect to the lab target with SSH when you are ready (see the lab session panel).
"@

Set-Content -Path 'C:\ProgramData\sgq-motd.txt' -Value $motd -Encoding UTF8

Write-Host $motd

while ($true) {
  Start-Sleep -Seconds 3600
}
