package handler

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

//////////////////
// Transaction
//////////////////
func AddTransaction(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Add transaction"})
}

func GetTransactionsByYear(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Get transactions by year"})
}

func UpdateTransaction(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Update transaction"})
}

func DeleteTransaction(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Delete transaction"})
}

//////////////////
// Account
//////////////////

func AddAccount(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Add account"})
}

func GetAccounts(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Get accounts"})
}

func UpdateAccount(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Update account"})
}

func DeleteAccount(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Delete account"})
}

//////////////////
// Category
//////////////////

func AddCategory(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Add category"})
}

func GetCategories(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Get categories"})
}

func UpdateCategory(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Update category"})
}

func DeleteCategory(c *gin.Context) {
    c.JSON(http.StatusOK, gin.H{"message": "Delete category"})
}
