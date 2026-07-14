package server

import (
	"log/slog"
	"net/http"

	"github.com/latoulicious/kanjo/api/internal/account"
	"github.com/latoulicious/kanjo/api/internal/category"
	"github.com/latoulicious/kanjo/api/internal/httpx"
	"github.com/latoulicious/kanjo/api/internal/project"
	"github.com/latoulicious/kanjo/api/internal/report"
	"github.com/latoulicious/kanjo/api/internal/store"
	"github.com/latoulicious/kanjo/api/internal/syncer"
	"github.com/latoulicious/kanjo/api/internal/transaction"
)

// NewMux wires routes. /health stays at root, unversioned; business modules
// mount their own /api/v1 routes.
func NewMux(st *store.Store, log *slog.Logger, syncToken string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", health(st, log))
	account.NewHandler(account.NewService(st), log).Mount(mux)
	category.NewHandler(category.NewService(st), log).Mount(mux)
	project.NewHandler(project.NewService(st), log).Mount(mux)
	transaction.NewHandler(transaction.NewService(st), log).Mount(mux)
	report.NewHandler(report.NewService(st), log).Mount(mux)
	syncer.NewHandler(syncer.NewService(st), log, syncToken).Mount(mux)
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
		httpx.WriteJSON(w, code, map[string]string{"status": status, "db": db})
	}
}
