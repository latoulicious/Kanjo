package syncer

import (
	"crypto/subtle"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/latoulicious/kanjo/api/internal/httpx"
	"github.com/latoulicious/kanjo/api/internal/store"
)

type Handler struct {
	svc   *Service
	log   *slog.Logger
	token string
}

func NewHandler(svc *Service, log *slog.Logger, token string) *Handler {
	return &Handler{svc: svc, log: log, token: token}
}

func (h *Handler) Mount(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/v1/sync", h.sync)
}

func (h *Handler) sync(w http.ResponseWriter, r *http.Request) {
	if !h.authorized(r) {
		httpx.WriteErr(w, http.StatusUnauthorized, "invalid sync token")
		return
	}
	in, ok := httpx.Decode[Request](w, r)
	if !ok {
		return
	}
	out, err := h.svc.Apply(r.Context(), in)
	if err != nil {
		switch classified := store.Classify(err); {
		case errors.Is(classified, store.ErrInUse):
			httpx.WriteErr(w, http.StatusConflict, "row still referenced on server")
		case isBadRef(err):
			httpx.WriteErr(w, http.StatusBadRequest, "pushed row references data unknown to this server — run Repair sync in the app")
		default:
			h.log.Error("sync failed", "error", err)
			httpx.WriteErr(w, http.StatusInternalServerError, "sync failed")
		}
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// isBadRef spots a NOT NULL violation (23502): a pushed row whose uuid refs
// resolved to nothing — the device is keyed to different data (e.g. old dump).
func isBadRef(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23502"
}

// authorized requires Bearer SYNC_TOKEN when configured; unset leaves the
// endpoint as open as the rest of the API (single-user deployment).
func (h *Handler) authorized(r *http.Request) bool {
	if h.token == "" {
		return true
	}
	scheme, got, ok := strings.Cut(r.Header.Get("Authorization"), " ")
	return ok && strings.EqualFold(scheme, "Bearer") &&
		subtle.ConstantTimeCompare([]byte(got), []byte(h.token)) == 1
}
