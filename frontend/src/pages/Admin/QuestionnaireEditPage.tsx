/**
 * 编辑问卷页面
 * 
 * 功能说明：
 * - 加载已有问卷数据
 * - 复用创建页的可视化编辑器
 * - 支持修改问卷信息和题目
 * - 保存修改
 * 
 * 与创建页面类似，但会预填充数据
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Space,
  message,
  Tabs,
  Empty,
  Switch,
  InputNumber,
  DatePicker,
  Rate,
  Checkbox,
  Radio,
  Divider,
  Typography,
  Tooltip,
  Spin,
  Tag,
} from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  DeleteOutlined,
  HolderOutlined,
  CopyOutlined,
  EyeOutlined,
  EditOutlined,
  CheckCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { questionnaireApi } from '@/services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ==================== 题型配置 ====================

/**
 * 问题类型配置
 */
const questionTypeConfig: Record<string, {
  label: string;
  description: string;
  defaultOptions?: { id: string; text: string; score: number }[];
  defaultConfig?: {
    placeholder?: string;
    maxLength?: number;
    maxRating?: number;
  };
}> = {
  single_choice: {
    label: '单选题',
    description: '只有一个正确答案',
    defaultOptions: [
      { id: 'opt_1', text: '选项 A', score: 0 },
      { id: 'opt_2', text: '选项 B', score: 0 },
    ],
  },
  multiple_choice: {
    label: '多选题',
    description: '可以有多个答案',
    defaultOptions: [
      { id: 'opt_1', text: '选项 A', score: 0 },
      { id: 'opt_2', text: '选项 B', score: 0 },
      { id: 'opt_3', text: '选项 C', score: 0 },
    ],
  },
  text: {
    label: '文本题',
    description: '自由输入文本答案',
    defaultConfig: {
      placeholder: '请输入您的回答',
      maxLength: 500,
    },
  },
  rating: {
    label: '评分题',
    description: '1-5星评分',
    defaultConfig: {
      maxRating: 5,
    },
  },
  date: {
    label: '日期题',
    description: '选择日期',
    defaultConfig: {},
  },
};

// ==================== 题目接口 ====================

interface QuestionOption {
  id: string;
  text: string;
  score?: number;
}

interface Question {
  id: string;
  type: keyof typeof questionTypeConfig;
  title: string;
  required: boolean;
  options?: QuestionOption[];
  placeholder?: string;
  maxLength?: number;
  maxRating?: number;
}

// ==================== 主组件 ====================

/**
 * 编辑问卷页面
 */
const QuestionnaireEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  // 状态管理
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeTab, setActiveTab] = useState('edit');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [questionnaireStatus, setQuestionnaireStatus] = useState<string>('draft');
  
  // ==================== 数据加载 ====================
  
  /**
   * 加载问卷数据
   */
  useEffect(() => {
    const fetchQuestionnaire = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const response: any = await questionnaireApi.getById(id);
        
        if (response.success && response.data) {
          const data = response.data;
          
          // 设置基本信息
          form.setFieldsValue({
            title: data.title,
            description: data.description,
          });
          
          // 设置问卷状态
          setQuestionnaireStatus(data.status);
          
          // 转换题目数据格式
          const convertedQuestions: Question[] = data.questions.map((q: any, index: number) => ({
            id: `q_${index}_${Date.now()}`,
            type: q.type,
            title: q.title,
            required: q.required,
            options: q.options?.map((opt: any, optIndex: number) => ({
              id: `opt_${index}_${optIndex}_${Date.now()}`,
              text: opt.text,
              score: opt.score || 0,
            })),
            placeholder: q.placeholder,
            maxLength: q.maxLength,
            maxRating: q.maxRating,
          }));
          
          setQuestions(convertedQuestions);
        } else {
          message.error('问卷不存在');
          navigate('/admin/list');
        }
      } catch (error) {
        message.error('加载问卷失败');
        navigate('/admin/list');
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionnaire();
  }, [id, form, navigate]);
  
  // ==================== 题目操作方法 ====================
  
  /**
   * 生成唯一ID
   */
  const generateId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  /**
   * 添加新题目
   */
  const handleAddQuestion = (type: keyof typeof questionTypeConfig = 'single_choice') => {
    const config = questionTypeConfig[type];
    
    const newQuestion: Question = {
      id: generateId(),
      type,
      title: '',
      required: true,
      ...(type === 'single_choice' || type === 'multiple_choice' 
        ? { options: config.defaultOptions?.map((opt, i) => ({
            ...opt,
            id: `opt_${Date.now()}_${i}`,
          })) }
        : {}),
      ...(type === 'text' ? { 
        placeholder: config.defaultConfig?.placeholder,
        maxLength: config.defaultConfig?.maxLength,
      } : {}),
      ...(type === 'rating' ? { maxRating: config.defaultConfig?.maxRating } : {}),
    };
    
    setQuestions([...questions, newQuestion]);
    message.success(`已添加 ${config.label}`);
  };
  
  /**
   * 更新题目
   */
  const handleUpdateQuestion = useCallback((index: number, data: Partial<Question>) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...data };
      return updated;
    });
  }, []);
  
  /**
   * 删除题目
   */
  const handleDeleteQuestion = (index: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
    message.success('题目已删除');
  };
  
  /**
   * 复制题目
   */
  const handleCopyQuestion = (index: number) => {
    const question = questions[index];
    const copied: Question = {
      ...question,
      id: generateId(),
      title: question.title + '（副本）',
      options: question.options?.map(opt => ({
        ...opt,
        id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      })),
    };
    setQuestions([...questions.slice(0, index + 1), copied, ...questions.slice(index + 1)]);
    message.success('题目已复制');
  };
  
  /**
   * 移动题目（拖拽排序）
   */
  const handleMoveQuestion = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    
    const updated = [...questions];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setQuestions(updated);
  };
  
  /**
   * 添加选项（选择题）
   */
  const handleAddOption = (questionIndex: number) => {
    const question = questions[questionIndex];
    if (!question.options) return;
    
    const newOption: QuestionOption = {
      id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: `选项 ${question.options.length + 1}`,
      score: 0,
    };
    
    handleUpdateQuestion(questionIndex, {
      options: [...question.options, newOption],
    });
  };
  
  /**
   * 更新选项
   */
  const handleUpdateOption = (questionIndex: number, optionIndex: number, text: string) => {
    const question = questions[questionIndex];
    if (!question.options) return;
    
    const updatedOptions = [...question.options];
    updatedOptions[optionIndex] = { ...updatedOptions[optionIndex], text };
    
    handleUpdateQuestion(questionIndex, { options: updatedOptions });
  };
  
  /**
   * 删除选项
   */
  const handleDeleteOption = (questionIndex: number, optionIndex: number) => {
    const question = questions[questionIndex];
    if (!question.options || question.options.length <= 2) {
      message.warning('选择题至少需要2个选项');
      return;
    }
    
    const updatedOptions = question.options.filter((_, i) => i !== optionIndex);
    handleUpdateQuestion(questionIndex, { options: updatedOptions });
  };
  
  // ==================== 拖拽处理 ====================
  
  const handleDragStart = (index: number) => setDragIndex(index);
  
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex !== null) {
      handleMoveQuestion(dragIndex, index);
      setDragIndex(null);
    }
  };
  
  const handleDragEnd = () => setDragIndex(null);
  
  // ==================== 保存问卷 ====================
  
  /**
   * 保存修改
   */
  const handleSave = async () => {
    try {
      // 验证基本信息
      const values = await form.validateFields();
      
      // 验证题目数量
      if (questions.length === 0) {
        message.error('请至少添加一道题目');
        return;
      }
      
      // 验证题目内容
      const invalidQuestions = questions.filter((q) => !q.title.trim());
      if (invalidQuestions.length > 0) {
        message.error('请填写所有题目的标题');
        return;
      }
      
      // 验证选择题选项
      const choiceQuestions = questions.filter(
        q => q.type === 'single_choice' || q.type === 'multiple_choice'
      );
      for (const q of choiceQuestions) {
        const emptyOptions = q.options?.filter(opt => !opt.text.trim());
        if (emptyOptions && emptyOptions.length > 0) {
          message.error(`题目"${q.title}"存在空白选项，请填写完整`);
          return;
        }
      }
      
      setSaving(true);
      
      // 构建提交数据
      const data = {
        title: values.title,
        description: values.description || '',
        questions: questions.map((q) => ({
          type: q.type,
          title: q.title,
          required: q.required,
          ...(q.options ? { options: q.options } : {}),
          ...(q.placeholder ? { placeholder: q.placeholder } : {}),
          ...(q.maxLength ? { maxLength: q.maxLength } : {}),
          ...(q.maxRating ? { maxRating: q.maxRating } : {}),
        })),
      };
      
      const response: any = await questionnaireApi.update(id!, data);
      
      if (response.success) {
        message.success('问卷已更新');
        navigate('/admin/list');
      } else {
        message.error(response.message || '保存失败');
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写问卷标题');
      } else {
        message.error('保存失败，请稍后重试');
      }
    } finally {
      setSaving(false);
    }
  };
  
  // ==================== 加载中状态 ====================
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载问卷数据..." />
      </div>
    );
  }
  
  // ==================== 渲染 ====================
  
  return (
    <div>
      {/* 页面头部 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/admin/list')}
          >
            返回
          </Button>
          <Title level={3} style={{ margin: 0 }}>
            编辑问卷
          </Title>
          {/* 状态标签 */}
          <Tag color={questionnaireStatus === 'published' ? 'green' : 'orange'}>
            {questionnaireStatus === 'published' ? '已发布' : '草稿'}
          </Tag>
        </Space>
        
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            保存修改
          </Button>
        </Space>
      </div>
      
      {/* 问卷基本信息 */}
      <Card style={{ marginBottom: 24 }}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="问卷标题"
            rules={[{ required: true, message: '请输入问卷标题' }]}
          >
            <Input 
              placeholder="例如：无偿献血人群满意度调查" 
              maxLength={100} 
              showCount 
              size="large"
            />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="问卷描述"
          >
            <TextArea
              placeholder="请输入问卷说明，帮助填写者了解问卷目的..."
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Card>
      
      {/* 题目编辑区 */}
      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        items={[
          {
            key: 'edit',
            label: <span><EditOutlined /> 编辑题目</span>,
            children: (
              <QuestionEditPanel
                questions={questions}
                onAddQuestion={handleAddQuestion}
                onUpdateQuestion={handleUpdateQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                onCopyQuestion={handleCopyQuestion}
                onAddOption={handleAddOption}
                onUpdateOption={handleUpdateOption}
                onDeleteOption={handleDeleteOption}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                dragIndex={dragIndex}
              />
            ),
          },
          {
            key: 'preview',
            label: <span><EyeOutlined /> 预览问卷</span>,
            children: (
              <QuestionPreviewPanel
                title={form.getFieldValue('title')}
                description={form.getFieldValue('description')}
                questions={questions}
              />
            ),
          },
        ]}
      />
    </div>
  );
};

