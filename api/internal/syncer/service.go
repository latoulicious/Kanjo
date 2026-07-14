package syncer

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/latoulicious/kanjo/api/internal/store"
)

// Wire shapes: money as decimal strings, FK refs as client uuids — server ids
// never cross the wire. Deleted marks a device tombstone to apply server-side.
type AccountChange struct {
	UUID         string    `json:"uuid"`
	Name         string    `json:"name"`
	IsLiquid     bool      `json:"is_liquid"`
	Icon         string    `json:"icon"`
	TargetAmount *string   `json:"target_amount"`
	UpdatedAt    time.Time `json:"updated_at"`
	Deleted      bool      `json:"deleted,omitempty"`
}

type CategoryChange struct {
	UUID          string    `json:"uuid"`
	Name          string    `json:"name"`
	Icon          string    `json:"icon"`
	MonthlyBudget *string   `json:"monthly_budget"`
	UpdatedAt     time.Time `json:"updated_at"`
	Deleted       bool      `json:"deleted,omitempty"`
}

type ProjectChange struct {
	UUID      string    `json:"uuid"`
	Name      string    `json:"name"`
	Icon      string    `json:"icon"`
	UpdatedAt time.Time `json:"updated_at"`
	Deleted   bool      `json:"deleted,omitempty"`
}

type TransactionChange struct {
	UUID            string    `json:"uuid"`
	OccurredOn      string    `json:"occurred_on"`
	Description     string    `json:"description"`
	Direction       string    `json:"direction"`
	IsInflow        bool      `json:"is_inflow"`
	Amount          string    `json:"amount"`
	AccountUUID     string    `json:"account_uuid"`
	CategoryUUID    *string   `json:"category_uuid"`
	ProjectUUID     *string   `json:"project_uuid"`
	TransferGroupID *string   `json:"transfer_group_id"`
	Tags            []string  `json:"tags"`
	UpdatedAt       time.Time `json:"updated_at"`
	Deleted         bool      `json:"deleted,omitempty"`
}

type RecurringChange struct {
	UUID         string    `json:"uuid"`
	Description  string    `json:"description"`
	Direction    string    `json:"direction"`
	Amount       string    `json:"amount"`
	AccountUUID  string    `json:"account_uuid"`
	CategoryUUID *string   `json:"category_uuid"`
	DayOfMonth   int       `json:"day_of_month"`
	LastPosted   *string   `json:"last_posted"`
	UpdatedAt    time.Time `json:"updated_at"`
	Deleted      bool      `json:"deleted,omitempty"`
}

type Changes struct {
	Accounts     []AccountChange     `json:"accounts"`
	Categories   []CategoryChange    `json:"categories"`
	Projects     []ProjectChange     `json:"projects"`
	Transactions []TransactionChange `json:"transactions"`
	Recurring    []RecurringChange   `json:"recurring"`
}

type Request struct {
	Changes Changes `json:"changes"`
}

type Response struct {
	Snapshot Changes   `json:"snapshot"`
	SyncedAt time.Time `json:"synced_at"`
}

type Service struct {
	st *store.Store
}

func NewService(st *store.Store) *Service {
	return &Service{st: st}
}

// Apply upserts device changes (last-write-wins on updated_at) and returns the
// full live snapshot; the client reconciles against it, absence = deleted.
func (s *Service) Apply(ctx context.Context, in Request) (Response, error) {
	var snap Changes
	err := s.st.WithRawTx(ctx, func(tx pgx.Tx) error {
		if err := applyChanges(ctx, tx, in.Changes); err != nil {
			return err
		}
		var err error
		snap, err = snapshot(ctx, tx)
		return err
	})
	if err != nil {
		return Response{}, err
	}
	return Response{Snapshot: snap, SyncedAt: time.Now().UTC()}, nil
}

