package utils

import (
	"os"

	dootask "github.com/dootask/tools/server/go"
)

type DooTaskClient struct {
	Client *dootask.Client
}

// NewDooTaskClient 创建 DooTask 客户端
func NewDooTaskClient(token string) DooTaskClient {
	server := os.Getenv("DOOTASK_API_BASE_URL")
	if len(server) > 0 {
		return DooTaskClient{Client: dootask.NewClient(token, dootask.WithServer(server))}
	}
	return DooTaskClient{Client: dootask.NewClient(token)}
}
