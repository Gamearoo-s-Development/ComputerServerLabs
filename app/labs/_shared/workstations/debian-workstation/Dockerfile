# Debian lab workstation.
FROM debian:12-slim

ENV DEBIAN_FRONTEND=noninteractive

ARG SGQ_LAB_ENTRYPOINT_VERSION=2026-05-27-ws-profiles
ENV SGQ_WORKSTATION_DISTRO="Debian 12"
ENV SGQ_WORKSTATION_LABEL="Debian Workstation"
ENV SGQ_WORKSTATION_SHELL=/bin/bash

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    openssh-client \
    sshpass \
    iputils-ping \
    curl \
    wget \
    nano \
    vim-tiny \
    less \
    grep \
    findutils \
    iproute2 \
    net-tools \
    netcat-openbsd \
    dnsutils \
    procps \
    sudo \
    login \
    passwd \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && ln -sf /usr/bin/vim.tiny /usr/bin/vim 2>/dev/null || true

COPY debian-workstation/entrypoint.sh /entrypoint.sh
COPY _common/configure-workstation-login.sh /usr/local/bin/configure-workstation-login.sh
COPY _common/sgq-tty-login.sh /usr/local/bin/sgq-tty-login.sh
RUN sed -i 's/\r$//' /entrypoint.sh /usr/local/bin/configure-workstation-login.sh /usr/local/bin/sgq-tty-login.sh \
  && chmod +x /entrypoint.sh /usr/local/bin/configure-workstation-login.sh /usr/local/bin/sgq-tty-login.sh

LABEL sgq.lab.entrypoint.version="${SGQ_LAB_ENTRYPOINT_VERSION}"
LABEL sgq.workstation.profile="debian-terminal"

ENTRYPOINT ["/entrypoint.sh"]
