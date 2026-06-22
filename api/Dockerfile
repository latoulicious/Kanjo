# Static API binary — pgx and goose are pure Go, and the goose migrations are
# embedded (api/migrations/embed.go), so the runtime image needs only the binary.
FROM golang:1.26-alpine AS build
RUN apk add --no-cache ca-certificates
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/api ./cmd/api

# Minimal runtime: scratch + CA roots (for TLS to Postgres if ever enabled).
FROM scratch
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /out/api /api
EXPOSE 3000
USER 65534:65534
ENTRYPOINT ["/api"]
