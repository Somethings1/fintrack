package middleware

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "fintrack/server/service"
    "fintrack/server/model"
)

func CategoryOwnershipMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        username := c.GetString("username")
        category, err := service.GetCategoryByID(c.Param("id"))

        if err != nil {
            c.AbortWithStatus(http.StatusNotFound)
            return
        }

        if category.Owner != username {
            c.AbortWithStatus(http.StatusForbidden)
            return
        }

        c.Set("category", category)
        c.Next()
    }
}

func CategoryFormatMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        type Category struct {
            Owner   string  `json:"owner"`
            Icon    string  `json:"icon"`
            Name    string  `json:"name"`
            Type    string  `json:"type"`
            Budget  float64 `json:"budget"`
        }
        var _category Category

        if err := c.ShouldBindJSON(&_category); err != nil {
            c.AbortWithStatus(http.StatusBadRequest)
            return
        }

        if _category.Type != "income" && _category.Type != "expense" {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Invalid category type",
            })
        }

        if _category.Name == "" {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Name cannot be empty",
            })
            return
        }

        if _category.Budget < 0 {
            c.JSON(http.StatusBadRequest, gin.H{
                "error": "Budget cannot be negative",
            })
            return
        }

        category := model.Category{
            Owner:   _category.Owner,
            Icon:    _category.Icon,
            Name:    _category.Name,
            Type:    _category.Type,
            Budget:  _category.Budget,
        }

        c.Set("category", category)
        c.Next()
    }
}
