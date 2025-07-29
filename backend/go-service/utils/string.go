package utils

import (
	"crypto/md5"
	"encoding/hex"
	"reflect"
	"strconv"
	"strings"

	htmltomarkdown "github.com/JohannesKaufmann/html-to-markdown/v2"
)

// SplitString 分割字符串，并去除空字符串
func SplitString(s string, sep string) []string {
	if s == "" {
		return []string{}
	}
	parts := strings.Split(s, sep)
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// IsEmpty 判断值是否为空（支持指针类型）
func IsEmpty(value interface{}) bool {
	if value == nil {
		return true
	}

	v := reflect.ValueOf(value)

	switch v.Kind() {
	case reflect.Ptr, reflect.Interface:
		if v.IsNil() {
			return true
		}
		return IsEmpty(v.Elem().Interface())
	case reflect.String:
		return v.String() == ""
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return v.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return v.Float() == 0
	case reflect.Bool:
		return !v.Bool()
	case reflect.Slice, reflect.Array, reflect.Map, reflect.Chan:
		return v.Len() == 0
	default:
		return reflect.DeepEqual(value, reflect.Zero(v.Type()).Interface())
	}
}

// IsNotEmpty 判断字符串是否不为空（支持string、int、float64、bool、nil）
func IsNotEmpty(s interface{}) bool {
	return !IsEmpty(s)
}

// MD5 计算字符串的MD5值
func MD5(str string) string {
	h := md5.New()
	h.Write([]byte(str))
	return hex.EncodeToString(h.Sum(nil))
}

// StrToInt 将字符串转换为int
func StrToInt(s string) int {
	num, _ := strconv.Atoi(s)
	return num
}

// HTMLToMarkdown 将HTML内容转换为Markdown格式
func HTMLToMarkdown(html string) (string, error) {
	// 使用v2库的简单转换函数，它已经包含了base和commonmark插件
	markdown, err := htmltomarkdown.ConvertString(html)
	if err != nil {
		return "", err
	}

	return markdown, nil
}
