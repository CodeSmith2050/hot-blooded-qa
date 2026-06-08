/**
 * 统计页面
 * 
 * 功能说明：
 * - 展示问卷的统计数据
 * - 使用 ECharts 进行数据可视化
 * - 支持导出数据
 * 
 * 展示内容：
 * - 总答卷数、完成率
 * - 各题目的统计图表
 * - 时间趋势分析
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Spin,
  Statistic,
  Row,
  Col,
  Button,
  message,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { answerApi } from '@/services/api';

/**
 * 统计页面
 */
const StatisticsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<any>(null);
  
  /**
   * 加载统计数据
   */
  useEffect(() => {
    const fetchStatistics = async () => {
      if (!id) return;
      
      try {
        const response: any = await answerApi.getStatistics(id);
        if (response.success) {
          setStatistics(response.data);
        }
      } catch (error) {
        message.error('加载统计数据失败');
      } finally {
        setLoading(false);
      }
    };
    
    fetchStatistics();
  }, [id]);
  
  /**
   * 导出数据
   */
  const handleExport = async (format: 'csv' | 'excel') => {
    if (!id) return;
    
    try {
      const response: any = await answerApi.export(id, format);
      
      // 创建下载链接
      const blob = new Blob([response], {
        type: format === 'csv'
          ? 'text/csv;charset=utf-8;'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `问卷数据_${id}.${format}`;
      link.click();
      
      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
    }
  };
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }
  
  if (!statistics) {
    return <Empty description="暂无统计数据" />;
  }
  
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
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/admin/list')}
        >
          返回
        </Button>
        
        <div>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleExport('csv')}
            style={{ marginRight: 8 }}
          >
            导出 CSV
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleExport('excel')}
          >
            导出 Excel
          </Button>
        </div>
      </div>
      
      {/* 统计概览 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总答卷数"
              value={statistics.totalAnswers || 0}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="今日答卷"
              value={statistics.todayAnswers || 0}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="完成率"
              value={statistics.completionRate || 0}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>
      
      {/* 题目统计 */}
      <h3>题目统计</h3>
      {statistics.questionStats?.map((stat: any, index: number) => (
        <Card key={index} title={stat.questionTitle} style={{ marginBottom: 16 }}>
          {/* TODO: 使用 ECharts 渲染图表 */}
          <pre>{JSON.stringify(stat, null, 2)}</pre>
        </Card>
      ))}
    </div>
  );
};

export default StatisticsPage;