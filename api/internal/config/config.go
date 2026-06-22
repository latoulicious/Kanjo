package config

import (
	"fmt"
	"strconv"
)

type Config struct {
	Port        string // HTTP listen port (PORT)
	DatabaseURL string // pgx DSN (DATABASE_URL); dialed lazily, not verified at boot
}

const defaultPort = "3000"

// Load reads config via getenv (stubbable in tests). DATABASE_URL is required.
func Load(getenv func(string) string) (*Config, error) {
	cfg := &Config{
		Port:        envOr(getenv, "PORT", defaultPort),
		DatabaseURL: getenv("DATABASE_URL"),
	}
	if _, err := strconv.Atoi(cfg.Port); err != nil {
		return nil, fmt.Errorf("PORT %q: must be a port number", cfg.Port)
	}
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL: required")
	}
	return cfg, nil
}

func envOr(getenv func(string) string, key, def string) string {
	if v := getenv(key); v != "" {
		return v
	}
	return def
}
