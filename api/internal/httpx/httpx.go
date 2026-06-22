package httpx

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// WriteJSON writes body as JSON with the given status.
func WriteJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(body)
}

// WriteErr writes {"error": msg} with the given status.
func WriteErr(w http.ResponseWriter, code int, msg string) {
	WriteJSON(w, code, map[string]string{"error": msg})
}

// Decode reads the JSON request body into T; on failure it writes a 400 and
// reports false so the handler returns early.
func Decode[T any](w http.ResponseWriter, r *http.Request) (T, bool) {
	var in T
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		WriteErr(w, http.StatusBadRequest, "invalid JSON body")
		return in, false
	}
	return in, true
}

// PathID parses the {id} path value as a positive int64; on failure it writes a
// 400 and reports false.
func PathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id < 1 {
		WriteErr(w, http.StatusBadRequest, "invalid id")
		return 0, false
	}
	return id, true
}
