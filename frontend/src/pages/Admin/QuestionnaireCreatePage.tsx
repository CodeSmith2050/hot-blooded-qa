/**
 * 创建问卷页面
 * 
 * 功能说明：
 * - 可视化问卷编辑器
 * - 支持多种题型（单选、多选、文本、评分、日期）
 * - 实时预览
 * - 保存草稿或直接发布
 * 
 * 页面布局：
 * - 左侧：题目列表（可拖拽排序）
 * - 右侧：题目编辑面板
 * - 顶部：问卷基本信息 + 操作按钮
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Form,
  Input,
  Button,
  Card,
  Space,
  message,
  Tabs,
  Empty,
  Radio,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  SendOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { questionnaireApi } from '@/services/api';

const { Title } = Typography;
const { TextArea } = Input;

/**
 * 问题类型选项
 */
const questionTypes = [
  { value: 'single_choice', label: '单选题' },
  { value: 'multiple_choice', label: '多选题' },
  { value: 'text', label: '文本题' },
  { value: 'rating', label: '评分题' },
  { value: 'date', label: '日期题' },
];

/**
 * 创建问卷页面
 */
const QuestionnaireCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('edit');
  
  /**
   * 添加新题目
   */
  const handleAddQuestion = () => {
    const newQuestion = {
      id: `q_${Date.now()}`,
      type: 'single_choice',
      title: '',
      required: true,
      options: [
        { id: `o_${Date.now()}_1`, text: '选项1' },
        { id: `o_${Date.now()}_2`, text: '选项2' },
      ],
    };
    setQuestions([...questions, newQuestion]);
  };
  
  /**
   * 更新题目
   * @param index 题目索引
   * @param data 更新数据
   */
  const handleUpdateQuestion = (index: number, data: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...data };
    setQuestions(updated);
  };
  
  /**
   * 删除题目
   * @param index 题目索引
   */
  const handleDeleteQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };
  
  /**
   * 保存问卷
   * @param status 保存状态（draft 草稿 / published 发布）
   */
  const handleSave = async (status: 'draft' | 'published') => {
    try {
      const values = await form.validateFields();
      
      // 验证题目
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
      
      setLoading(true);
      
      const data = {
        ...values,
        status,
        questions: questions.map((q) => ({
          type: q.type,
          title: q.title,
          required: q.required,
          options: q.options,
        })),
      };
      
      const response: any = await questionnaireApi.create(data);
      
      if (response.success) {
        message.success(status === 'published' ? '问卷已发布' : '草稿已保存');
        navigate('/admin/list');
      }
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };
  
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
            创建问卷
          </Title>
        </Space>
        
        <Space>
          <Button
            icon={<SaveOutlined />}
            onClick={() => handleSave('draft')}
            loading={loading}
          >
            保存草稿
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={() => handleSave('published')}
            loading={loading}
          >
            发布问卷
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
            <Input placeholder="请输入问卷标题" maxLength={100} showCount />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="问卷描述"
          >
            <TextArea
              placeholder="请输入问卷描述（可选）"
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Card>
      
      {/* 题目编辑区 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab="编辑题目" key="edit">
          {/* 添加题目按钮 */}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddQuestion}
            block
            style={{ marginBottom: 16 }}
          >
            添加题目
          </Button>
          
          {/* 题目列表 */}
          {questions.length === 0 ? (
            <Empty description="点击上方按钮添加题目" />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }}>
              {questions.map((question, index) => (
                <QuestionEditor
                  key={question.id}
                  index={index}
                  question={question}
                  onUpdate={(data) => handleUpdateQuestion(index, data)}
                  onDelete={() => handleDeleteQuestion(index)}
                />
              ))}
            </Space>
          )}
        </Tabs.TabPane>
        
        <Tabs.TabPane tab="预览" key="preview">
          <QuestionnairePreview
            title={form.getFieldValue('title')}
            description={form.getFieldValue('description')}
            questions={questions}
          />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

/**
 * 题目编辑器组件
 */
interface QuestionEditorProps {
  index: number;
  question: any;
  onUpdate: (data: any) => void;
  onDelete: () => void;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  index,
  question,
  onUpdate,
  onDelete,
}) => {
  return (
    <Card
      title={`题目 ${index + 1}`}
      extra={
        <Button type="text" danger onClick={onDelete}>
          删除
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 题目类型 */}
        <Radio.Group
          value={question.type}
          onChange={(e) => onUpdate({ type: e.target.value })}
          options={questionTypes}
          optionType="button"
          buttonStyle="solid"
        />
        
        {/* 题目标题 */}
        <Input
          placeholder="请输入题目"
          value={question.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
        
        {/* 选项编辑（选择题） */}
        {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
          <Space direction="vertical" style={{ width: '100%' }}>
            {question.options.map((option: any, optIndex: number) => (
              <Space key={option.id}>
                <Input
                  placeholder={`选项 ${optIndex + 1}`}
                  value={option.text}
                  onChange={(e) => {
                    const newOptions = [...question.options];
                    newOptions[optIndex] = { ...option, text: e.target.value };
                    onUpdate({ options: newOptions });
                  }}
                />
                <Button
                  type="text"
                  danger
                  onClick={() => {
                    const newOptions = question.options.filter(
                      (_: any, i: number) => i !== optIndex
                    );
                    onUpdate({ options: newOptions });
                  }}
                >
                  删除
                </Button>
              </Space>
            ))}
            <Button
              type="dashed"
              onClick={() => {
                const newOptions = [
                  ...question.options,
                  { id: `o_${Date.now()}`, text: `选项${question.options.length + 1}` },
                ];
                onUpdate({ options: newOptions });
              }}
            >
              添加选项
            </Button>
          </Space>
        )}
      </Space>
    </Card>
  );
};

/**
 * 问卷预览组件
 */
interface QuestionnairePreviewProps {
  title: string;
  description?: string;
  questions: any[];
}

const QuestionnairePreview: React.FC<QuestionnairePreviewProps> = ({
  title,
  description,
  questions,
}) => {
  return (
    <Card>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Title level={4}>{title || '问卷标题'}</Title>
        {description && <p>{description}</p>}
      </div>
      
      {questions.map((question, index) => (
        <div key={question.id} style={{ marginBottom: 16 }}>
          <p>
            {index + 1}. {question.title || '未命名题目'}
            {question.required && <span style={{ color: 'red' }}> *</span>}
          </p>
          
          {question.type === 'single_choice' && (
            <Radio.Group>
              {question.options.map((option: any) => (
                <Radio key={option.id} value={option.id}>
                  {option.text}
                </Radio>
              ))}
            </Radio.Group>
          )}
          
          {question.type === 'multiple_choice' && (
            <Space direction="vertical">
              {question.options.map((option: any) => (
                <Radio key={option.id} checked={false}>
                  {option.text}
                </Radio>
              ))}
            </Space>
          )}
          
          {question.type === 'text' && (
            <Input.TextArea placeholder="请输入您的回答" rows={3} disabled />
          )}
        </div>
      ))}
    </Card>
  );
};

export default QuestionnaireCreatePage;