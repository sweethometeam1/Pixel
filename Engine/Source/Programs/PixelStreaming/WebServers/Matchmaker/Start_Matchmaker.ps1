# Copyright 1998-2018 Epic Games, Inc. All Rights Reserved.

# $PublicIp = Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/public-ipv4"
$PublicIp = (Invoke-WebRequest -uri "http://ifconfig.me/ip").Content
$LocalIp = (Get-NetIPAddress -SuffixOrigin Dhcp).IPAddress

Write-Output "Public IP: $PublicIp"
Write-Output "Local IP: $LocalIp"

$ProcessExe = "node.exe"
$Arguments = @("matchmaker", "--publicIp=$PublicIp", "--localIp=$LocalIp")
# Add arguments passed to script to Arguments for executable
$Arguments += $args

Write-Output "Running: $ProcessExe $Arguments"
Start-Process -FilePath $ProcessExe -ArgumentList $Arguments -Wait -NoNewWindow