// ==================== 题目编辑面板组件 ====================

interface QuestionEditPanelProps {
  questions: Question[];
  onAddQuestion: (type?: keyof typeof questionTypeConfig) => void;
  onUpdateQuestion: (index: number, data: Partial<Question>) => void;
  onDeleteQuestion: (index: number) => void;
  onCopyQuestion: (index: number) => void;
  onAddOption: (questionIndex: number) => void;
  onUpdateOption: (questionIndex: number, optionIndex: number, text: string) => void;
  onDeleteOption: (questionIndex: number, optionIndex: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
  dragIndex: number | null;
}

/**
 * 题目编辑面板
 */
const QuestionEditPanel: React.FC<QuestionEditPanelProps> = ({
  questions,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onCopyQuestion,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  dragIndex,
}) => {
  return (
    <div>
      {/* 添加题目按钮组 */}
      <Card style={{ marginBottom: 16 }}>
        <Text strong>添加题目：</Text>
        <Divider style={{ margin: '12px 0' }} />
        <Space wrap>
          {Object.entries(questionTypeConfig).map(([type, config]) => (
            <Button
              key={type}
              icon={<PlusOutlined />}
              onClick={() => onAddQuestion(type as keyof typeof questionTypeConfig)}
            >
              {config.label}
            </Button>
          ))}
        </Space>
      </Card>
      
      {/* 题目列表 */}
      {questions.length === 0 ? (
        <Empty
          description="暂无题目，请点击上方按钮添加"
          style={{ padding: '60px 0' }}
        />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {questions.map((question, index) => (
            <QuestionItem
              key={question.id}
              question={question}
              index={index}
              onUpdate={(data) => onUpdateQuestion(index, data)}
              onDelete={() => onDeleteQuestion(index)}
              onCopy={() => onCopyQuestion(index)}
              onAddOption={() => onAddOption(index)}
              onUpdateOption={(optIdx, text) => onUpdateOption(index, optIdx, text)}
              onDeleteOption={(optIdx) => onDeleteOption(index, optIdx)}
              onDragStart={() => onDragStart(index)}
              onDragOver={onDragOver}
              onDrop={(e) => onDrop(e, index)}
              onDragEnd={onDragEnd}
              isDragging={dragIndex === index}
              isDropTarget={dragIndex !== null && dragIndex !== index}
            />
          ))}
        </Space>
      )}
    </div>
  );
};

// ==================== 单个题目组件 ====================

interface QuestionItemProps {
  question: Question;
  index: number;
  onUpdate: (data: Partial<Question>) => void;
  onDelete: () => void;
  onCopy: () => void;
  onAddOption: () => void;
  onUpdateOption: (optionIndex: number, text: string) => void;
  onDeleteOption: (optionIndex: number) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
}

/**
 * 单个题目编辑卡片
 */
const QuestionItem: React.FC<QuestionItemProps> = ({
  question,
  index,
  onUpdate,
  onDelete,
  onCopy,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDropTarget,
}) => {
  const config = questionTypeConfig[question.type];
  
  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{
        opacity: isDragging ? 0.5 : 1,
        border: isDropTarget ? '2px dashed #1890ff' : undefined,
        transition: 'all 0.2s',
      }}
    >
      {/* 题目头部 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <HolderOutlined style={{ cursor: 'grab', marginRight: 8, color: '#999' }} />
        <Text strong style={{ marginRight: 8 }}>Q{index + 1}</Text>
        <Text type="secondary" style={{ marginRight: 16 }}>[{config.label}]</Text>
        <Space>
          <Text type="secondary">必填</Text>
          <Switch
            checked={question.required}
            onChange={(checked) => onUpdate({ required: checked })}
            size="small"
          />
        </Space>
        <div style={{ marginLeft: 'auto' }}>
          <Space>
            <Tooltip title="复制题目">
              <Button type="text" icon={<CopyOutlined />} onClick={onCopy} size="small" />
            </Tooltip>
            <Tooltip title="删除题目">
              <Button type="text" danger icon={<DeleteOutlined />} onClick={onDelete} size="small" />
            </Tooltip>
          </Space>
        </div>
      </div>
      
      {/* 题目标题 */}
      <Input
        placeholder="请输入题目内容"
        value={question.title}
        onChange={(e) => onUpdate({ title: e.target.value })}
        size="large"
        style={{ marginBottom: 16 }}
      />
      
