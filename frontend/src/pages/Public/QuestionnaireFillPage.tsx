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
import { initWxSdk } from '@/services/wxSdk';

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

// ==================== F-005 草稿持久化 ====================

/**
 * 草稿保存防抖延迟（毫秒）
 * 用户停止输入 500ms 后才写入 localStorage，避免频繁 IO
 */
const DRAFT_DEBOUNCE_MS = 500;

/**
 * 获取问卷草稿在 localStorage 中的 key
 *
 * 同一问卷独立缓存，不同问卷互不干扰。
 * @param questionnaireId 问卷 ID
 */
const getDraftKey = (questionnaireId: string): string =>
  `questionnaire_draft_${questionnaireId}`;

/**
 * 保存草稿到 localStorage
 *
 * 配额超限或 localStorage 不可用时静默失败，不影响用户填写流程。
 * @param questionnaireId 问卷 ID
 * @param values 表单值（Ant Design Form.getFieldsValue 返回的对象）
 */
const saveDraft = (questionnaireId: string, values: Record<string, any>): void => {
  try {
    const payload = {
      values,
      savedAt: Date.now(),
    };
    localStorage.setItem(getDraftKey(questionnaireId), JSON.stringify(payload));
  } catch {
    // localStorage 配额超限或不可用（如隐私模式），静默失败
  }
};

/**
 * 读取草稿
 * @param questionnaireId 问卷 ID
 * @returns 草稿对象（含 values 和 savedAt），无草稿返回 null
 */
