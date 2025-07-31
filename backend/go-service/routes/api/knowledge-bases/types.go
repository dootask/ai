package knowledgebases

import (
	"encoding/json"
	"time"
)

// KnowledgeBase 知识库模型
type KnowledgeBase struct {
	ID             int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID         int64           `gorm:"not null;index" json:"user_id"`
	Name           string          `gorm:"type:varchar(255);not null" json:"name" validate:"required,max=255"`
	Description    *string         `gorm:"type:text" json:"description"`
	EmbeddingModel string          `gorm:"type:varchar(100);default:'text-embedding-ada-002'" json:"embedding_model" validate:"required"`
	ChunkSize      int             `gorm:"default:1000" json:"chunk_size" validate:"min=100,max=4000"`
	ChunkOverlap   int             `gorm:"default:200" json:"chunk_overlap" validate:"min=0,max=1000"`
	ApiKey         string          `gorm:"type:text" json:"api_key"`
	Provider       string          `gorm:"type:varchar(100);default:''" json:"provider"`
	ProxyURL       string          `gorm:"type:varchar(500);default:''" json:"proxy_url"`
	Metadata       json.RawMessage `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	IsActive       bool            `gorm:"default:true" json:"is_active"`
	CreatedAt      time.Time       `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time       `gorm:"autoUpdateTime" json:"updated_at"`

	// 关联查询字段
	DocumentsCount int `gorm:"column:documents_count" json:"documents_count"`
}

// KBDocument 知识库文档模型
type KBDocument struct {
	ID              int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	KnowledgeBaseID int64           `gorm:"column:knowledge_base_id" json:"knowledge_base_id" validate:"required"`
	Title           string          `gorm:"type:varchar(255);not null" json:"title" validate:"required,max=255"`
	Content         string          `gorm:"type:text;not null" json:"content" validate:"required"`
	FilePath        *string         `gorm:"type:varchar(500)" json:"file_path"`
	FileType        string          `gorm:"type:varchar(50)" json:"file_type"`
	FileSize        int64           `json:"file_size"`
	Metadata        json.RawMessage `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	ChunkIndex      int             `gorm:"default:0" json:"chunk_index"`
	ParentDocID     *int64          `gorm:"column:parent_doc_id" json:"parent_doc_id"`
	ProcessStatus   string          `gorm:"-" json:"status"` // 处理状态：processed, processing, failed
	IsActive        bool            `gorm:"default:true" json:"is_active"`
	CreatedAt       time.Time       `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time       `gorm:"autoUpdateTime" json:"updated_at"`

	// 关联查询字段
	ChunksCount int `gorm:"-" json:"chunks_count"`
}

// 请求类型

// CreateKnowledgeBaseRequest 创建知识库请求
type CreateKnowledgeBaseRequest struct {
	Name           string          `json:"name" validate:"required,max=255"`
	Description    *string         `json:"description"`
	EmbeddingModel string          `json:"embedding_model" validate:"required"`
	ChunkSize      int             `json:"chunk_size" validate:"min=100,max=4000"`
	ChunkOverlap   int             `json:"chunk_overlap" validate:"min=0,max=1000"`
	ApiKey         *string         `json:"api_key"`
	Provider       string          `json:"provider" validate:"required"` // 新增
	ProxyURL       *string         `json:"proxy_url"`                    // 新增
	Metadata       json.RawMessage `json:"metadata"`
}

// UpdateKnowledgeBaseRequest 更新知识库请求
type UpdateKnowledgeBaseRequest struct {
	Name           *string         `json:"name" validate:"omitempty,max=255"`
	Description    *string         `json:"description"`
	EmbeddingModel *string         `json:"embedding_model"`
	ChunkSize      *int            `json:"chunk_size" validate:"omitempty,min=100,max=4000"`
	ChunkOverlap   *int            `json:"chunk_overlap" validate:"omitempty,min=0,max=1000"`
	ApiKey         *string         `json:"api_key"`
	Provider       *string         `json:"provider"`  // 新增
	ProxyURL       *string         `json:"proxy_url"` // 新增
	Metadata       json.RawMessage `json:"metadata"`
	IsActive       *bool           `json:"is_active"`
}

// UploadDocumentRequest 上传文档请求
type UploadDocumentRequest struct {
	Title    string          `json:"title" validate:"required,max=255"`
	Content  string          `json:"content" validate:"required"`
	FileType string          `json:"file_type" validate:"required"`
	FileSize int64           `json:"file_size" validate:"min=0"`
	FilePath *string         `json:"file_path"`
	Metadata json.RawMessage `json:"metadata"`
}

// 响应类型

// KnowledgeBaseFilters 知识库筛选条件
type KnowledgeBaseFilters struct {
	Search         string `json:"search" form:"search"`                   // 搜索关键词
	EmbeddingModel string `json:"embedding_model" form:"embedding_model"` // 嵌入模型过滤
	IsActive       *bool  `json:"is_active" form:"is_active"`             // 状态过滤
}

// DocumentFilters 文档筛选条件
type DocumentFilters struct {
	Search   string `json:"search" form:"search"`       // 搜索关键词
	FileType string `json:"file_type" form:"file_type"` // 文件类型过滤
	Status   string `json:"status" form:"status"`       // 状态过滤
}

// KnowledgeBaseListData 知识库列表数据结构
type KnowledgeBaseListData struct {
	Items []KnowledgeBase `json:"items"`
}

// DocumentListData 文档列表数据结构
type DocumentListData struct {
	Items []KBDocument `json:"items"`
}

// KnowledgeBaseResponse 知识库详情响应（包含统计信息）
type KnowledgeBaseResponse struct {
	KnowledgeBase
	DocumentsCount     int        `json:"documents_count"`
	TotalChunks        int        `json:"total_chunks"`
	ProcessedChunks    int        `json:"processed_chunks"`
	LastDocumentUpload *time.Time `json:"last_document_upload,omitempty"`
}

// UploadDocumentResponse 上传文档响应
type UploadDocumentResponse struct {
	KnowledgeBase  string          `json:"knowledge_base"`
	TotalFiles     int             `json:"total_files"`
	TotalChunks    int             `json:"total_chunks"`
	ProcessedFiles []ProcessedFile `json:"processed_files"`
}

// ProcessedFile 处理文件
type ProcessedFile struct {
	Filename string `json:"filename"`
	Chunks   int    `json:"chunks"`
	Status   string `json:"status"`
}

// 辅助方法

// GetAllowedKnowledgeBaseSortFields 获取知识库允许的排序字段
func GetAllowedKnowledgeBaseSortFields() []string {
	return []string{"id", "name", "created_at", "updated_at", "documents_count"}
}

// GetAllowedDocumentSortFields 获取文档允许的排序字段
func GetAllowedDocumentSortFields() []string {
	return []string{"id", "title", "file_type", "file_size", "created_at", "updated_at"}
}
