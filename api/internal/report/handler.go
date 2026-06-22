package report

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/latoulicious/kanjo/api/internal/httpx"
)

type Handler struct {
	svc *Service
	log *slog.Logger
}

func NewHandler(svc *Service, log *slog.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

// Mount registers the read-only report routes under /api/v1.
func (h *Handler) Mount(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/reports/summary", h.summary)
	mux.HandleFunc("GET /api/v1/reports/cash-flow", h.cashFlow)
	mux.HandleFunc("GET /api/v1/reports/categories", h.categories)
	mux.HandleFunc("GET /api/v1/reports/projects", h.projects)
	mux.HandleFunc("GET /api/v1/reports/balance-trend", h.balanceTrend)
}

func (h *Handler) summary(w http.ResponseWriter, r *http.Request) {
	from, to := dateRange(r)
	out, err := h.svc.Summary(r.Context(), from, to)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) cashFlow(w http.ResponseWriter, r *http.Request) {
	from, to := dateRange(r)
	out, err := h.svc.CashFlow(r.Context(), from, to, r.URL.Query().Get("interval"))
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) categories(w http.ResponseWriter, r *http.Request) {
	from, to := dateRange(r)
	out, err := h.svc.Categories(r.Context(), from, to)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) projects(w http.ResponseWriter, r *http.Request) {
	from, to := dateRange(r)
	out, err := h.svc.Projects(r.Context(), from, to)
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) balanceTrend(w http.ResponseWriter, r *http.Request) {
	_, to := dateRange(r)
	out, err := h.svc.BalanceTrend(r.Context(), to, r.URL.Query().Get("interval"))
	if err != nil {
		h.fail(w, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// dateRange reads the optional from/to query params; an empty param is nil
// (filter disabled / default applied in the service).
func dateRange(r *http.Request) (*string, *string) {
	q := r.URL.Query()
	return optStr(q.Get("from")), optStr(q.Get("to"))
}

func optStr(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

// fail maps service outcomes to HTTP. Reports are read-only aggregations, so the
// only failures are bad query input (400) or an unexpected store error (500).
func (h *Handler) fail(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrBadDate), errors.Is(err, ErrBadInterval):
		httpx.WriteErr(w, http.StatusBadRequest, err.Error())
	default:
		h.log.Error("reports: unexpected error", "error", err)
		httpx.WriteErr(w, http.StatusInternalServerError, "internal error")
	}
}