const loadDraft = (questionnaireId: string): { values: Record<string, any>; savedAt: number } | null => {
  try {
    const raw = localStorage.getItem(getDraftKey(questionnaireId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.values) return null;
    return parsed;
  } catch {
    // JSON 解析失败或 localStorage 不可用，视为无草稿
    return null;
  }
};

/**
 * 清除草稿（提交成功后调用）
 * @param questionnaireId 问卷 ID
 */
const clearDraft = (questionnaireId: string): void => {
  try {
    localStorage.removeItem(getDraftKey(questionnaireId));
  } catch {
    // 静默失败
  }
};

/**
 * 校验草稿与当前问卷的兼容性
 *
 * 若问卷已被编辑修改，部分 questionId 可能已失效，需过滤掉无效字段。
 * @param draftValues 草稿中的表单值
 * @param questions 当前问卷题目列表
 * @returns 过滤后的有效表单值
 */
const filterDraftByQuestions = (
  draftValues: Record<string, any>,
  questions: any[]
): Record<string, any> => {
  const validFieldNames = new Set(questions.map(q => q._id || q.id));
  const filtered: Record<string, any> = {};
  for (const [fieldName, value] of Object.entries(draftValues)) {
    if (validFieldNames.has(fieldName)) {
      filtered[fieldName] = value;
    }
  }
  return filtered;
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
  // F-005 草稿恢复提示：检测到草稿时显示横幅，用户选择恢复或放弃
  const [draftBanner, setDraftBanner] = useState<{ savedAt: number } | null>(null);
  
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
   * F-004 微信 JS-SDK 初始化
   *
   * 仅在微信环境且非预览模式时尝试初始化。
   * 初始化失败（非微信/后端未配置/script 加载失败/wx.config 失败）时静默降级为仅 UA 检测模式，
   * 不影响用户填写问卷的核心流程。
   *
   * 当前业务场景暂未启用具体 JS 接口（如分享、扫码），jsApiList 保留为空数组。
   * 后续如需调用具体接口，在此处追加接口名即可。
   */
  useEffect(() => {
    if (!isWechatEnv || isPreviewMode) return;
    const url = window.location.href.split('#')[0];
    // 不 await：异步初始化不阻塞主流程
    initWxSdk(url, []).catch(() => {
      // 静默降级，不向用户暴露错误
    });
  }, [isWechatEnv, isPreviewMode]);
  
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

          // F-005 草稿恢复：非预览模式下检测是否有未完成草稿
          // 不自动恢复，先显示横幅让用户选择（避免覆盖用户已主动填的内容）
          if (!isPreviewMode && data.questions?.length > 0) {
            const draft = loadDraft(id);
            if (draft && draft.values) {
              const filtered = filterDraftByQuestions(draft.values, data.questions);
              // 仅当过滤后仍有有效字段时才提示恢复
              if (Object.keys(filtered).length > 0) {
                setDraftBanner({ savedAt: draft.savedAt });
              }
            }
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

  /**
   * F-005 草稿自动保存的防抖定时器引用
   *
   * 通过 useRef 跨渲染保留定时器句柄，避免每次重渲染创建新定时器。
   * onValuesChange 回调每次触发时清除上一次定时器，500ms 内无新变化才写入 localStorage。
   */
  const draftTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * F-005 表单值变化回调（挂载到 Form onValuesChange）
   *
   * 防抖 500ms 后写入 localStorage，避免频繁 IO。
   * 预览模式 / 未加载问卷 / 已提交时不保存。
   */
  const handleFormValuesChange = useCallback(() => {
    if (isPreviewMode || !questionnaire || submitted || !id) return;

    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
    }
    draftTimerRef.current = setTimeout(() => {
      const values = form.getFieldsValue(true);
      saveDraft(questionnaire._id || questionnaire.id, values);
    }, DRAFT_DEBOUNCE_MS);
  }, [form, questionnaire, isPreviewMode, submitted, id]);

  /**
   * F-005 用户点击「恢复草稿」
   *
   * 读取 localStorage 中的草稿，过滤掉问卷已删除题目的字段，
   * 通过 form.setFieldsValue 写入表单，然后关闭横幅。
   */
  const handleRestoreDraft = () => {
    if (!id || !questionnaire) return;
    const draft = loadDraft(id);
    if (!draft || !draft.values) {
      setDraftBanner(null);
      return;
    }
    const filtered = filterDraftByQuestions(draft.values, questionnaire.questions || []);
    if (Object.keys(filtered).length > 0) {
      form.setFieldsValue(filtered);
      message.success('已恢复上次未完成的填写');
    }
    setDraftBanner(null);
  };

  /**
   * F-005 用户点击「放弃草稿」
   *
   * 清除 localStorage 中的草稿并关闭横幅。
   */
  const handleDiscardDraft = () => {
    if (id) clearDraft(id);
    setDraftBanner(null);
  };

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

      // F-004 微信环境识别：isWechatEnv=true 时 source 上报为 'wechat'
      // 否则按设备类型上报为 'mobile' / 'web'
      const source: 'wechat' | 'mobile' | 'web' = isWechatEnv
        ? 'wechat'
        : (deviceType === 'mobile' ? 'mobile' : 'web');

      const response: any = await answerApi.submit(id, {
        answers,
        source,
        deviceInfo,
      });
      
      if (response.success) {
        message.success('提交成功，感谢您的参与！');
        // F-005 提交成功后清理草稿
        if (id) clearDraft(id);
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

      {/* F-005 草稿恢复横幅 */}
      {draftBanner && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          maxWidth: deviceType === 'mobile' ? '100%' : '800px',
          margin: '0 auto 16px',
          padding: '12px 16px',
          backgroundColor: '#e6f7ff',
          border: '1px solid #91d5ff',
          borderRadius: 4,
        }}>
          <Text>
            检测到未完成的填写（保存于{' '}
            {new Date(draftBanner.savedAt).toLocaleString()}），是否恢复？
          </Text>
          <Space size="small">
            <Button
              type="primary"
              size="small"
              onClick={handleRestoreDraft}
            >
              恢复
            </Button>
            <Button
              size="small"
              onClick={handleDiscardDraft}
            >
              放弃
            </Button>
          </Space>
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
          onValuesChange={handleFormValuesChange}
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