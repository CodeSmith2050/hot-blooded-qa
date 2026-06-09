/**
 * 预设问卷模板数据
 * 
 * 包含常用的问卷调查模板，如：
 * - 无偿献血满意度调研
 * - 活动反馈问卷
 * - 健康状况调查
 * - 服务质量评价
 */

import { ITemplateQuestion } from '../models/Template';

/**
 * 无偿献血满意度调研模板
 */
export const bloodDonationSatisfaction: {
  name: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  questions: ITemplateQuestion[];
} = {
  name: '无偿献血满意度调研',
  title: '无偿献血满意度调查问卷',
  description: '用于收集无偿献血者对献血过程的满意度评价，帮助改进服务质量',
  icon: 'heart',
  category: '满意度调研',
  questions: [
    {
      id: 'q1',
      type: 'single',
      title: '您对本次献血过程的整体满意度如何？',
      required: true,
      options: ['非常满意', '满意', '一般', '不满意', '非常不满意'],
      order: 0
    },
    {
      id: 'q2',
      type: 'single',
      title: '您对献血前的健康咨询服务是否满意？',
      required: true,
      options: ['非常满意', '满意', '一般', '不满意', '非常不满意'],
      order: 1
    },
    {
      id: 'q3',
      type: 'single',
      title: '您对采血过程的专业程度是否满意？',
      required: true,
      options: ['非常满意', '满意', '一般', '不满意', '非常不满意'],
      order: 2
    },
    {
      id: 'q4',
      type: 'single',
      title: '您对献血后的休息区服务是否满意？',
      required: true,
      options: ['非常满意', '满意', '一般', '不满意', '非常不满意'],
      order: 3
    },
    {
      id: 'q5',
      type: 'multiple',
      title: '您认为我们需要改进的方面有哪些？（可多选）',
      required: false,
      options: [
        '等候时间过长',
        '环境设施',
        '服务态度',
        '信息告知',
        '后续关怀',
        '其他'
      ],
      order: 4
    },
    {
      id: 'q6',
      type: 'rating',
      title: '您愿意向亲友推荐无偿献血的可能性有多大？',
      required: true,
      ratingMax: 10,
      order: 5
    },
    {
      id: 'q7',
      type: 'text',
      title: '请提供您的宝贵建议：',
      required: false,
      order: 6
    }
  ]
};

/**
 * 活动反馈问卷模板
 */
export const activityFeedback: {
  name: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  questions: ITemplateQuestion[];
} = {
  name: '活动反馈问卷',
  title: '活动参与反馈调查问卷',
  description: '收集参与者对活动的评价和建议，用于改进未来活动组织',
  icon: 'calendar',
  category: '活动调研',
  questions: [
    {
      id: 'q1',
      type: 'single',
      title: '您是通过什么渠道了解到本次活动的？',
      required: true,
      options: ['微信公众号', '朋友圈', '朋友推荐', '线下宣传', '其他'],
      order: 0
    },
    {
      id: 'q2',
      type: 'single',
      title: '您对活动整体安排的满意度如何？',
      required: true,
      options: ['非常满意', '满意', '一般', '不满意', '非常不满意'],
      order: 1
    },
    {
      id: 'q3',
      type: 'multiple',
      title: '您对活动中哪些环节印象最深刻？（可多选）',
      required: false,
      options: ['开场环节', '互动游戏', '嘉宾分享', '抽奖环节', '场地布置', '其他'],
      order: 2
    },
    {
      id: 'q4',
      type: 'single',
      title: '您认为活动的时间安排是否合理？',
      required: true,
      options: ['非常合理', '比较合理', '一般', '不太合理', '非常不合理'],
      order: 3
    },
    {
      id: 'q5',
      type: 'rating',
      title: '您对活动工作人员的服务态度评分：',
      required: true,
      ratingMax: 5,
      order: 4
    },
    {
      id: 'q6',
      type: 'text',
      title: '您对本次活动的建议或意见：',
      required: false,
      order: 5
    }
  ]
};

/**
 * 健康状况调查模板
 */
export const healthSurvey: {
  name: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  questions: ITemplateQuestion[];
} = {
  name: '健康状况调查',
  title: '健康状况调查问卷',
  description: '了解献血者的基本健康状况，为献血安全提供参考',
  icon: 'heart-pulse',
  category: '健康调研',
  questions: [
    {
      id: 'q1',
      type: 'single',
      title: '您的年龄是？',
      required: true,
      options: ['18-25岁', '26-35岁', '36-45岁', '46-55岁', '55岁以上'],
      order: 0
    },
    {
      id: 'q2',
      type: 'single',
      title: '您的性别是？',
      required: true,
      options: ['男', '女'],
      order: 1
    },
    {
      id: 'q3',
      type: 'single',
      title: '您最近一周的身体状况如何？',
      required: true,
      options: ['非常好', '良好', '一般', '较差', '很差'],
      order: 2
    },
    {
      id: 'q4',
      type: 'multiple',
      title: '您是否有以下不适症状？（可多选）',
      required: false,
      options: ['无不适', '感冒发烧', '头晕乏力', '食欲不振', '其他'],
      order: 3
    },
    {
      id: 'q5',
      type: 'single',
      title: '您是否有慢性病史？',
      required: true,
      options: ['无', '有（请在下方说明）'],
      order: 4
    },
    {
      id: 'q6',
      type: 'text',
      title: '如果您有慢性病史，请简要说明：',
      required: false,
      order: 5
    }
  ]
};

/**
 * 志愿者招募问卷模板
 */
export const volunteerRecruitment: {
  name: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  questions: ITemplateQuestion[];
} = {
  name: '志愿者招募问卷',
  title: '志愿者招募报名表',
  description: '收集志愿者基本信息和服务意向，用于志愿者管理',
  icon: 'users',
  category: '招募调研',
  questions: [
    {
      id: 'q1',
      type: 'text',
      title: '您的姓名：',
      required: true,
      order: 0
    },
    {
      id: 'q2',
      type: 'text',
      title: '您的联系电话：',
      required: true,
      order: 1
    },
    {
      id: 'q3',
      type: 'single',
      title: '您的年龄是？',
      required: true,
      options: ['18-25岁', '26-35岁', '36-45岁', '46-55岁', '55岁以上'],
      order: 2
    },
    {
      id: 'q4',
      type: 'multiple',
      title: '您能参与的服务类型？（可多选）',
      required: true,
      options: ['献血现场服务', '宣传推广', '数据整理', '活动组织', '其他'],
      order: 3
    },
    {
      id: 'q5',
      type: 'multiple',
      title: '您可服务的时间？（可多选）',
      required: true,
      options: ['工作日上午', '工作日下午', '周末上午', '周末下午', '节假日'],
      order: 4
    },
    {
      id: 'q6',
      type: 'rating',
      title: '您的服务意愿强度（1-10分）：',
      required: true,
      ratingMax: 10,
      order: 5
    },
    {
      id: 'q7',
      type: 'text',
      title: '您的特长或优势：',
      required: false,
      order: 6
    }
  ]
};

/**
 * 所有预设模板列表
 */
export const presetTemplates = [
  bloodDonationSatisfaction,
  activityFeedback,
  healthSurvey,
  volunteerRecruitment
];

/**
 * 模板分类列表
 */
export const templateCategories = [
  '满意度调研',
  '活动调研',
  '健康调研',
  '招募调研'
];