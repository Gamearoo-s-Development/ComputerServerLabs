# escape=`
# Isolated Windows Terminal Workstation — PowerShell jump box (not the host shell).
FROM mcr.microsoft.com/windows/servercore:ltsc2022-amd64

SHELL ["powershell", "-NoLogo", "-NoProfile", "-Command"]

ARG SGQ_LAB_ENTRYPOINT_VERSION=2026-05-27-windows-terminal
ENV SGQ_LAB_ENTRYPOINT_VERSION=$SGQ_LAB_ENTRYPOINT_VERSION
ENV SGQ_WORKSTATION_DISTRO="Windows Server LTSC 2022"
ENV SGQ_WORKSTATION_LABEL="Windows Terminal Workstation"
ENV SGQ_WORKSTATION_SHELL=powershell.exe

RUN $ErrorActionPreference = 'Stop'; `
    New-Item -ItemType Directory -Force -Path C:\Tools | Out-Null; `
    Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0; `
    Invoke-WebRequest -Uri 'https://the.earth.li/~sgtatham/putty/latest/w64/plink.exe' -OutFile 'C:\Tools\plink.exe'; `
    Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine -Force

COPY windows-terminal-workstation/entrypoint.ps1 C:\entrypoint.ps1

LABEL sgq.lab.entrypoint.version="${SGQ_LAB_ENTRYPOINT_VERSION}"
LABEL sgq.workstation.profile="windows-terminal"

ENTRYPOINT ["powershell.exe", "-NoLogo", "-NoProfile", "-File", "C:\\entrypoint.ps1"]
