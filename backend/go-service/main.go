package main

import (
	"fmt"
	"os"

	"dootask-ai/go-service/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
