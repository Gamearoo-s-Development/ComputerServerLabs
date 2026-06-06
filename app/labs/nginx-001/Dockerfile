FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

ARG SGQ_LAB_ENTRYPOINT_VERSION=2026-05-27-ssh-login-fix

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssh-server nginx sudo curl netcat-openbsd \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /run/sshd /var/run/sshd

RUN rm -f /etc/nginx/sites-enabled/default \
  && printf '%s\n' \
  'server {' \
  '    listen 80;' \
  '    location / {' \
  '        default_type text/plain;' \
  '        return 200 "SysAdmin Game NGINX lab OK\n";' \
  '    }' \
  '}' \
  > /etc/nginx/sites-available/training.conf \
  && ln -sf /etc/nginx/sites-available/training.conf /etc/nginx/sites-enabled/training.conf

COPY common/apply-lab-credentials.sh /usr/local/bin/apply-lab-credentials.sh
COPY common/configure-lab-ssh-access.sh /usr/local/bin/configure-lab-ssh-access.sh
COPY common/start-lab-sshd.sh /usr/local/bin/start-lab-sshd.sh
COPY common/sgq-entrypoint.sh /usr/local/bin/sgq-entrypoint.sh
COPY nginx-001/lab-setup.sh /usr/local/bin/lab-setup.sh

RUN sed -i 's/\r$//' /usr/local/bin/apply-lab-credentials.sh /usr/local/bin/configure-lab-ssh-access.sh /usr/local/bin/start-lab-sshd.sh /usr/local/bin/sgq-entrypoint.sh /usr/local/bin/lab-setup.sh \
  && chmod +x /usr/local/bin/start-lab-sshd.sh /usr/local/bin/sgq-entrypoint.sh /usr/local/bin/lab-setup.sh

LABEL sgq.lab.entrypoint.version="${SGQ_LAB_ENTRYPOINT_VERSION}"

EXPOSE 22 80
ENTRYPOINT ["/usr/local/bin/sgq-entrypoint.sh"]
