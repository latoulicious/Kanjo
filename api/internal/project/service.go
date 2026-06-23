package project

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

// Project is the wire shape, decoupled from the generated db row so the public
// contract is not hostage to schema or sqlc changes.
type Project struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Icon      string    `json:"icon"`
	CreatedAt time.Time `json:"created_at"`
}

// Input is the create/update body. Icon is a lucide icon name (kebab-case),
// optional ("" = none).
type Input struct {
	Name string `json:"name"`
	Icon string `json:"icon"`
}

type Service struct {
	st *store.Store
}

func NewService(st *store.Store) *Service {
	return &Service{st: st}
}

func (s *Service) List(ctx context.Context) ([]Project, error) {
	rows, err := s.st.ListProjects(ctx)
	if err != nil {
		return nil, store.Classify(err)
	}
	out := make([]Project, len(rows))
	for i, r := range rows {
		out[i] = toProject(r)
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Project, error) {
	r, err := s.st.GetProject(ctx, id)
	if err != nil {
		return Project{}, store.Classify(err)
	}
	return toProject(r), nil
}

func (s *Service) Create(ctx context.Context, in Input) (Project, error) {
	name, err := cleanName(in.Name)
	if err != nil {
		return Project{}, err
	}
	r, err := s.st.CreateProject(ctx, db.CreateProjectParams{
		Name: name,
		Icon: store.CleanIcon(in.Icon),
	})
	if err != nil {
		return Project{}, store.Classify(err)
	}
	return toProject(r), nil
}

func (s *Service) Update(ctx context.Context, id int64, in Input) (Project, error) {
	name, err := cleanName(in.Name)
	if err != nil {
		return Project{}, err
	}
	r, err := s.st.UpdateProject(ctx, db.UpdateProjectParams{
		ID:   id,
		Name: name,
		Icon: store.CleanIcon(in.Icon),
	})
	if err != nil {
		return Project{}, store.Classify(err)
	}
	return toProject(r), nil
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	n, err := s.st.DeleteProject(ctx, id)
	if err != nil {
		return store.Classify(err)
	}
	if n == 0 {
		return store.ErrNotFound
	}
	return nil
}

func toProject(r db.Project) Project {
	return Project{
		ID:        r.ID,
		Name:      r.Name,
		Icon:      r.Icon,
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
