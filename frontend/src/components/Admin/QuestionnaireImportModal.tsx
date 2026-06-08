/**
 * 问卷导入组件
 * 
 * 功能：
 * - 支持 JSON 文件导入
 * - 支持粘贴 JSON 文本导入
 * - 预览导入数据
 * - 格式验证与错误提示
 */

import React, { useState } from 'react';
import { Modal, Button, Upload, Input, message, Card, List, Tag, Space } from 'antd';
import { UploadOutlined, FileTextOutlined, InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { questionnaireApi } from '@/services/api';
import { useNavigate } from 'react-router-dom';

const { TextArea } = Input;

/**
 * 导入数据接口
 */
interface ImportData {
  title: string;
  description?: string;
  questions: Array<{
    type: string;
    title: string;
    required?: boolean;
    options?: Array<{ text: string; score?: number }>;
    placeholder?: string;
    maxLength?: number;
    maxRating?: number;
  }>;
}

/**
 * 题型映射
 */
const questionTypeLabels: Record<string, { label: string; color: string }> = {
  single_choice: { label: '单选题', color: 'blue' },
  multiple_choice: { label: '多选题', color: 'green' },
  text: { label: '文本题', color: 'orange' },
  rating: { label: '评分题', color: 'purple' },
  date: { label: '日期题', color: 'cyan' },
};

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const QuestionnaireImportModal: React.FC<ImportModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [jsonText, setJsonText] = useState('');
  const [previewData, setPreviewData] = useState<ImportData | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 重置状态
  const resetState = () => {
    setMode('file');
    setJsonText('');
    setPreviewData(null);
    setError(null);
    setImporting(false);
  };

  // 关闭弹窗时重置
  const handleClose = () => {
    resetState();
    onClose();
  };

  // 解析JSON数据
  const parseJsonData = (jsonString: string): { success: boolean; data?: ImportData; error?: string } => {
    try {
      const data = JSON.parse(jsonString);
      
      // 基本验证
      if (!data.title || typeof data.title !== 'string') {
        return { success: false, error: '缺少问卷标题或标题格式错误' };
      }
      
      if (!data.questions || !Array.isArray(data.questions)) {
        return { success: false, error: '缺少题目列表或格式错误' };
      }
      
      if (data.questions.length === 0) {
        return { success: false, error: '问卷至少需要一道题目' };
      }
      
      // 验证每道题目
      for (let i = 0; i < data.questions.length; i++) {
        const q = data.questions[i];
        
        if (!q.type) {
          return { success: false, error: `第 ${i + 1} 题缺少题目类型` };
        }
        
        if (!q.title) {
          return { success: false, error: `第 ${i + 1} 题缺少题目标题` };
        }
        
        // 选择题验证选项
        if ((q.type === 'single_choice' || q.type === 'multiple_choice')) {
          if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
            return { success: false, error: `第 ${i + 1} 题：选择题至少需要2个选项` };
          }
        }
      }
      
      return { success: true, data: data as ImportData };
    } catch (e) {
      return { success: false, error: 'JSON 格式错误，请检查语法' };
    }
  };

  // 文件上传处理
  const handleFileUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess, onError } = options;
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = parseJsonData(text);
        
        if (result.success && result.data) {
          setPreviewData(result.data);
          setError(null);
          onSuccess?.(file);
        } else {
          setError(result.error || '解析失败');
          onError?.(new Error(result.error));
        }
      } catch (err) {
        setError('读取文件失败');
        onError?.(err as Error);
      }
    };
    
    reader.onerror = () => {
      setError('读取文件失败');
      onError?.(new Error('读取文件失败'));
    };
    
    reader.readAsText(file as any);
  };

  // 预览导入数据
  const handlePreview = () => {
    const result = parseJsonData(jsonText);
    
    if (result.success && result.data) {
      setPreviewData(result.data);
      setError(null);
    } else {
      setError(result.error || '解析失败');
      setPreviewData(null);
    }
  };

  // 确认导入
  const handleImport = async () => {
    if (!previewData) {
      message.error('请先预览数据');
      return;
    }

    try {
      setImporting(true);
      
      const response: any = await questionnaireApi.import(previewData);
      
      if (response.success) {
        message.success('问卷导入成功！');
        handleClose();
        onSuccess?.();
        // 跳转到编辑页面
        navigate(`/admin/edit/${response.data._id}`);
      } else {
        message.error(response.message || '导入失败');
      }
    } catch (err: any) {
      message.error(err.response?.data?.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  // 文件上传属性
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.json',
    showUploadList: false,
    customRequest: handleFileUpload,
  };

  return (
    <Modal
      title="导入问卷"
      open={open}
      onCancel={handleClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button
          key="import"
          type="primary"
          loading={importing}
          disabled={!previewData}
          onClick={handleImport}
        >
          确认导入
        </Button>,
      ]}
    >
      {/* 导入方式切换 */}
      <Space style={{ marginBottom: 16 }}>
        <Button
          type={mode === 'file' ? 'primary' : 'default'}
          onClick={() => { setMode('file'); setPreviewData(null); setError(null); }}
          icon={<UploadOutlined />}
        >
          文件导入
        </Button>
        <Button
          type={mode === 'text' ? 'primary' : 'default'}
          onClick={() => { setMode('text'); setPreviewData(null); setError(null); }}
          icon={<FileTextOutlined />}
        >
          粘贴JSON
        </Button>
      </Space>

      {/* 文件导入模式 */}
      {mode === 'file' && (
        <div>
          <Upload.Dragger {...uploadProps} style={{ marginBottom: 16 }}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽上传 JSON 文件</p>
            <p className="ant-upload-hint">支持 .json 格式的问卷文件</p>
          </Upload.Dragger>
          
          <div style={{ marginTop: 16 }}>
            <Button onClick={() => {
              // 生成示例JSON
              const example = {
                title: '示例问卷',
                description: '这是一个示例问卷',
                questions: [
                  {
                    type: 'single_choice',
                    title: '您了解无偿献血吗？',
                    required: true,
                    options: [
                      { text: '非常了解', score: 5 },
                      { text: '了解一些', score: 3 },
                      { text: '不了解', score: 1 },
                    ],
                  },
                  {
                    type: 'multiple_choice',
                    title: '您献血的动机是什么？',
                    required: false,
                    options: [
                      { text: '帮助他人', score: 5 },
                      { text: '免费体检', score: 3 },
                      { text: '社会荣誉', score: 3 },
                      { text: '其他', score: 1 },
                    ],
                  },
                  {
                    type: 'text',
                    title: '您对无偿献血有什么建议？',
                    placeholder: '请输入您的建议...',
                    maxLength: 500,
                  },
                ],
              };
              setJsonText(JSON.stringify(example, null, 2));
              setMode('text');
            }}>
              查看JSON示例
            </Button>
          </div>
        </div>
      )}

      {/* 粘贴JSON模式 */}
      {mode === 'text' && (
        <div>
          <TextArea
            rows={8}
            placeholder="粘贴JSON格式的问卷数据..."
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setPreviewData(null);
              setError(null);
            }}
            style={{ marginBottom: 8 }}
          />
          <Button onClick={handlePreview} disabled={!jsonText.trim()}>
            预览数据
          </Button>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div style={{ color: '#ff4d4f', marginTop: 16 }}>
          {error}
        </div>
      )}

      {/* 预览数据 */}
      {previewData && (
        <Card title="预览" size="small" style={{ marginTop: 16 }}>
          <h3>{previewData.title}</h3>
          {previewData.description && (
            <p style={{ color: '#666' }}>{previewData.description}</p>
          )}
          <List
            size="small"
            dataSource={previewData.questions}
            renderItem={(item, index) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<FileTextOutlined />}
                  title={`${index + 1}. ${item.title}`}
                  description={
                    <Space>
                      <Tag color={questionTypeLabels[item.type]?.color || 'default'}>
                        {questionTypeLabels[item.type]?.label || item.type}
                      </Tag>
                      {item.required && <Tag color="red">必填</Tag>}
                      {item.options && (
                        <span style={{ color: '#888' }}>
                          {item.options.length} 个选项
                        </span>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </Modal>
  );
};

export default QuestionnaireImportModal;
