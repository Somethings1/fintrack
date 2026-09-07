// migrate-money is OFFLINE and dry-run by default. It does not load .env files.
package main

import (
	"context"
	"encoding/json"
	"fintrack/server/migration"
	"flag"
	"fmt"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"os"
	"time"
)

func run() error {
	database := flag.String("database", "", "explicit database name")
	currency := flag.String("currency", "", "reviewed currency for all historical records")
	report := flag.String("report", "money-plan.json", "sensitive reconciliation report (0600)")
	schedules := flag.String("schedules", "", "reviewed JSON object mapping subscription IDs to {processed,next}")
	apply := flag.Bool("apply", false, "apply reviewed plan; writers MUST be stopped")
	stopped := flag.Bool("writers-stopped", false, "attest all API and worker writers are stopped")
	accept := flag.Bool("accept-inferred-openings", false, "accept listed inferred opening balances after statement review")
	expected := flag.String("expected-plan", "", "SHA256 from reviewed dry-run")
	flag.Parse()
	uri := os.Getenv("MONGO_URI")
	if uri == "" || *database == "" || *currency == "" {
		return fmt.Errorf("MONGO_URI, --database and --currency are required")
	}
	if *apply && (!*stopped || *expected == "") {
		return fmt.Errorf("apply requires --writers-stopped and --expected-plan")
	}
	mappings := map[string]migration.Schedule{}
	if *schedules != "" {
		raw, err := os.ReadFile(*schedules)
		if err != nil {
			return err
		}
		if err := json.Unmarshal(raw, &mappings); err != nil {
			return err
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri).SetServerSelectionTimeout(5*time.Second))
	if err != nil {
		return fmt.Errorf("database connection failed")
	}
	defer client.Disconnect(context.Background())
	db := client.Database(*database)
	plan, err := migration.Build(ctx, db, *currency, mappings)
	if err != nil {
		return err
	}
	raw, err := json.MarshalIndent(plan, "", "  ")
	if err != nil {
		return err
	}
	// Do not overwrite a previously reviewed report accidentally.
	file, err := os.OpenFile(*report, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	_, err = file.Write(raw)
	closeErr := file.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	fmt.Printf("documents=%d changes=%d issues=%d plan=%s\n", plan.Documents, plan.Changes, len(plan.Issues), plan.Digest)
	if len(plan.Issues) > 0 {
		return fmt.Errorf("review the private report; no changes applied")
	}
	if *apply {
		return migration.Apply(ctx, db, plan, *expected, *accept)
	}
	return nil
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