// applyChanges upserts referenced tables before referencing ones, then applies
// deletes children-first so account RESTRICT still guards.
func applyChanges(ctx context.Context, tx pgx.Tx, c Changes) error {
	for _, a := range c.Accounts {
		if !a.Deleted {
			if err := upsertAccount(ctx, tx, a); err != nil {
				return err
			}
		}
	}
	for _, v := range c.Categories {
		if !v.Deleted {
			if err := upsertCategory(ctx, tx, v); err != nil {
				return err
			}
		}
	}
	for _, p := range c.Projects {
		if !p.Deleted {
			if err := upsertProject(ctx, tx, p); err != nil {
				return err
			}
		}
	}
	for _, t := range c.Transactions {
		if !t.Deleted {
			if err := upsertTransaction(ctx, tx, t); err != nil {
				return err
			}
		}
	}
	for _, r := range c.Recurring {
		if !r.Deleted {
			if err := upsertRecurring(ctx, tx, r); err != nil {
				return err
			}
		}
	}

	for _, t := range c.Transactions {
		if t.Deleted {
			if err := del(ctx, tx, "transactions", t.UUID); err != nil {
				return err
			}
		}
	}
	for _, r := range c.Recurring {
		if r.Deleted {
			if err := del(ctx, tx, "recurring", r.UUID); err != nil {
				return err
			}
		}
	}
	for _, p := range c.Projects {
		if p.Deleted {
			if err := del(ctx, tx, "projects", p.UUID); err != nil {
				return err
			}
		}
	}
	for _, v := range c.Categories {
		if v.Deleted {
			if err := del(ctx, tx, "categories", v.UUID); err != nil {
				return err
			}
		}
	}
	for _, a := range c.Accounts {
		if a.Deleted {
			if err := del(ctx, tx, "accounts", a.UUID); err != nil {
				return err
			}
		}
	}
	return nil
}

// del hard-deletes by uuid; table names come from the fixed call sites above.
func del(ctx context.Context, tx pgx.Tx, table, uuid string) error {
	_, err := tx.Exec(ctx, `DELETE FROM `+table+` WHERE client_uuid = $1::uuid`, uuid)
	return err
}

// existsByUUID reports whether the row already exists (a no-op update then
// means the server copy is newer — LWW skip, not an insert).
func existsByUUID(ctx context.Context, tx pgx.Tx, table, uuid string) (bool, error) {
	var exists bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM `+table+` WHERE client_uuid = $1::uuid)`, uuid).Scan(&exists)
	return exists, err
}

// Named-entity upserts share a shape: LWW update by uuid, else insert with
// adopt-by-name — a same-name row without the uuid takes it over, so
// single-user data merges on the natural key instead of erroring on UNIQUE(name).
func upsertAccount(ctx context.Context, tx pgx.Tx, a AccountChange) error {
	tag, err := tx.Exec(ctx, `
		UPDATE accounts SET name=$2, is_liquid=$3, icon=$4, target_amount=$5::numeric, updated_at=$6
		WHERE client_uuid=$1::uuid AND updated_at < $6`,
		a.UUID, a.Name, a.IsLiquid, a.Icon, a.TargetAmount, a.UpdatedAt)
	if err != nil || tag.RowsAffected() > 0 {
		return err
	}
	if exists, err := existsByUUID(ctx, tx, "accounts", a.UUID); err != nil || exists {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO accounts (name, is_liquid, icon, target_amount, client_uuid, updated_at)
		VALUES ($2, $3, $4, $5::numeric, $1::uuid, $6)
		ON CONFLICT (name) DO UPDATE SET
			client_uuid=EXCLUDED.client_uuid, is_liquid=EXCLUDED.is_liquid, icon=EXCLUDED.icon,
			target_amount=EXCLUDED.target_amount, updated_at=EXCLUDED.updated_at
		WHERE accounts.updated_at < EXCLUDED.updated_at`,
		a.UUID, a.Name, a.IsLiquid, a.Icon, a.TargetAmount, a.UpdatedAt)
	return err
}

