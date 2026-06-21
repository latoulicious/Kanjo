package category

import (
	"context"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/latoulicious/kanjo/api/internal/store"
	"github.com/latoulicious/kanjo/api/internal/store/db"
)

const maxNameLen = 100

var (
	ErrEmptyName   = errors.New("name is required")
	ErrNameTooLong = errors.New("name exceeds 100 characters")
)

// Category is the wire shape, decoupled from the generated db row so the public
// contract is not hostage to schema or sqlc changes.
type Category struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// Input is the create/update body.
type Input struct {
	Name string `json:"name"`
}

type Service struct {
	st *store.Store
}

func NewService(st *store.Store) *Service {
	return &Service{st: st}
}

func (s *Service) List(ctx context.Context) ([]Category, error) {
	rows, err := s.st.ListCategories(ctx)
	if err != nil {
		return nil, store.Classify(err)
	}
	out := make([]Category, len(rows))
	for i, r := range rows {
		out[i] = toCategory(r)
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Category, error) {
	r, err := s.st.GetCategory(ctx, id)
	if err != nil {
		return Category{}, store.Classify(err)
	}
	return toCategory(r), nil
}

func (s *Service) Create(ctx context.Context, in Input) (Category, error) {
	name, err := cleanName(in.Name)
	if err != nil {
		return Category{}, err
	}
	r, err := s.st.CreateCategory(ctx, name)
	if err != nil {
		return Category{}, store.Classify(err)
	}
	return toCategory(r), nil
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Category, error) {
	name, err := cleanName(in.Name)
	if err != nil {
		return Category{}, err
	}
	r, err := s.st.UpdateCategory(ctx, db.UpdateCategoryParams{
		ID:   id,
		Name: name,
	})
	if err != nil {
		return Category{}, store.Classify(err)
	}
	return toCategory(r), nil
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	n, err := s.st.DeleteCategory(ctx, id)
	if err != nil {
		return store.Classify(err)
	}
	if n == 0 {
		return store.ErrNotFound
	}
	return nil
}

func toCategory(r db.Category) Category {
	return Category{
		ID:        r.ID,
		Name:      r.Name,
		CreatedAt: r.CreatedAt.Time,
	}
}

func cleanName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", ErrEmptyName
	}
	if utf8.RuneCountInString(name) > maxNameLen {
		return "", ErrNameTooLong
	}
	return name, nil
}
