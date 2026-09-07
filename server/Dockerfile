# syntax=docker/dockerfile:1
FROM golang:1.26.5-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download && go mod verify
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/fintrack .

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build --chown=65532:65532 /out/fintrack /app/fintrack
USER 65532:65532
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 CMD ["/app/fintrack", "healthcheck"]
ENTRYPOINT ["/app/fintrack"]
