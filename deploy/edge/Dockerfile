# Build the current stable Caddy release ourselves so the edge binary is produced
# with the same patched Go toolchain used by the API and with security-fixed
# transitive modules. The upstream v2.11.4 image was published before these fixes.
FROM golang:1.26.7-alpine AS build
RUN apk add --no-cache git ca-certificates
WORKDIR /src
RUN git clone --depth 1 --branch v2.11.4 https://github.com/caddyserver/caddy.git . \
    && go get golang.org/x/crypto@v0.55.0 \
              google.golang.org/grpc@v1.83.1 \
    && go mod verify \
    && CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/caddy ./cmd/caddy

# Do not inherit the upstream Caddy binary: Trivy must inspect only the binary we
# just built. High ports mean no file capabilities or root privileges are needed.
FROM alpine:3.24
RUN apk upgrade --no-cache \
    && apk add --no-cache ca-certificates \
    && addgroup -S -g 65532 caddy \
    && adduser -S -D -H -u 65532 -G caddy caddy \
    && mkdir -p /data /config /etc/caddy \
    && chown -R 65532:65532 /data /config
# HOME stays ephemeral, while Caddy's durable certificate and config state is
# explicitly redirected into the writable/persistent paths mounted by production.
ENV HOME=/tmp \
    XDG_DATA_HOME=/data \
    XDG_CONFIG_HOME=/config
COPY --from=build --chown=65532:65532 /out/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
USER 65532:65532
EXPOSE 8080 8443
ENTRYPOINT ["/usr/bin/caddy"]
CMD ["run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
