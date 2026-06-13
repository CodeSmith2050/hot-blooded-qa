/**
 * 问卷填写页面
 * 
 * 功能说明：
 * - 公开访问，无需登录
 * - 展示问卷题目
 * - 收集用户答案
 * - 提交答案
 * - 移动端适配
 * - 微信环境兼容
 * 
 * 页面布局：
 * - 顶部：问卷标题和描述
 * - 中部：题目列表（分步或单页）
 * - 底部：提交按钮
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
  Result,
  Progress,
  Space,
  Divider,
} from 'antd';
import {
  SendOutlined,
  CheckCircleOutlined,
  LeftOutlined,
  RightOutlined,
  EyeOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { questionnaireApi, answerApi } from '@/services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ==================== 设备检测 ====================

/**
 * 检测设备类型
 * @returns 设备类型（mobile/tablet/desktop）
 */
const detectDevice = (): 'mobile' | 'tablet' | 'desktop' => {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
};

/**
 * 检测是否在微信环境
 * @returns 是否在微信中打开
 */
const isWechat = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('micromessenger');
};

// ==================== 主组件 ====================

/**
 * 问卷填写页面
 */
const QuestionnaireFillPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  
  // 预览模式：从URL参数获取
  const isPreviewMode = searchParams.get('preview') === 'true';
  
  // 状态管理
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 当前题目索引（分步模式）
  const [stepMode, setStepMode] = useState(false); // 是否分步模式
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>(detectDevice());
  const [isWechatEnv, setIsWechatEnv] = useState(isWechat());
  
  // ==================== 初始化 ====================
  
  /**
   * 监听窗口大小变化
   */
  useEffect(() => {
    const handleResize = () => {
      const newDeviceType = detectDevice();
      setDeviceType(newDeviceType);
      
      // 移动端自动切换分步模式
      if (newDeviceType === 'mobile' && questionnaire?.questions?.length > 3) {
        setStepMode(true);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [questionnaire]);
  
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
          
          // 检查问卷状态（预览模式跳过状态检查）
          if (!isPreviewMode && data.status !== 'published') {
            message.warning('问卷尚未发布或已关闭');
            return;
          }
          
          setQuestionnaire(data);
          
          // 移动端且题目较多时，自动启用分步模式
          if (deviceType === 'mobile' && data.questions?.length > 3) {
            setStepMode(true);
          }
        } else {
          message.error('问卷不存在或已关闭');
        }
      } catch (error) {
        message.error('加载问卷失败，请检查网络连接');
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuestionnaire();
  }, [id, deviceType, isPreviewMode]);
  
  // ==================== 表单操作 ====================
  
  /**
   * 获取当前题目
   */
  const getCurrentQuestion = useCallback(() => {
    if (!questionnaire?.questions) return null;
    return questionnaire.questions[currentStep];
  }, [questionnaire, currentStep]);
  
  /**
   * 下一题
   */
  const handleNext = async () => {
    const question = getCurrentQuestion();
    if (!question) return;
    
    try {
      // 验证当前题目
      const fieldName = question._id || question.id;
      const value = form.getFieldValue(fieldName);
      
      if (question.required && !value) {
        message.warning('请完成此题后再继续');
        return;
      }
      
      setCurrentStep(prev => Math.min(prev + 1, questionnaire.questions.length - 1));
    } catch (error) {
      message.error('请完成此题后再继续');
    }
  };
  
  /**
   * 上一题
   */
  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };
  
  /**
   * 提交答案
   */
  const handleSubmit = async () => {
    if (!id || !questionnaire) return;
    
    try {
      // 验证所有必填题
      const values = await form.validateFields();
      
      setSubmitting(true);
      
      // 构建答案数据
      const answers = questionnaire.questions.map((question: any) => {
        const fieldName = question._id || question.id;
        const value = values[fieldName];
        
        return {
          questionId: fieldName,
          value: value,
        };
      });
      
      // 检测设备信息
      const deviceInfo = {
        type: deviceType,
        isWechat: isWechatEnv,
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
      };
      
      const response: any = await answerApi.submit(id, {
        answers,
        deviceInfo,
      });
      
      if (response.success) {
        message.success('提交成功，感谢您的参与！');
        setSubmitted(true);
      } else {
        message.error(response.message || '提交失败，请稍后重试');
      }
    } catch (error: any) {
      if (error.errorFields) {
        // 有未填写的必填题
        const firstError = error.errorFields[0];
        message.error(`请完成所有必填题目`);
        
        // 如果是分步模式，跳转到第一个未完成的题目
        if (stepMode) {
          const questionIndex = questionnaire.questions.findIndex(
            (q: any) => (q._id || q.id) === firstError.name[0]
          );
          if (questionIndex >= 0) {
            setCurrentStep(questionIndex);
          }
        }
      } else {
        message.error('提交失败，请稍后重试');
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  // ==================== 渲染 ====================
  
  // 加载中
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '20px',
      }}>
        <Spin size="large" tip="加载问卷..." />
      </div>
    );
  }
  
  // 问卷不存在或已关闭
  if (!questionnaire) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '20px',
      }}>
        <Empty
          description="问卷不存在或已关闭"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }
  
  // 已提交
  if (submitted) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '20px',
      }}>
        <Result
          status="success"
          title="提交成功"
          subTitle="感谢您的参与！您的回答已成功提交。"
          icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
        />
      </div>
    );
  }
  
  // 计算进度
  const totalQuestions = questionnaire.questions?.length || 0;
  const progress = stepMode 
    ? ((currentStep + 1) / totalQuestions) * 100 
    : 100;
  
  return (
    <div style={{
      minHeight: '100vh',
      padding: deviceType === 'mobile' ? '16px' : '24px',
      backgroundColor: '#f5f5f5',
    }}>
      {/* 预览模式提示 */}
      {isPreviewMode && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
          marginBottom: 16,
          padding: '8px 16px',
          backgroundColor: '#faad14',
          color: '#fff',
          borderRadius: 4,
        }}>
          <div>
            <EyeOutlined style={{ marginRight: 8 }} />
            <Text style={{ color: '#fff' }}>预览模式 - 仅展示问卷效果，不可提交</Text>
          </div>
          <Button
            type="link"
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => window.close()}
            style={{ color: '#fff', padding: '4px 8px' }}
          >
            关闭预览
          </Button>
        </div>
      )}
      
      {/* 微信环境提示 */}
      {isWechatEnv && !isPreviewMode && (
        <div style={{
          textAlign: 'center',
          marginBottom: 16,
          padding: '8px 16px',
          backgroundColor: '#07c160',
          color: '#fff',
          borderRadius: 4,
        }}>
          <Text style={{ color: '#fff' }}>微信环境访问，体验更佳</Text>
        </div>
      )}
      
      {/* 问卷卡片 */}
      <Card
        style={{
          maxWidth: deviceType === 'mobile' ? '100%' : '800px',
          margin: '0 auto',
          borderRadius: deviceType === 'mobile' ? 8 : 12,
        }}
      >
        {/* 问卷标题 */}
        <div style={{
          textAlign: 'center',
          marginBottom: 24,
          padding: deviceType === 'mobile' ? '16px 0' : '24px 0',
        }}>
          <Title 
            level={deviceType === 'mobile' ? 4 : 3}
            style={{ marginBottom: 8 }}
          >
            {questionnaire.title}
          </Title>
          
          {questionnaire.description && (
            <Paragraph
              type="secondary"
              style={{
                fontSize: deviceType === 'mobile' ? 14 : 16,
                marginBottom: 0,
              }}
            >
              {questionnaire.description}
            </Paragraph>
          )}
        </div>
        
        {/* 进度条（分步模式） */}
        {stepMode && (
          <div style={{ marginBottom: 24 }}>
            <Progress
              percent={progress}
              showInfo={false}
              strokeColor="#1890ff"
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
            }}>
              <Text type="secondary">
                第 {currentStep + 1} 题 / 共 {totalQuestions} 题
              </Text>
              <Text type="secondary">
                {Math.round(progress)}% 完成
              </Text>
            </div>
          </div>
        )}
        
        <Divider />
        
        {/* 题目列表 */}
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
        >
          {stepMode ? (
            // 分步模式：只显示当前题目
            <QuestionItem
              question={getCurrentQuestion()}
              index={currentStep}
              deviceType={deviceType}
            />
          ) : (
            // 单页模式：显示所有题目
            questionnaire.questions.map((question: any, index: number) => (
              <QuestionItem
                key={question._id || question.id}
                question={question}
                index={index}
                deviceType={deviceType}
              />
            ))
          )}
        </Form>
        
        <Divider />
        
        {/* 操作按钮 */}
        <div style={{
          display: 'flex',
          justifyContent: stepMode ? 'space-between' : 'center',
          gap: 16,
        }}>
          {/* 分步模式：上一题/下一题按钮 */}
          {stepMode && (
            <Button
              size={deviceType === 'mobile' ? 'large' : 'middle'}
              icon={<LeftOutlined />}
              onClick={handlePrev}
              disabled={currentStep === 0}
            >
              上一题
            </Button>
          )}
          
          {/* 提交按钮（预览模式隐藏） */}
          {!isPreviewMode && (!stepMode || currentStep === totalQuestions - 1) ? (
            <Button
              type="primary"
              size={deviceType === 'mobile' ? 'large' : 'middle'}
              icon={<SendOutlined />}
              onClick={handleSubmit}
              loading={submitting}
              block={deviceType === 'mobile'}
              style={{
                minWidth: deviceType === 'mobile' ? '100%' : '200px',
              }}
            >
              提交问卷
            </Button>
          ) : !isPreviewMode && (
            <Button
              type="primary"
              size={deviceType === 'mobile' ? 'large' : 'middle'}
              icon={<RightOutlined />}
              onClick={handleNext}
            >
              下一题
            </Button>
          )}
          
          {/* 预览模式：只显示导航按钮 */}
          {isPreviewMode && stepMode && currentStep < totalQuestions - 1 && (
            <Button
              type="primary"
              size={deviceType === 'mobile' ? 'large' : 'middle'}
              icon={<RightOutlined />}
              onClick={handleNext}
            >
              下一题
            </Button>
          )}
        </div>
      </Card>
      
      {/* 底部版权信息 */}
      <div style={{
        textAlign: 'center',
        marginTop: 24,
        padding: '16px 0',
      }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          无偿献血人群问卷调查系统
        </Text>
      </div>
    </div>
  );
};

