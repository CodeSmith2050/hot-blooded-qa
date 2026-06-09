/**
 * 模板选择弹窗组件
 * 
 * 功能说明：
 * - 展示预设问卷模板列表
 * - 支持按分类筛选
 * - 预览模板内容
 * - 一键基于模板创建问卷
 * 
 * 使用方式：
 * <TemplateSelectModal 
 *   visible={visible} 
 *   onClose={handleClose}
 *   onSelect={(templateId) => console.log(templateId)}
 * />
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  Card,
  Button,
  Select,
  Space,
  Tag,
  message,
  Spin,
  Empty,
  Collapse,
  Typography,
  Divider,
} from 'antd';
import {
  CheckCircleOutlined,
  FileTextOutlined,
  HeartOutlined,
  CalendarOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { templateApi } from '@/services/api';

const { Option } = Select;
const { Panel } = Collapse;
const { Title, Text } = Typography;

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  'heart': <HeartOutlined />,
  'calendar': <CalendarOutlined />,
  'heart-pulse': <HeartOutlined />,
  'users': <UserOutlined />,
  'file-text': <FileTextOutlined />,
};

// 分类颜色映射
const categoryColors: Record<string, string> = {
  '满意度调研': 'geekblue',
  '活动调研': 'purple',
  '健康调研': 'green',
  '招募调研': 'orange',
};

// 题型显示名称
const questionTypeNames: Record<string, string> = {
  'single': '单选题',
  'multiple': '多选题',
  'text': '填空题',
  'rating': '评分题',
  'matrix': '矩阵题',
};

interface Template {
  _id: string;
  name: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  questions: Array<{
    id: string;
    type: string;
    title: string;
    required: boolean;
    options?: string[];
    ratingMax?: number;
    order: number;
  }>;
  usageCount: number;
  isSystem: boolean;
}

interface TemplateSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const TemplateSelectModal: React.FC<TemplateSelectModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  // 获取模板列表
  useEffect(() => {
    if (visible) {
      fetchTemplates();
    }
  }, [visible, selectedCategory]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response: any = await templateApi.getList(selectedCategory ? { category: selectedCategory } : undefined);
      if (response.success && response.data) {
        setTemplates(response.data);
      }
    } catch (error) {
      message.error('获取模板列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取分类列表
  const categories = [...new Set(templates.map(t => t.category))];

  // 基于模板创建问卷
  const handleCreate = async () => {
    if (!selectedTemplate) {
      message.warning('请先选择一个模板');
      return;
    }

    setCreating(true);
    try {
      const response: any = await templateApi.createQuestionnaire(selectedTemplate._id);
      
      if (response.success) {
        message.success('问卷创建成功！');
        onClose();
        onSuccess?.();
        
        // 使用React Router跳转，保留应用状态
        navigate(`/admin/edit/${response.data._id}`);
      } else {
        message.error(response.message || '创建失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  // 获取问题预览内容
  const renderQuestionPreview = (question: any) => {
    const typeName = questionTypeNames[question.type] || question.type;
    
    return (
      <div key={question.id} style={{ marginBottom: 12, padding: 8, background: '#fafafa', borderRadius: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: '#666' }}>[{typeName}]</span>
          {question.required && <Tag color="red">必填</Tag>}
        </div>
        <Text style={{ fontSize: 13 }}>{question.title}</Text>
        {question.options && question.options.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {question.options.map((opt: string, idx: number) => (
              <div key={idx} style={{ fontSize: 12, color: '#888', paddingLeft: 16 }}>
                {question.type === 'multiple' ? '☐' : '○'} {opt}
              </div>
            ))}
          </div>
        )}
        {question.type === 'rating' && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#888' }}>
            评分范围：1-{question.ratingMax || 5}分
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal
      title="选择问卷模板"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {/* 筛选区域 */}
        <div style={{ marginBottom: 20 }}>
          <Space>
            <span>分类筛选：</span>
            <Select
              value={selectedCategory}
              onChange={setSelectedCategory}
              placeholder="全部分类"
              style={{ width: 160 }}
            >
              <Option value="">全部分类</Option>
              {categories.map(cat => (
                <Option key={cat} value={cat}>{cat}</Option>
              ))}
            </Select>
          </Space>
        </div>

        {/* 模板列表 */}
        {templates.length === 0 ? (
          <Empty description="暂无模板" />
        ) : (
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {templates.map(template => (
              <Card
                key={template._id}
                hoverable
                style={{ marginBottom: 16, cursor: 'pointer' }}
                className={selectedTemplate?._id === template._id ? 'selected' : ''}
                onClick={() => setSelectedTemplate(template)}
                bordered={selectedTemplate?._id === template._id}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <span style={{ fontSize: 24, color: '#1890ff' }}>
                        {iconMap[template.icon] || <FileTextOutlined />}
                      </span>
                      <div>
                        <Title level={4} style={{ margin: 0 }}>{template.name}</Title>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          已使用 {template.usageCount} 次
                        </Text>
                      </div>
                      <Tag color={categoryColors[template.category] || 'default'}>
                        {template.category}
                      </Tag>
                      {template.isSystem && (
                        <Tag color="blue">系统预设</Tag>
                      )}
                    </div>
                    <p style={{ margin: '8px 0', fontSize: 13, color: '#666' }}>
                      {template.description}
                    </p>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      包含 {template.questions.length} 个问题
                    </div>
                  </div>
                  {selectedTemplate?._id === template._id && (
                    <CheckCircleOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                  )}
                </div>

                {/* 问题预览 */}
                {selectedTemplate?._id === template._id && (
                  <div style={{ marginTop: 16 }}>
                    <Divider style={{ margin: '12px 0' }} />
                    <Collapse defaultActiveKey={['1']}>
                      <Panel header={`预览问题（共${template.questions.length}题）`} key="1">
                        {template.questions.map(renderQuestionPreview)}
                      </Panel>
                    </Collapse>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            onClick={handleCreate}
            loading={creating}
            disabled={!selectedTemplate}
          >
            {creating ? '创建中...' : '基于模板创建'}
          </Button>
        </div>
      </Spin>
    </Modal>
  );
};

export default TemplateSelectModal;