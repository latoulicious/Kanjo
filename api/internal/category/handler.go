package category

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

// Mount registers the categories CRUD routes under /api/v1.
func (h *Handler) Mount(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/categories", h.list)
	mux.HandleFunc("POST /api/v1/categories", h.create)
	mux.HandleFunc("GET /api/v1/categories/{id}", h.get)
	mux.HandleFunc("PUT /api/v1/categories/{id}", h.update)
	mux.HandleFunc("DELETE /api/v1/categories/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	categories, err := h.svc.List(r.Context())
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, categories)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	in, ok := httpx.Decode[Input](w, r)
	if !ok {
		return
	}
	c, err := h.svc.Create(r.Context(), in)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, c)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	c, err := h.svc.Get(r.Context(), id)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, c)
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
	c, err := h.svc.Update(r.Context(), id, in)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, c)
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

// fail maps service/store outcomes to HTTP; unknown errors log and 500. No
// ErrInUse case: category deletes are ON DELETE SET NULL, never restricted.
func (h *Handler) fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrEmptyName), errors.Is(err, ErrNameTooLong):
		httpx.WriteErr(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, store.ErrNotFound):
		httpx.WriteErr(w, http.StatusNotFound, "category not found")
	case errors.Is(err, store.ErrConflict):
		httpx.WriteErr(w, http.StatusConflict, "category name already exists")
	default:
		h.log.Error("categories: unexpected error", "error", err)
		httpx.WriteErr(w, http.StatusInternalServerError, "internal error")
	}
}
