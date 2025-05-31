package cronjob

import (
    "context"
    "log"
    "time"

    "go.mongodb.org/mongo-driver/bson"
    "fintrack/server/model"
    "fintrack/server/service"
    "fintrack/server/util"
)

func CreateSubscriptionNotificationsCron() {
    ticker := time.NewTicker(1 * time.Hour)
    defer ticker.Stop()

    for {
        <-ticker.C
        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)

        now := time.Now()

        filter := bson.M{
            "is_active": true,
            "notify_at": bson.M{"$lte": now},
            "is_deleted": false,
        }

        cursor, err := util.SubscriptionCollection.Find(ctx, filter)
        if err != nil {
            log.Println("Error fetching subscriptions for notifications:", err)
            cancel()
            continue
        }

        for cursor.Next(ctx) {
            var sub model.Subscription
            if err := cursor.Decode(&sub); err != nil {
                log.Println("Error decoding subscription:", err)
                continue
            }

            notif := model.Notification{
                Owner: sub.Creator,
                Type: model.TypeSubscription,
                ReferenceId: sub.ID,
                Title: "Subscription Alert",
                Message: "Your subscription " + sub.Name + " is about to due in " + string(sub.RemindBefore) + "days.",
                ScheduledAt: time.Now(),
            }

            if _, err := service.AddNotification(ctx, notif); err != nil {
                log.Println("Failed to create notification for subscription:", err)
            }

            service.OnNotificationCreated(ctx, sub.ID)
        }

        cursor.Close(ctx)
        cancel()
    }
}

func CreateSubscriptionTransactionCron() {
    ticker := time.NewTicker(1 * time.Hour)
    defer ticker.Stop()

    for {
        <-ticker.C
        ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)

        now := time.Now()

        filter := bson.M{
            "is_active": true,
            "next_active": bson.M{"$lte": now},
            "is_deleted": false,
        }

        cursor, err := util.SubscriptionCollection.Find(ctx, filter)
        if err != nil {
            log.Println("Error fetching subscriptions for transactions:", err)
            cancel()
            continue
        }

        for cursor.Next(ctx) {
            var sub model.Subscription
            if err := cursor.Decode(&sub); err != nil {
                log.Println("Error decoding subscription:", err)
                continue
            }

            txn := model.Transaction{
                Creator:        sub.Creator,
                Amount:         sub.Amount,
                SourceAccount:  sub.SourceAccount,
                Category:       sub.Category,
                DateTime:       now,
                Type:           "expense",
                Note:           "Subscription payment for " + sub.Name,
                IsDeleted:      false,
            }

            if _, err := service.AddTransaction(ctx, txn); err != nil {
                log.Println("Failed to create transaction for subscription:", err)
                continue
            }

            if err := service.OnTransactionCreated(ctx, sub.ID); err != nil {
                log.Println("Failed to update subscription after transaction:", err)
            }
        }

        cursor.Close(ctx)
        cancel()
    }
}

