FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

ARG SGQ_LAB_ENTRYPOINT_VERSION=2026-05-27-ssh-login-fix

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssh-server netcat-openbsd \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /run/sshd /var/run/sshd /var/log/staging /opt/lab

RUN dd if=/dev/zero of=/var/log/staging/large.log bs=1M count=48 status=none \
  && dd if=/dev/zero of=/var/log/staging/archive-a.log bs=1M count=24 status=none \
  && dd if=/dev/zero of=/var/log/staging/archive-b.log bs=1M count=24 status=none \
  && dd if=/dev/zero of=/var/log/staging/backup-old.log bs=1M count=16 status=none

COPY disk-cleanup-001/verify-cleanup.sh /opt/lab/verify-cleanup
RUN chmod 755 /opt/lab/verify-cleanup

COPY common/apply-lab-credentials.sh /usr/local/bin/apply-lab-credentials.sh
COPY common/configure-lab-ssh-access.sh /usr/local/bin/configure-lab-ssh-access.sh
COPY common/start-lab-sshd.sh /usr/local/bin/start-lab-sshd.sh
COPY common/sgq-entrypoint.sh /usr/local/bin/sgq-entrypoint.sh
COPY disk-cleanup-001/lab-setup.sh /usr/local/bin/lab-setup.sh

RUN sed -i 's/\r$//' /usr/local/bin/apply-lab-credentials.sh /usr/local/bin/configure-lab-ssh-access.sh /usr/local/bin/start-lab-sshd.sh /usr/local/bin/sgq-entrypoint.sh /usr/local/bin/lab-setup.sh \
  && chmod +x /usr/local/bin/start-lab-sshd.sh /usr/local/bin/sgq-entrypoint.sh /usr/local/bin/lab-setup.sh

LABEL sgq.lab.entrypoint.version="${SGQ_LAB_ENTRYPOINT_VERSION}"

EXPOSE 22
ENTRYPOINT ["/usr/local/bin/sgq-entrypoint.sh"]
