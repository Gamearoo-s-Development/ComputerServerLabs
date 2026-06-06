# Sandbox workstation for built-in lab terminal (SSH client to lab-target on private network)
FROM alpine:3.19
RUN apk add --no-cache openssh-client bash coreutils sed shadow netcat-openbsd
COPY entrypoint.sh /entrypoint.sh
# Strip Windows CRLF so the shebang works inside Linux containers.
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
