package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// HTTPClient 是HTTP客户端的结构体
type HTTPClient struct {
	client     *http.Client
	baseURL    string
	headers    map[string]string
	timeout    time.Duration
	maxRetries int
	retryDelay time.Duration
}

// Response 是HTTP响应的结构体
type Response struct {
	StatusCode int
	Headers    http.Header
	Body       []byte
}

// newHTTPClient 创建新的HTTP客户端
func NewHTTPClient(baseURL string, options ...func(*HTTPClient)) *HTTPClient {
	client := &HTTPClient{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		baseURL:    baseURL,
		headers:    make(map[string]string),
		timeout:    30 * time.Second,
		maxRetries: 3,
		retryDelay: 1 * time.Second,
	}

	// 应用自定义选项
	for _, option := range options {
		option(client)
	}

	return client
}

// withTimeout 设置超时时间
func WithTimeout(timeout time.Duration) func(*HTTPClient) {
	return func(c *HTTPClient) {
		c.timeout = timeout
		c.client.Timeout = timeout
	}
}

// withHeaders 设置默认请求头
func WithHeaders(headers map[string]string) func(*HTTPClient) {
	return func(c *HTTPClient) {
		maps.Copy(c.headers, headers)
	}
}

// Stream 发送HTTP请求并返回流式响应
func (c *HTTPClient) Stream(ctx context.Context, path string, headers map[string]string, queryParams map[string]string, method string, bodyData interface{}, contentType string) (*http.Response, error) {
	// 构建完整URL
	fullURL := c.baseURL + path

	var reqBody io.Reader
	var err error

	// 仅POST支持body
	if method == http.MethodPost {
		switch contentType {
		case "application/json":
			var bodyBytes []byte
			bodyBytes, err = json.Marshal(bodyData)
			if err != nil {
				return nil, fmt.Errorf("JSON编码失败: %v", err)
			}
			reqBody = bytes.NewReader(bodyBytes)
		case "application/x-www-form-urlencoded":
			data, ok := bodyData.(map[string]string)
			if !ok {
				return nil, fmt.Errorf("x-www-form-urlencoded的bodyData必须是map[string]string类型")
			}
			form := url.Values{}
			for k, v := range data {
				form.Add(k, v)
			}
			reqBody = strings.NewReader(form.Encode())
		default:
			return nil, fmt.Errorf("不支持的content type: %s", contentType)
		}
	}

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, method, fullURL, reqBody)
	if err != nil {
		return nil, fmt.Errorf("创建%s请求失败: %v", method, err)
	}

	// 仅POST设置Content-Type
	if method == http.MethodPost && contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}

	// 设置默认请求头
	for k, v := range c.headers {
		req.Header.Set(k, v)
	}
	// 设置自定义请求头
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	// 设置查询参数
	if len(queryParams) > 0 {
		q := req.URL.Query()
		for k, v := range queryParams {
			q.Set(k, v)
		}
		req.URL.RawQuery = q.Encode()
	}

	// 发送请求 (带重试)
	var resp *http.Response
	var lastErr error
	for i := 0; i <= c.maxRetries; i++ {
		resp, lastErr = c.client.Do(req)
		if lastErr == nil {
			break
		}
		if i < c.maxRetries {
			time.Sleep(c.retryDelay)
			continue
		}
	}
	if lastErr != nil {
		return nil, fmt.Errorf("%s请求失败: %v", method, lastErr)
	}

	return resp, nil
}
