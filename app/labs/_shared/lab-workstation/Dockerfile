# Isolated Linux admin jump box for the built-in Lab Terminal (not the lab target).
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

ARG SGQ_LAB_ENTRYPOINT_VERSION=2026-05-27-ssh-login-fix

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    openssh-client \
    sshpass \
    openssh-sftp-server \
    iputils-ping \
    curl \
    wget \
    nano \
    vim-tiny \
    less \
    grep \
    findutils \
    iproute2 \
    netcat-openbsd \
    dnsutils \
    procps \
    sudo \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && ln -sf /usr/bin/vim.tiny /usr/bin/vim 2>/dev/null || true

COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

LABEL sgq.lab.entrypoint.version="${SGQ_LAB_ENTRYPOINT_VERSION}"

ENTRYPOINT ["/entrypoint.sh"]
