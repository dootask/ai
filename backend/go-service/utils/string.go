package utils

import (
	"crypto/md5"
	"encoding/hex"
	"fmt"
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

// TranslationKey 翻译键名
type TranslationKey string

const (
	// TranslationKeyMcpToolCall MCP工具调用
	TranslationKeyMcpToolCall TranslationKey = "mcp_tool_call"
	// TranslationKeyMcpToolCallWithName MCP工具调用: %s（带工具名称）
	TranslationKeyMcpToolCallWithName TranslationKey = "mcp_tool_call_with_name"
)

// translations 翻译映射表
var translations = map[string]map[TranslationKey]string{
	"zh": {
		TranslationKeyMcpToolCall:         "MCP工具调用",
		TranslationKeyMcpToolCallWithName: "#### MCP工具调用: %s\n",
	},
	"zh-CN": {
		TranslationKeyMcpToolCall:         "MCP工具调用",
		TranslationKeyMcpToolCallWithName: "#### MCP工具调用: %s\n",
	},
	"en": {
		TranslationKeyMcpToolCall:         "MCP Tool Call",
		TranslationKeyMcpToolCallWithName: "#### MCP Tool Call: %s\n",
	},
	"en-US": {
		TranslationKeyMcpToolCall:         "MCP Tool Call",
		TranslationKeyMcpToolCallWithName: "#### MCP Tool Call: %s\n",
	},
}

// GetLang 从语言字符串中提取语言代码（如从 "zh-CN" 提取 "zh"）
func GetLang(lang string) string {
	if lang == "" {
		return "en"
	}
	// 处理语言代码，如 "zh-CN" -> "zh", "en-US" -> "en"
	parts := strings.Split(lang, "-")
	langCode := strings.ToLower(parts[0])
	return langCode
}

// T 根据语言和翻译键返回翻译后的文本
// lang: 语言代码（如 "zh", "zh-CN", "en", "en-US"）
// key: 翻译键
// args: 格式化参数（可选）
func T(lang string, key TranslationKey, args ...interface{}) string {
	// 提取语言代码
	langCode := GetLang(lang)

	// 优先使用完整语言代码，如果不存在则使用基础语言代码
	var translationsMap map[TranslationKey]string
	if trans, ok := translations[lang]; ok {
		translationsMap = trans
	} else if trans, ok := translations[langCode]; ok {
		translationsMap = trans
	} else {
		// 默认使用英文
		translationsMap = translations["en"]
	}

	// 获取翻译文本
	text := translationsMap[key]
	if text == "" {
		// 如果找不到翻译，使用英文作为后备
		if enTrans, ok := translations["en"][key]; ok {
			text = enTrans
		} else {
			// 如果英文也没有，返回key本身
			return string(key)
		}
	}

	// 如果有格式化参数，进行格式化
	if len(args) > 0 {
		// 简单的字符串替换实现
		// 使用 %s, %d 等格式化占位符
		if strings.Contains(text, "%s") || strings.Contains(text, "%d") || strings.Contains(text, "%v") {
			return fmt.Sprintf(text, args...)
		}
	}

	return text
}

// TFmt 格式化翻译文本（等同于 T，但更明确表达格式化意图）
func TFmt(lang string, key TranslationKey, args ...interface{}) string {
	return T(lang, key, args...)
}
