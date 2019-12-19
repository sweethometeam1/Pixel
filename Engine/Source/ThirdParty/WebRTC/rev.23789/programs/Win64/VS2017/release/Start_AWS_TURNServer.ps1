function AddUser{
    param(
    $realm,
    $user, 
    $pass,
    $auth_file,
    [switch]$append)

    $md5 = new-object -TypeName System.Security.Cryptography.MD5CryptoServiceProvider
    $utf8 = new-object -TypeName System.Text.UTF8Encoding
    $hash = [System.BitConverter]::ToString($md5.ComputeHash($utf8.GetBytes("$user" + ":$realm" + ":$pass")))
    $hash = $hash.ToLower() -replace '-', ''

    if($append){
        "$user=$hash" | Out-File -FilePath $auth_file -Append -Encoding ascii
    } else {
        "$user=$hash" | Out-File -FilePath $auth_file -Encoding ascii
    }

}

$LocalIp = Invoke-WebRequest -Uri "http://169.254.169.254/latest/meta-data/local-ipv4"
Write-Output "Private IP: $LocalIp"


$AuthFile = "turnserver_auth.txt"
$Realm = "PixelStreaming"
$ProcessExe = ".\turnserver.exe"
$Arguments = "0.0.0.0:19303 $LocalIp $Realm $AuthFile"

$TurnUsername = "PixelStreamingUser"
$TurnPassword = "Another TURN in the road"

AddUser $Realm $TurnUsername $TurnPassword $AuthFile


Write-Output "Running: $ProcessExe $Arguments"
Start-Process -FilePath $ProcessExe -ArgumentList $Arguments
