package utils

// SortField 排序字段
type SortField struct {
	Key  string `json:"key" form:"key" validate:"required"` // 排序字段名
	Desc bool   `json:"desc" form:"desc"`                   // true: 降序, false: 升序
}

// PaginationRequest 统一分页请求结构
type PaginationRequest struct {
	Page     int                    `json:"page" form:"page,default=1" validate:"min=1"`                    // 页码
	PageSize int                    `json:"page_size" form:"page_size,default=12" validate:"min=1,max=200"` // 每页条数，默认12
	Sorts    []SortField            `json:"sorts" form:"sorts"`                                             // 排序字段数组
	Filters  map[string]interface{} `json:"filters" form:"filters"`                                         // 筛选条件，每个接口可定义不同结构
}

// PaginationResponse 统一分页响应结构
type PaginationResponse[T any] struct {
	CurrentPage int   `json:"current_page"` // 当前页码
	PageSize    int   `json:"page_size"`    // 每页条数
	TotalItems  int64 `json:"total_items"`  // 总条数
	TotalPages  int   `json:"total_pages"`  // 总页数
	Data        T     `json:"data"`         // 数据，使用泛型支持不同数据结构
}

// NewPaginationResponse 创建分页响应
func NewPaginationResponse[T any](page, pageSize int, totalItems int64, data T) PaginationResponse[T] {
	totalPages := int((totalItems + int64(pageSize) - 1) / int64(pageSize))
	if totalPages < 1 {
		totalPages = 1
	}

	return PaginationResponse[T]{
		CurrentPage: page,
		PageSize:    pageSize,
		TotalItems:  totalItems,
		TotalPages:  totalPages,
		Data:        data,
	}
}

// GetOffset 计算查询偏移量
func (p *PaginationRequest) GetOffset() int {
	return (p.Page - 1) * p.PageSize
}

// GetOrderBy 获取排序SQL字符串
func (p *PaginationRequest) GetOrderBy() string {
	if len(p.Sorts) == 0 {
		return "created_at DESC"
	}

	orderParts := make([]string, len(p.Sorts))
	for i, sort := range p.Sorts {
		direction := "ASC"
		if sort.Desc {
			direction = "DESC"
		}
		orderParts[i] = sort.Key + " " + direction
	}

	return orderParts[0] // 暂时只支持第一个排序字段，可根据需要扩展
}

// ValidateSortField 验证排序字段是否在允许的字段列表中
func ValidateSortField(key string, allowedFields []string) bool {
	for _, allowed := range allowedFields {
		if key == allowed {
			return true
		}
	}
	return false
}

// SetDefaultSort 设置默认排序（如果没有提供排序条件）
func (p *PaginationRequest) SetDefaultSort(key string, desc bool) {
	if len(p.Sorts) == 0 {
		p.Sorts = []SortField{
			{Key: key, Desc: desc},
		}
	}
}