func upsertCategory(ctx context.Context, tx pgx.Tx, c CategoryChange) error {
	tag, err := tx.Exec(ctx, `
		UPDATE categories SET name=$2, icon=$3, monthly_budget=$4::numeric, updated_at=$5
		WHERE client_uuid=$1::uuid AND updated_at < $5`,
		c.UUID, c.Name, c.Icon, c.MonthlyBudget, c.UpdatedAt)
	if err != nil || tag.RowsAffected() > 0 {
		return err
	}
	if exists, err := existsByUUID(ctx, tx, "categories", c.UUID); err != nil || exists {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO categories (name, icon, monthly_budget, client_uuid, updated_at)
		VALUES ($2, $3, $4::numeric, $1::uuid, $5)
		ON CONFLICT (name) DO UPDATE SET
			client_uuid=EXCLUDED.client_uuid, icon=EXCLUDED.icon,
			monthly_budget=EXCLUDED.monthly_budget, updated_at=EXCLUDED.updated_at
		WHERE categories.updated_at < EXCLUDED.updated_at`,
		c.UUID, c.Name, c.Icon, c.MonthlyBudget, c.UpdatedAt)
	return err
}

func upsertProject(ctx context.Context, tx pgx.Tx, p ProjectChange) error {
	tag, err := tx.Exec(ctx, `
		UPDATE projects SET name=$2, icon=$3, updated_at=$4
		WHERE client_uuid=$1::uuid AND updated_at < $4`,
		p.UUID, p.Name, p.Icon, p.UpdatedAt)
	if err != nil || tag.RowsAffected() > 0 {
		return err
	}
	if exists, err := existsByUUID(ctx, tx, "projects", p.UUID); err != nil || exists {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO projects (name, icon, client_uuid, updated_at)
		VALUES ($2, $3, $1::uuid, $4)
		ON CONFLICT (name) DO UPDATE SET
			client_uuid=EXCLUDED.client_uuid, icon=EXCLUDED.icon, updated_at=EXCLUDED.updated_at
		WHERE projects.updated_at < EXCLUDED.updated_at`,
		p.UUID, p.Name, p.Icon, p.UpdatedAt)
	return err
}

func upsertTransaction(ctx context.Context, tx pgx.Tx, t TransactionChange) error {
	tag, err := tx.Exec(ctx, `
		UPDATE transactions SET occurred_on=$2::date, description=$3, direction=$4, is_inflow=$5,
			amount=$6::numeric,
			account_id=(SELECT id FROM accounts WHERE client_uuid=$7::uuid),
			category_id=(SELECT id FROM categories WHERE client_uuid=$8::uuid),
			project_id=(SELECT id FROM projects WHERE client_uuid=$9::uuid),
			transfer_group_id=$10::uuid, tags=$11, updated_at=$12
		WHERE client_uuid=$1::uuid AND updated_at < $12`,
		t.UUID, t.OccurredOn, t.Description, t.Direction, t.IsInflow, t.Amount,
		t.AccountUUID, t.CategoryUUID, t.ProjectUUID, t.TransferGroupID, orEmpty(t.Tags), t.UpdatedAt)
	if err != nil || tag.RowsAffected() > 0 {
		return err
	}
	if exists, err := existsByUUID(ctx, tx, "transactions", t.UUID); err != nil || exists {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (occurred_on, description, direction, is_inflow, amount,
			account_id, category_id, project_id, transfer_group_id, tags, client_uuid, updated_at)
		SELECT $2::date, $3, $4, $5, $6::numeric,
			(SELECT id FROM accounts WHERE client_uuid=$7::uuid),
			(SELECT id FROM categories WHERE client_uuid=$8::uuid),
			(SELECT id FROM projects WHERE client_uuid=$9::uuid),
			$10::uuid, $11, $1::uuid, $12
		ON CONFLICT (client_uuid) DO NOTHING`,
		t.UUID, t.OccurredOn, t.Description, t.Direction, t.IsInflow, t.Amount,
		t.AccountUUID, t.CategoryUUID, t.ProjectUUID, t.TransferGroupID, orEmpty(t.Tags), t.UpdatedAt)
	return err
}

func upsertRecurring(ctx context.Context, tx pgx.Tx, r RecurringChange) error {
	tag, err := tx.Exec(ctx, `
		UPDATE recurring SET description=$2, direction=$3, amount=$4::numeric,
			account_id=(SELECT id FROM accounts WHERE client_uuid=$5::uuid),
			category_id=(SELECT id FROM categories WHERE client_uuid=$6::uuid),
			day_of_month=$7, last_posted=$8::date, updated_at=$9
		WHERE client_uuid=$1::uuid AND updated_at < $9`,
		r.UUID, r.Description, r.Direction, r.Amount, r.AccountUUID, r.CategoryUUID,
		r.DayOfMonth, r.LastPosted, r.UpdatedAt)
	if err != nil || tag.RowsAffected() > 0 {
		return err
	}
	if exists, err := existsByUUID(ctx, tx, "recurring", r.UUID); err != nil || exists {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO recurring (description, direction, amount, account_id, category_id,
			day_of_month, last_posted, client_uuid, updated_at)
		SELECT $2, $3, $4::numeric,
			(SELECT id FROM accounts WHERE client_uuid=$5::uuid),
			(SELECT id FROM categories WHERE client_uuid=$6::uuid),
			$7, $8::date, $1::uuid, $9
		ON CONFLICT (client_uuid) DO NOTHING`,
		r.UUID, r.Description, r.Direction, r.Amount, r.AccountUUID, r.CategoryUUID,
		r.DayOfMonth, r.LastPosted, r.UpdatedAt)
	return err
}

