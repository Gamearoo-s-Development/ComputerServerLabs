# Alpine lab workstation — minimal advanced profile.
FROM alpine:3.19

ARG SGQ_LAB_ENTRYPOINT_VERSION=2026-05-27-ws-profiles
ENV SGQ_WORKSTATION_DISTRO="Alpine 3.19"
ENV SGQ_WORKSTATION_LABEL="Alpine Workstation"
ENV SGQ_WORKSTATION_SHELL=/bin/bash

RUN apk add --no-cache \
    bash \
    openssh-client \
    sshpass \
    iputils \
    curl \
    wget \
    nano \
    vim \
    less \
    grep \
    findutils \
    iproute2 \
    net-tools \
    netcat-openbsd \
    bind-tools \
    procps \
    sudo \
    shadow \
    login \
    ca-certificates

COPY alpine-workstation/entrypoint.sh /entrypoint.sh
COPY _common/configure-workstation-login.sh /usr/local/bin/configure-workstation-login.sh
COPY _common/sgq-tty-login.sh /usr/local/bin/sgq-tty-login.sh
RUN sed -i 's/\r$//' /entrypoint.sh /usr/local/bin/configure-workstation-login.sh /usr/local/bin/sgq-tty-login.sh \
  && chmod +x /entrypoint.sh /usr/local/bin/configure-workstation-login.sh /usr/local/bin/sgq-tty-login.sh

LABEL sgq.lab.entrypoint.version="${SGQ_LAB_ENTRYPOINT_VERSION}"
LABEL sgq.workstation.profile="alpine-workstation"

ENTRYPOINT ["/entrypoint.sh"]
