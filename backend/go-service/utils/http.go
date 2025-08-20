package utils

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
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
			Timeout: 300 * time.Second,
		},
		baseURL:    baseURL,
		headers:    make(map[string]string),
		maxRetries: 2,
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

// UploadFile 上传文件并传递其他参数
func (c *HTTPClient) UploadFile(ctx context.Context, path string, headers map[string]string, queryParams map[string]string, method string, filePath string, fieldName string, additionalParams map[string]string) (*Response, error) {
	// 构建完整URL
	fullURL := c.baseURL + path

	// 创建multipart/form-data请求体
	var reqBody bytes.Buffer
	writer := multipart.NewWriter(&reqBody)

	// 添加文件
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %v", err)
	}
	defer file.Close()

	part, err := writer.CreateFormFile(fieldName, filepath.Base(filePath))
	if err != nil {
		return nil, fmt.Errorf("创建文件表单字段失败: %v", err)
	}

	_, err = io.Copy(part, file)
	if err != nil {
		return nil, fmt.Errorf("复制文件内容失败: %v", err)
	}

	// 添加其他参数
	for key, value := range additionalParams {
		err = writer.WriteField(key, value)
		if err != nil {
			return nil, fmt.Errorf("添加表单字段失败: %v", err)
		}
	}

	// 关闭writer
	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("关闭multipart writer失败: %v", err)
	}

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, method, fullURL, &reqBody)
	if err != nil {
		return nil, fmt.Errorf("创建%s请求失败: %v", method, err)
	}

	// 设置Content-Type
	req.Header.Set("Content-Type", writer.FormDataContentType())

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

	// 读取响应体
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("读取响应体失败: %v", err)
	}

	return &Response{
		StatusCode: resp.StatusCode,
		Headers:    resp.Header,
		Body:       body,
	}, nil
}

// UploadFileWithReader 使用io.Reader上传文件并传递其他参数
func (c *HTTPClient) UploadFileWithReader(ctx context.Context, path string, headers map[string]string, queryParams map[string]string, method string, reader io.Reader, fileName string, fieldName string, additionalParams map[string]string) (*Response, error) {
	// 构建完整URL
	fullURL := c.baseURL + path

	// 创建multipart/form-data请求体
	var reqBody bytes.Buffer
	writer := multipart.NewWriter(&reqBody)

	// 添加文件
	part, err := writer.CreateFormFile(fieldName, fileName)
	if err != nil {
		return nil, fmt.Errorf("创建文件表单字段失败: %v", err)
	}

	_, err = io.Copy(part, reader)
	if err != nil {
		return nil, fmt.Errorf("复制文件内容失败: %v", err)
	}

	// 添加其他参数
	for key, value := range additionalParams {
		err = writer.WriteField(key, value)
		if err != nil {
			return nil, fmt.Errorf("添加表单字段失败: %v", err)
		}
	}

	// 关闭writer
	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("关闭multipart writer失败: %v", err)
	}

	// 创建请求
	req, err := http.NewRequestWithContext(ctx, method, fullURL, &reqBody)
	if err != nil {
		return nil, fmt.Errorf("创建%s请求失败: %v", method, err)
	}

	// 设置Content-Type
	req.Header.Set("Content-Type", writer.FormDataContentType())

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

	// 读取响应体
	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return nil, fmt.Errorf("读取响应体失败: %v", err)
	}

	return &Response{
		StatusCode: resp.StatusCode,
		Headers:    resp.Header,
		Body:       body,
	}, nil
}