func snapshot(ctx context.Context, tx pgx.Tx) (Changes, error) {
	c := Changes{
		Accounts:     []AccountChange{},
		Categories:   []CategoryChange{},
		Projects:     []ProjectChange{},
		Transactions: []TransactionChange{},
		Recurring:    []RecurringChange{},
	}

	rows, err := tx.Query(ctx, `
		SELECT client_uuid::text, name, is_liquid, icon, target_amount::text, updated_at
		FROM accounts ORDER BY id`)
	if err != nil {
		return c, err
	}
	for rows.Next() {
		var a AccountChange
		if err := rows.Scan(&a.UUID, &a.Name, &a.IsLiquid, &a.Icon, &a.TargetAmount, &a.UpdatedAt); err != nil {
			rows.Close()
			return c, err
		}
		c.Accounts = append(c.Accounts, a)
	}
	if rows.Err() != nil {
		return c, rows.Err()
	}

	rows, err = tx.Query(ctx, `
		SELECT client_uuid::text, name, icon, monthly_budget::text, updated_at
		FROM categories ORDER BY id`)
	if err != nil {
		return c, err
	}
	for rows.Next() {
		var v CategoryChange
		if err := rows.Scan(&v.UUID, &v.Name, &v.Icon, &v.MonthlyBudget, &v.UpdatedAt); err != nil {
			rows.Close()
			return c, err
		}
		c.Categories = append(c.Categories, v)
	}
	if rows.Err() != nil {
		return c, rows.Err()
	}

	rows, err = tx.Query(ctx, `
		SELECT client_uuid::text, name, icon, updated_at FROM projects ORDER BY id`)
	if err != nil {
		return c, err
	}
	for rows.Next() {
		var p ProjectChange
		if err := rows.Scan(&p.UUID, &p.Name, &p.Icon, &p.UpdatedAt); err != nil {
			rows.Close()
			return c, err
		}
		c.Projects = append(c.Projects, p)
	}
	if rows.Err() != nil {
		return c, rows.Err()
	}

	rows, err = tx.Query(ctx, `
		SELECT t.client_uuid::text, t.occurred_on::text, t.description, t.direction, t.is_inflow,
			t.amount::text, a.client_uuid::text, c.client_uuid::text, p.client_uuid::text,
			t.transfer_group_id::text, t.tags, t.updated_at
		FROM transactions t
		JOIN accounts a ON a.id = t.account_id
		LEFT JOIN categories c ON c.id = t.category_id
		LEFT JOIN projects p ON p.id = t.project_id
		ORDER BY t.id`)
	if err != nil {
		return c, err
	}
	for rows.Next() {
		var t TransactionChange
		if err := rows.Scan(&t.UUID, &t.OccurredOn, &t.Description, &t.Direction, &t.IsInflow,
			&t.Amount, &t.AccountUUID, &t.CategoryUUID, &t.ProjectUUID,
			&t.TransferGroupID, &t.Tags, &t.UpdatedAt); err != nil {
			rows.Close()
			return c, err
		}
		t.Tags = orEmpty(t.Tags)
		c.Transactions = append(c.Transactions, t)
	}
	if rows.Err() != nil {
		return c, rows.Err()
	}

	rows, err = tx.Query(ctx, `
		SELECT r.client_uuid::text, r.description, r.direction, r.amount::text,
			a.client_uuid::text, c.client_uuid::text, r.day_of_month, r.last_posted::text, r.updated_at
		FROM recurring r
		JOIN accounts a ON a.id = r.account_id
		LEFT JOIN categories c ON c.id = r.category_id
		ORDER BY r.id`)
	if err != nil {
		return c, err
	}
	for rows.Next() {
		var r RecurringChange
		if err := rows.Scan(&r.UUID, &r.Description, &r.Direction, &r.Amount,
			&r.AccountUUID, &r.CategoryUUID, &r.DayOfMonth, &r.LastPosted, &r.UpdatedAt); err != nil {
			rows.Close()
			return c, err
		}
		c.Recurring = append(c.Recurring, r)
	}
	return c, rows.Err()
}

func orEmpty(tags []string) []string {
	if tags == nil {
		return []string{}
	}
	return tags
}
