FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

ARG SGQ_LAB_ENTRYPOINT_VERSION=2026-05-27-ssh-login-fix

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssh-server sudo netcat-openbsd \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /run/sshd /var/run/sshd /opt/training-agent /var/log

COPY service-repair-001/run.sh /opt/training-agent/run.sh
RUN chmod 755 /opt/training-agent/run.sh

RUN printf '%s\n' \
  '[Unit]' \
  'Description=Training Agent (SysAdmin Game Lab)' \
  'After=network.target' \
  '' \
  '[Service]' \
  'Type=simple' \
  'ExecStart=/opt/training-agent/broken-start.sh' \
  'Restart=on-failure' \
  '' \
  '[Install]' \
  'WantedBy=multi-user.target' \
  > /etc/systemd/system/training-agent.service

COPY service-repair-001/training-systemctl.sh /usr/local/bin/systemctl
RUN chmod 755 /usr/local/bin/systemctl \
  && ln -sf /usr/local/bin/systemctl /usr/bin/systemctl

COPY common/apply-lab-credentials.sh /usr/local/bin/apply-lab-credentials.sh
COPY common/configure-lab-ssh-access.sh /usr/local/bin/configure-lab-ssh-access.sh
COPY common/start-lab-sshd.sh /usr/local/bin/start-lab-sshd.sh
COPY common/sgq-entrypoint.sh /usr/local/bin/sgq-entrypoint.sh
COPY service-repair-001/lab-setup.sh /usr/local/bin/lab-setup.sh

RUN sed -i 's/\r$//' /usr/local/bin/apply-lab-credentials.sh /usr/local/bin/configure-lab-ssh-access.sh /usr/local/bin/start-lab-sshd.sh /usr/local/bin/sgq-entrypoint.sh /usr/local/bin/lab-setup.sh \
  && chmod +x /usr/local/bin/start-lab-sshd.sh /usr/local/bin/sgq-entrypoint.sh /usr/local/bin/lab-setup.sh

LABEL sgq.lab.entrypoint.version="${SGQ_LAB_ENTRYPOINT_VERSION}"

EXPOSE 22
ENTRYPOINT ["/usr/local/bin/sgq-entrypoint.sh"]
