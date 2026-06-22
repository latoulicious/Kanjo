package transaction

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/latoulicious/kanjo/api/internal/httpx"
	"github.com/latoulicious/kanjo/api/internal/store"
)

func (h *Handler) createTransfer(w http.ResponseWriter, r *http.Request) {
	in, ok := httpx.Decode[TransferInput](w, r)
	if !ok {
		return
	}
	res, err := h.svc.CreateTransfer(r.Context(), in)
	if err != nil {
		h.failTransfer(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, res)
}

func (h *Handler) getTransfer(w http.ResponseWriter, r *http.Request) {
	group, ok := parseGroupID(w, r)
	if !ok {
		return
	}
	res, err := h.svc.GetTransfer(r.Context(), group)
	if err != nil {
		h.failTransfer(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, res)
}

func (h *Handler) deleteTransfer(w http.ResponseWriter, r *http.Request) {
	group, ok := parseGroupID(w, r)
	if !ok {
		return
	}
	if err := h.svc.DeleteTransfer(r.Context(), group); err != nil {
		h.failTransfer(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// parseGroupID parses the {group_id} path value as a UUID; bad input → 400.
func parseGroupID(w http.ResponseWriter, r *http.Request) (pgtype.UUID, bool) {
	var u pgtype.UUID
	if err := u.Scan(r.PathValue("group_id")); err != nil || !u.Valid {
		httpx.WriteErr(w, http.StatusBadRequest, "invalid transfer group id")
		return pgtype.UUID{}, false
	}
	return u, true
}

// failTransfer maps a missing group to "transfer not found"; everything else
// shares the single-entry mapping (validation → 400, unexpected → 500).
func (h *Handler) failTransfer(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrNotFound) {
		httpx.WriteErr(w, http.StatusNotFound, "transfer not found")
		return
	}
	h.fail(w, err)
}
