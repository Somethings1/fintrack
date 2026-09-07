FROM caddy:2-alpine
USER root
RUN apk upgrade --no-cache && mkdir -p /data /config && chown -R 65532:65532 /data /config
ENV HOME=/tmp
COPY Caddyfile /etc/caddy/Caddyfile
USER 65532:65532
EXPOSE 8080 8443
