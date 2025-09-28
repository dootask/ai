# 文档上传修复说明

## 问题描述
上传 docx 文档时，前端读取的内容出现乱码报错。

## 解决方案
修改文档上传流程，前端不再解析文档内容，直接将文档传到 Go 后端，Go 后端再将文档传到 Python 服务。

## 修改内容

### 1. 后端修改 (backend/go-service/routes/api/knowledge-bases/routes.go)

#### 主要变更：
- 将 `UploadDocument` 函数从接收 JSON 请求改为接收 `multipart/form-data` 请求
- 直接处理上传的文件，不再依赖前端解析的内容
- 添加文件类型和大小验证
- 添加辅助函数：`getFileTypeFromName` 和 `contains`

#### 新增功能：
- 支持的文件类型：pdf, docx, doc, md, txt
- 文件大小限制：50MB
- 文件类型自动识别

### 2. 前端修改

#### API 层修改 (lib/api/knowledge-bases.ts)：
- 修改 `uploadDocument` 方法，直接接收 `File` 对象
- 使用 `FormData` 和 `multipart/form-data` 上传文件
- 移除不再使用的 `DocumentFormData` 类型和相关函数

#### 页面修改 (app/knowledge/[id]/page.tsx)：
- 简化 `handleFileUpload` 函数
- 移除文件内容解析逻辑（`file.text()`）
- 直接传递 `File` 对象给 API

## 技术优势

1. **解决乱码问题**：不再在前端解析二进制文件内容
2. **更好的性能**：减少前端内存占用和处理时间
3. **更安全**：文件验证在后端进行
4. **更稳定**：避免前端解析各种文件格式的复杂性

## 使用方法

用户现在可以直接上传以下格式的文档：
- PDF 文件 (.pdf)
- Word 文档 (.docx, .doc)
- Markdown 文件 (.md)
- 文本文件 (.txt)

文件会直接传输到后端，由 Python AI 服务进行内容解析和向量化处理。

## 测试建议

1. 测试上传不同格式的文档
2. 测试大文件上传（接近50MB限制）
3. 测试不支持的文件格式
4. 验证文档处理状态更新是否正常