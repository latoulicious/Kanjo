package server

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/latoulicious/kanjo/api/internal/store"
)

// NewMux wires routes. /health stays at root, unversioned; business routes
// attach under /api/v1 (none yet).
func NewMux(st *store.Store, log *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", health(st, log))
	// /api/v1 routes attach here once they exist.
	return mux
}

// health pings the DB: up -> 200, down -> 503. Reports, never crashes.
func health(st *store.Store, log *slog.Logger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		status, code, db := "ok", http.StatusOK, "up"
		if err := st.Ping(r.Context()); err != nil {
			status, code, db = "degraded", http.StatusServiceUnavailable, "down"
			log.Warn("health: db unreachable", "error", err)
		}
		writeJSON(w, code, map[string]string{"status": status, "db": db})
	}
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}