// ==================== 题目组件 ====================

interface QuestionItemProps {
  question: any;
  index: number;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

/**
 * 单个题目渲染组件
 */
const QuestionItem: React.FC<QuestionItemProps> = ({ question, index, deviceType }) => {
  if (!question) return null;
  
  const fieldName = question._id || question.id;
  
  return (
    <Form.Item
      name={fieldName}
      label={
        <div style={{
          fontSize: deviceType === 'mobile' ? 16 : 18,
          fontWeight: 500,
          marginBottom: 12,
        }}>
          <span>{index + 1}. {question.title}</span>
          {question.required && (
            <Text type="danger" style={{ marginLeft: 4 }}>*</Text>
          )}
        </div>
      }
      rules={[
        { required: question.required, message: '此题为必填项' },
      ]}
      style={{ marginBottom: deviceType === 'mobile' ? 24 : 32 }}
    >
      {/* 单选题 */}
      {question.type === 'single_choice' && (
        <Radio.Group
          style={{
            width: '100%',
          }}
        >
          <Space
            direction={deviceType === 'mobile' ? 'vertical' : 'vertical'}
            style={{ width: '100%' }}
            size={deviceType === 'mobile' ? 'middle' : 'small'}
          >
            {question.options?.map((option: any) => (
              <Radio
                key={option.id || option._id}
                value={option.id || option._id}
                style={{
                  fontSize: deviceType === 'mobile' ? 16 : 14,
                  padding: deviceType === 'mobile' ? '8px 0' : '4px 0',
                }}
              >
                {option.text}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
      )}
      
      {/* 多选题 */}
      {question.type === 'multiple_choice' && (
        <Checkbox.Group
          style={{ width: '100%' }}
        >
          <Space
            direction="vertical"
            style={{ width: '100%' }}
            size={deviceType === 'mobile' ? 'middle' : 'small'}
          >
            {question.options?.map((option: any) => (
              <Checkbox
                key={option.id || option._id}
                value={option.id || option._id}
                style={{
                  fontSize: deviceType === 'mobile' ? 16 : 14,
                  padding: deviceType === 'mobile' ? '8px 0' : '4px 0',
                }}
              >
                {option.text}
              </Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      )}
      
      {/* 文本题 */}
      {question.type === 'text' && (
        <TextArea
          placeholder={question.placeholder || '请输入您的回答'}
          maxLength={question.maxLength || 500}
          rows={deviceType === 'mobile' ? 4 : 3}
          showCount
          style={{
            fontSize: deviceType === 'mobile' ? 16 : 14,
          }}
        />
      )}
      
      {/* 评分题 */}
      {question.type === 'rating' && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '16px 0',
        }}>
          <Rate
            count={question.maxRating || 5}
            style={{
              fontSize: deviceType === 'mobile' ? 36 : 28,
            }}
          />
        </div>
      )}
      
      {/* 日期题 */}
      {question.type === 'date' && (
        <DatePicker
          style={{
            width: '100%',
            fontSize: deviceType === 'mobile' ? 16 : 14,
          }}
          placeholder="请选择日期"
          inputReadOnly={deviceType === 'mobile'} // 移动端避免键盘弹出
        />
      )}
    </Form.Item>
  );
};

export default QuestionnaireFillPage;