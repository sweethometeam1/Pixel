:: Copyright 1998-2019 Epic Games, Inc. All Rights Reserved.
@echo off

pushd %~dp0

::call setup.bat

title Cirrus

::Run node server
::If running with matchmaker web server and accessing outside of localhost pass in --publicIp=<ip_of_machine>

Powershell.exe -executionpolicy unrestricted -File Start_AWS_WithTURN_SignallingServer.ps1 --httpPort=%1 --streamerPort=%2

popd
::pause
exit