/**
 * 问卷填写页面
 * 
 * 功能说明：
 * - 公开访问，无需登录
 * - 展示问卷题目
 * - 收集用户答案
 * - 提交答案
 * 
 * 页面布局：
 * - 顶部：问卷标题和描述
 * - 中部：题目列表
 * - 底部：提交按钮
 */

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Radio,
  Checkbox,
  Rate,
  DatePicker,
  Button,
  Spin,
  message,
  Typography,
  Empty,
} from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { questionnaireApi, answerApi } from '@/services/api';

const { Title, Text } = Typography;
const { TextArea } = Input;

/**
 * 问卷填写页面
 */
const QuestionnaireFillPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  
  /**
   * 加载问卷数据
   */
  useEffect(() => {
    const fetchQuestionnaire = async () => {
      if (!id) return;
      
      try {
        const response: any = await questionnaireApi.getById(id);
        if (response.success) {
          setQuestionnaire(response.data);
        } else {
          message.error('问卷不存在或已关闭');
        }
      } catch (error) {
        message.error('加载问卷失败');
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionnaire();
  }, [id]);
  
  /**
   * 提交答案
   * @param values 表单数据
   */
  const handleSubmit = async (values: any) => {
    if (!id) return;
    
    setSubmitting(true);
    
    try {
      // 构建答案数据
      const answers = questionnaire.questions.map((question: any) => ({
        questionId: question._id || question.id,
        value: values[question._id || question.id],
      }));
      
      const response: any = await answerApi.submit(id, { answers });
      
      if (response.success) {
        message.success('提交成功，感谢您的参与！');
        setSubmitted(true);
      } else {
        message.error(response.message || '提交失败');
      }
    } catch (error) {
      message.error('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }
  
  if (!questionnaire) {
    return <Empty description="问卷不存在" />;
  }
  
  // 已提交成功
  if (submitted) {
    return (
      <Card style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Title level={3}>提交成功</Title>
        <Text>感谢您的参与！</Text>
      </Card>
    );
  }
  
  return (
    <Card>
      {/* 问卷标题 */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <Title level={3}>{questionnaire.title}</Title>
        {questionnaire.description && (
          <Text type="secondary">{questionnaire.description}</Text>
        )}
      </div>
      
      {/* 问卷表单 */}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
      >
        {questionnaire.questions.map((question: any, index: number) => (
          <Form.Item
            key={question._id || question.id}
            name={question._id || question.id}
            label={
              <span>
                {index + 1}. {question.title}
                {question.required && (
                  <span style={{ color: 'red', marginLeft: 4 }}>*</span>
                )}
              </span>
            }
            rules={
              question.required
                ? [{ required: true, message: '请回答此题' }]
                : []
            }
          >
            {/* 单选题 */}
            {question.type === 'single_choice' && (
              <Radio.Group>
                {question.options.map((option: any) => (
                  <Radio key={option.id || option._id} value={option.id || option._id}>
                    {option.text}
                  </Radio>
                ))}
              </Radio.Group>
            )}
            
            {/* 多选题 */}
            {question.type === 'multiple_choice' && (
              <Checkbox.Group>
                {question.options.map((option: any) => (
                  <Checkbox key={option.id || option._id} value={option.id || option._id}>
                    {option.text}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            )}
            
            {/* 文本题 */}
            {question.type === 'text' && (
              <TextArea
                rows={4}
                placeholder={question.placeholder || '请输入您的回答'}
                maxLength={question.maxLength}
                showCount={!!question.maxLength}
              />
            )}
            
            {/* 评分题 */}
            {question.type === 'rating' && (
              <Rate count={5} />
            )}
            
            {/* 日期题 */}
            {question.type === 'date' && (
              <DatePicker style={{ width: '100%' }} />
            )}
          </Form.Item>
        ))}
        
        {/* 提交按钮 */}
        <Form.Item style={{ textAlign: 'center', marginTop: 32 }}>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            icon={<SendOutlined />}
            loading={submitting}
            style={{ width: 200 }}
          >
            提交问卷
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default QuestionnaireFillPage;