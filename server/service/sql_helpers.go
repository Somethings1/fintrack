package service

import (
	"database/sql"
	"fintrack/server/model"
	"fintrack/server/money"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type rowScanner interface{ Scan(...any) error }

func parseID(raw string) (primitive.ObjectID, error) { return primitive.ObjectIDFromHex(raw) }

func scanAccount(s rowScanner) (model.Account, error) {
	var a model.Account
	var id string
	var opening, balance int64
	if err := s.Scan(&id, &a.Owner, &a.Currency, &opening, &balance, &a.Icon, &a.Name, &a.LastUpdate, &a.IsDeleted); err != nil {
		return a, err
	}
	parsed, err := parseID(id)
	if err != nil {
		return a, err
	}
	a.ID = parsed
	a.OpeningBalance = money.Amount(opening)
	a.Balance = money.Amount(balance)
	return a, nil
}

func scanSaving(s rowScanner) (model.Saving, error) {
	var v model.Saving
	var id string
	var opening, balance, goal int64
	var created, goalDate sql.NullTime
	if err := s.Scan(&id, &v.Owner, &v.Currency, &opening, &balance, &v.Icon, &v.Name, &goal, &created, &goalDate, &v.LastUpdate, &v.IsDeleted); err != nil {
		return v, err
	}
	parsed, err := parseID(id)
	if err != nil {
		return v, err
	}
	v.ID = parsed
	v.OpeningBalance = money.Amount(opening)
	v.Balance = money.Amount(balance)
	v.Goal = money.Amount(goal)
	if created.Valid {
		v.CreatedDate = created.Time
	}
	if goalDate.Valid {
		v.GoalDate = goalDate.Time
	}
	return v, nil
}

func scanCategory(s rowScanner) (model.Category, error) {
	var v model.Category
	var id string
	var budget int64
	if err := s.Scan(&id, &v.Owner, &v.Currency, &v.Type, &v.Icon, &v.Name, &budget, &v.LastUpdate, &v.IsDeleted); err != nil {
		return v, err
	}
	parsed, err := parseID(id)
	if err != nil {
		return v, err
	}
	v.ID = parsed
	v.Budget = money.Amount(budget)
	return v, nil
}

func scanTransaction(s rowScanner) (model.Transaction, error) {
	var v model.Transaction
	var id string
	var amount int64
	var src, dst, category, subscription sql.NullString
	var occurrence sql.NullTime
	if err := s.Scan(&id, &v.Creator, &v.Currency, &amount, &v.DateTime, &v.Type, &src, &dst, &category, &v.Note,
		&v.RequestKey, &v.RequestHash, &subscription, &occurrence, &v.LastUpdate, &v.IsDeleted); err != nil {
		return v, err
	}
	parsed, err := parseID(id)
	if err != nil {
		return v, err
	}
	v.ID = parsed
	v.Amount = money.Amount(amount)
	if src.Valid {
		v.SourceAccount, err = parseID(src.String)
		if err != nil {
			return v, err
		}
	}
	if dst.Valid {
		v.DestinationAccount, err = parseID(dst.String)
		if err != nil {
			return v, err
		}
	}
	if category.Valid {
		v.Category, err = parseID(category.String)
		if err != nil {
			return v, err
		}
	}
	if subscription.Valid {
		v.SubscriptionID, err = parseID(subscription.String)
		if err != nil {
			return v, err
		}
	}
	if occurrence.Valid {
		v.OccurrenceAt = occurrence.Time
	}
	return v, nil
}

func scanSubscription(s rowScanner) (model.Subscription, error) {
	var v model.Subscription
	var id, src, category string
	var amount int64
	var notify sql.NullTime
	if err := s.Scan(&id, &v.Creator, &v.Currency, &v.ScheduleVersion, &v.Name, &v.Icon, &amount, &src, &category,
		&v.StartDate, &v.Interval, &v.MaxInterval, &v.CurrentInterval, &v.IsActive, &v.RemindBefore, &v.NextActive, &notify, &v.LastUpdate, &v.IsDeleted); err != nil {
		return v, err
	}
	parsed, err := parseID(id)
	if err != nil {
		return v, err
	}
	v.ID = parsed
	v.Amount = money.Amount(amount)
	v.SourceAccount, err = parseID(src)
	if err != nil {
		return v, err
	}
	v.Category, err = parseID(category)
	if err != nil {
		return v, err
	}
	if notify.Valid {
		v.NotifyAt = notify.Time
	}
	return v, nil
}

func scanNotification(s rowScanner) (model.Notification, error) {
	var v model.Notification
	var id, ref string
	if err := s.Scan(&id, &v.Owner, &v.Type, &ref, &v.Title, &v.Message, &v.Read, &v.ScheduledAt, &v.OccurrenceKey, &v.LastUpdate, &v.IsDeleted); err != nil {
		return v, err
	}
	parsed, err := parseID(id)
	if err != nil {
		return v, err
	}
	v.ID = parsed
	v.ReferenceId, err = parseID(ref)
	if err != nil {
		return v, err
	}
	return v, nil
}

func afterArgs(after time.Time, id primitive.ObjectID) (time.Time, string) {
	if after.IsZero() || id.IsZero() {
		return time.Time{}, ""
	}
	return after, id.Hex()
}