      {/* 选项编辑（选择题） */}
      {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
        <div>
          <Text type="secondary" style={{ marginBottom: 8 }}>选项列表：</Text>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {question.options?.map((option, optIndex) => (
              <div key={option.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text>{String.fromCharCode(65 + optIndex)}.</Text>
                <Input
                  placeholder={`选项 ${String.fromCharCode(65 + optIndex)}`}
                  value={option.text}
                  onChange={(e) => onUpdateOption(optIndex, e.target.value)}
                  style={{ flex: 1 }}
                />
                {question.options && question.options.length > 2 && (
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => onDeleteOption(optIndex)} size="small" />
                )}
              </div>
            ))}
            <Button type="dashed" icon={<PlusOutlined />} onClick={onAddOption} block style={{ marginTop: 8 }}>
              添加选项
            </Button>
          </Space>
        </div>
      )}
      
      {/* 文本题配置 */}
      {question.type === 'text' && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Input
            placeholder="输入提示文字（可选）"
            value={question.placeholder}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text type="secondary">最大字数：</Text>
            <InputNumber
              min={10}
              max={2000}
              value={question.maxLength}
              onChange={(value) => onUpdate({ maxLength: value || 500 })}
            />
          </div>
        </Space>
      )}
      
      {/* 评分题配置 */}
      {question.type === 'rating' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text type="secondary">最高评分：</Text>
          <InputNumber
            min={3}
            max={10}
            value={question.maxRating}
            onChange={(value) => onUpdate({ maxRating: value || 5 })}
          />
          <Text type="secondary">星</Text>
        </div>
      )}
    </Card>
  );
};

