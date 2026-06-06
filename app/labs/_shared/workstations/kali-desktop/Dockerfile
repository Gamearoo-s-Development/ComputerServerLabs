# Kali desktop workstation — XFCE + noVNC on port 3000 (same base as kali-terminal).
FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive

ARG SGQ_LAB_ENTRYPOINT_VERSION=2026-06-01-kali-desktop
ENV SGQ_WORKSTATION_DISTRO="Kali Linux"
ENV SGQ_WORKSTATION_LABEL="Kali Desktop Workstation"
ENV SGQ_WORKSTATION_SHELL=/bin/bash

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    dbus-x11 \
    xfce4 \
    xfce4-terminal \
    tigervnc-standalone-server \
    novnc \
    websockify \
    openssh-client \
    sshpass \
    openssh-sftp-server \
    iputils-ping \
    curl \
    wget \
    nmap \
    netcat-openbsd \
    dnsutils \
    iproute2 \
    net-tools \
    procps \
    sudo \
    login \
    passwd \
    ca-certificates \
    grep \
    findutils \
    less \
  && rm -rf /var/lib/apt/lists/*

COPY kali-desktop/entrypoint.sh /entrypoint.sh
COPY _common/configure-workstation-login.sh /usr/local/bin/configure-workstation-login.sh
COPY _common/sgq-tty-login.sh /usr/local/bin/sgq-tty-login.sh
RUN sed -i 's/\r$//' /entrypoint.sh /usr/local/bin/configure-workstation-login.sh /usr/local/bin/sgq-tty-login.sh \
  && chmod +x /entrypoint.sh /usr/local/bin/configure-workstation-login.sh /usr/local/bin/sgq-tty-login.sh

EXPOSE 3000

LABEL sgq.lab.entrypoint.version="${SGQ_LAB_ENTRYPOINT_VERSION}"
LABEL sgq.workstation.profile="desktop-container-kali"
LABEL org.opencontainers.image.source="https://www.kali.org/"
LABEL org.opencontainers.image.base.name="kalilinux/kali-rolling"

ENTRYPOINT ["/entrypoint.sh"]
