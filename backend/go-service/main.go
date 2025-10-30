package main

import (
	"log"
	"os"

	"dootask-ai/go-service/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		log.Printf("%v", err)
		os.Exit(1)
	}
}
