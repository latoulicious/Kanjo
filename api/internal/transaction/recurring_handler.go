package transaction

import (
	"net/http"

	"github.com/latoulicious/kanjo/api/internal/httpx"
)

func (h *Handler) listRecurring(w http.ResponseWriter, r *http.Request) {
	rules, err := h.svc.ListRecurring(r.Context())
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, rules)
}

func (h *Handler) createRecurring(w http.ResponseWriter, r *http.Request) {
	in, ok := httpx.Decode[RecurringInput](w, r)
	if !ok {
		return
	}
	rule, err := h.svc.CreateRecurring(r.Context(), in)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, rule)
}

func (h *Handler) getRecurring(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	rule, err := h.svc.GetRecurringRule(r.Context(), id)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, rule)
}

func (h *Handler) updateRecurring(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	in, ok := httpx.Decode[RecurringInput](w, r)
	if !ok {
		return
	}
	rule, err := h.svc.UpdateRecurring(r.Context(), id, in)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, rule)
}

func (h *Handler) deleteRecurring(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	if err := h.svc.DeleteRecurring(r.Context(), id); err != nil {
		h.fail(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// postRecurring logs the rule as a real transaction (returned as 201).
func (h *Handler) postRecurring(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.PathID(w, r)
	if !ok {
		return
	}
	t, err := h.svc.PostRecurring(r.Context(), id)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, t)
}
