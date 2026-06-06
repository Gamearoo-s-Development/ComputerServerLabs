# Kali lab workstation — security simulation jump box.
FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive

ARG SGQ_LAB_ENTRYPOINT_VERSION=2026-05-28-kali-terminal
ENV SGQ_WORKSTATION_DISTRO="Kali Linux"
ENV SGQ_WORKSTATION_LABEL="Kali Terminal Workstation"
ENV SGQ_WORKSTATION_SHELL=/bin/bash

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
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

COPY kali-workstation/entrypoint.sh /entrypoint.sh
COPY _common/configure-workstation-login.sh /usr/local/bin/configure-workstation-login.sh
COPY _common/sgq-tty-login.sh /usr/local/bin/sgq-tty-login.sh
RUN sed -i 's/\r$//' /entrypoint.sh /usr/local/bin/configure-workstation-login.sh /usr/local/bin/sgq-tty-login.sh \
  && chmod +x /entrypoint.sh /usr/local/bin/configure-workstation-login.sh /usr/local/bin/sgq-tty-login.sh

LABEL sgq.lab.entrypoint.version="${SGQ_LAB_ENTRYPOINT_VERSION}"
LABEL sgq.workstation.profile="kali-terminal"

ENTRYPOINT ["/entrypoint.sh"]
