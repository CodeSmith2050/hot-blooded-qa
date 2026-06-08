/**
 * 编辑问卷页面
 * 
 * 功能说明：
 * - 加载已有问卷数据
 * - 支持修改问卷信息和题目
 * - 保存修改
 * 
 * 与创建页面类似，但会预填充数据
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, message } from 'antd';
import { questionnaireApi } from '@/services/api';

/**
 * 编辑问卷页面
 * 
 * 复用创建页面的组件，预填充数据
 */
const QuestionnaireEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [questionnaire, setQuestionnaire] = useState<any>(null);
  
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
  }, [id]);
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }
  
  // TODO: 复用创建页面的编辑器组件，预填充数据
  return (
    <div>
      <h2>编辑问卷</h2>
      <p>问卷ID: {id}</p>
      <p>此功能正在开发中...</p>
    </div>
  );
};

export default QuestionnaireEditPage;