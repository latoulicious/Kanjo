package transaction

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/latoulicious/kanjo/api/internal/httpx"
	"github.com/latoulicious/kanjo/api/internal/store"
)

type Handler struct {
	svc *Service
	log *slog.Logger
}

func NewHandler(svc *Service, log *slog.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

// Mount registers the transactions CRUD routes under /api/v1.
func (h *Handler) Mount(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/transactions", h.list)
	mux.HandleFunc("POST /api/v1/transactions", h.create)
	mux.HandleFunc("GET /api/v1/transactions/{id}", h.get)
	mux.HandleFunc("PUT /api/v1/transactions/{id}", h.update)
	mux.HandleFunc("DELETE /api/v1/transactions/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	f, ok := parseFilter(w, r)
	if !ok {
		return
	}
	txs, err := h.svc.List(r.Context(), f)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, txs)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	in, ok := httpx.Decode[Input](w, r)
	if !ok {
		return
	}
	t, err := h.svc.Create(r.Context(), in)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, t)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	t, err := h.svc.Get(r.Context(), id)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, t)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	in, ok := httpx.Decode[Input](w, r)
	if !ok {
		return
	}
	t, err := h.svc.Update(r.Context(), id, in)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, t)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		h.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// parseFilter reads the optional list query params; an empty param disables that
// filter. Date strings are validated in the service (parsed to pgtype.Date).
func parseFilter(w http.ResponseWriter, r *http.Request) (Filter, bool) {
	q := r.URL.Query()
	var f Filter
	if v := q.Get("from"); v != "" {
		f.From = &v
	}
	if v := q.Get("to"); v != "" {
		f.To = &v
	}
	var ok bool
	if f.AccountID, ok = optID(w, q.Get("account_id")); !ok {
		return f, false
	}
	if f.CategoryID, ok = optID(w, q.Get("category_id")); !ok {
		return f, false
	}
	if f.ProjectID, ok = optID(w, q.Get("project_id")); !ok {
		return f, false
	}
	return f, true
}

// optID parses an optional positive int64 filter; empty → nil (absent), bad → 400.
func optID(w http.ResponseWriter, s string) (*int64, bool) {
	if s == "" {
		return nil, true
	}
	id, err := strconv.ParseInt(s, 10, 64)
	if err != nil || id < 1 {
		httpx.WriteErr(w, http.StatusBadRequest, "invalid id filter")
		return nil, false
	}
	return &id, true
}

// fail maps service/store outcomes to HTTP. Bad references (FK pre-validation)
// are 400, not 409 — there is no in-use path for a single ledger row.
func (h *Handler) fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrBadDate), errors.Is(err, ErrBadDirection),
		errors.Is(err, ErrDescTooLong), errors.Is(err, ErrAccountRequired),
		errors.Is(err, ErrAmountRequired), errors.Is(err, ErrAmountInvalid),
		errors.Is(err, ErrAccountNotFound), errors.Is(err, ErrCategoryNotFound),
		errors.Is(err, ErrProjectNotFound):
		httpx.WriteErr(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, store.ErrNotFound):
		httpx.WriteErr(w, http.StatusNotFound, "transaction not found")
	default:
		h.log.Error("transactions: unexpected error", "error", err)
		httpx.WriteErr(w, http.StatusInternalServerError, "internal error")
	}
}
