FROM caddy:2-alpine
USER root
# The upstream binary requests privileged-port capabilities. We use high ports
# and drop ALL runtime capabilities, so remove its file capabilities at build time.
RUN apk upgrade --no-cache \
    && apk add --no-cache --virtual .cap-tools libcap-utils \
    && setcap -r /usr/bin/caddy \
    && test -z "$(getcap /usr/bin/caddy)" \
    && apk del .cap-tools \
    && mkdir -p /data /config && chown -R 65532:65532 /data /config
ENV HOME=/tmp
COPY Caddyfile /etc/caddy/Caddyfile
USER 65532:65532
EXPOSE 8080 8443
