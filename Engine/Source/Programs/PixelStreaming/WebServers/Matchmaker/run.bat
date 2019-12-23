:: Copyright 1998-2019 Epic Games, Inc. All Rights Reserved.
@echo off

pushd %~dp0

REM call setup.bat

title Matchmaker

::Run node server

Powershell.exe -executionpolicy unrestricted -File Start_Matchmaker.ps1
REM node matchmaker --httpPort 80 %*

popd
pause