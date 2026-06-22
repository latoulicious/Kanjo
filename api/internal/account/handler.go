package account

import (
	"errors"
	"log/slog"
	"net/http"

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

// Mount registers the accounts CRUD routes under /api/v1.
func (h *Handler) Mount(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/accounts", h.list)
	mux.HandleFunc("POST /api/v1/accounts", h.create)
	mux.HandleFunc("GET /api/v1/accounts/{id}", h.get)
	mux.HandleFunc("PUT /api/v1/accounts/{id}", h.update)
	mux.HandleFunc("DELETE /api/v1/accounts/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	accounts, err := h.svc.List(r.Context())
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, accounts)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	in, ok := httpx.Decode[Input](w, r)
	if !ok {
		return
	}
	a, err := h.svc.Create(r.Context(), in)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, a)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	a, err := h.svc.Get(r.Context(), id)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, a)
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
	a, err := h.svc.Update(r.Context(), id, in)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, a)
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

// fail maps service/store outcomes to HTTP; unknown errors log and 500.
func (h *Handler) fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrEmptyName), errors.Is(err, ErrNameTooLong):
		httpx.WriteErr(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, store.ErrNotFound):
		httpx.WriteErr(w, http.StatusNotFound, "account not found")
	case errors.Is(err, store.ErrConflict):
		httpx.WriteErr(w, http.StatusConflict, "account name already exists")
	case errors.Is(err, store.ErrInUse):
		httpx.WriteErr(w, http.StatusConflict, "account has transactions and cannot be deleted")
	default:
		h.log.Error("accounts: unexpected error", "error", err)
		httpx.WriteErr(w, http.StatusInternalServerError, "internal error")
	}
}