// ==================== 预览面板组件 ====================

interface QuestionPreviewPanelProps {
  title?: string;
  description?: string;
  questions: Question[];
}

/**
 * 问卷预览面板
 */
const QuestionPreviewPanel: React.FC<QuestionPreviewPanelProps> = ({
  title,
  description,
  questions,
}) => {
  return (
    <Card>
      {/* 问卷标题 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={3}>{title || '问卷标题'}</Title>
        {description && (
          <Text type="secondary" style={{ fontSize: 14 }}>{description}</Text>
        )}
      </div>
      
      {/* 题目列表 */}
      {questions.length === 0 ? (
        <Empty description="暂无题目" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {questions.map((question, index) => (
            <div key={question.id}>
              {/* 题目标题 */}
              <div style={{ marginBottom: 12 }}>
                <Text strong>{index + 1}. {question.title || '未命名题目'}</Text>
                {question.required && <Text type="danger" style={{ marginLeft: 4 }}>*</Text>}
              </div>
              
              {/* 题目内容 */}
              {question.type === 'single_choice' && (
                <Radio.Group disabled>
                  <Space direction="vertical">
                    {question.options?.map((option) => (
                      <Radio key={option.id} value={option.id}>{option.text}</Radio>
                    ))}
                  </Space>
                </Radio.Group>
              )}
              
              {question.type === 'multiple_choice' && (
                <Checkbox.Group disabled>
                  <Space direction="vertical">
                    {question.options?.map((option) => (
                      <Checkbox key={option.id} value={option.id}>{option.text}</Checkbox>
                    ))}
                  </Space>
                </Checkbox.Group>
              )}
              
              {question.type === 'text' && (
                <TextArea
                  placeholder={question.placeholder || '请输入您的回答'}
                  maxLength={question.maxLength}
                  rows={4}
                  disabled
                  showCount
                />
              )}
              
              {question.type === 'rating' && (
                <Rate count={question.maxRating || 5} disabled />
              )}
              
              {question.type === 'date' && (
                <DatePicker style={{ width: '100%' }} disabled />
              )}
            </div>
          ))}
          
          {/* 提交按钮（预览） */}
          <Divider />
          <div style={{ textAlign: 'center' }}>
            <Button type="primary" size="large" disabled>
              <CheckCircleOutlined /> 提交问卷
            </Button>
            <Text type="secondary" style={{ marginLeft: 8 }}>（预览模式）</Text>
          </div>
        </Space>
      )}
    </Card>
  );
};

export default QuestionnaireEditPage;