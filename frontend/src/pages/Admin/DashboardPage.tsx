/**
 * 仪表盘页面（V-008）
 *
 * 功能说明：
 * - 管理员首页，跨问卷全局统计概览
 * - 5 个核心指标卡片：总问卷数、活跃问卷数、总填写数、今日新增、平均时长
 * - 近 7 天填写趋势折线图
 * - 来源分布饼图、设备分布柱状图、问卷状态分布饼图
 * - 答卷数 Top 5 问卷列表
 *
 * 后端接口：GET /api/answers/statistics/dashboard
 * 数据结构与单问卷 getStatistics 不同，此为跨问卷聚合
 *
 * 设计说明：
 * - 完成率字段（isCompleted）暂未实现（见 S-006），故概览卡片不含完成率
 * - 满意度分布需跨问卷聚合所有 rating 题型答案，留待 V-005 评分雷达图批次实现
 */

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Spin,
  Statistic,
  Row,
  Col,
  message,
  Typography,
  Table,
  Tag,
  Empty,
} from 'antd';
import {
  FileTextOutlined,
  CheckCircleOutlined,
  EditOutlined,
  RiseOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import { answerApi } from '@/services/api';

const { Title } = Typography;

// ==================== 数据接口定义 ====================

interface DashboardOverview {
  totalQuestionnaires: number;
  activeQuestionnaires: number;
  totalAnswers: number;
  todayNewAnswers: number;
  avgDuration: number;
}

interface TrendItem {
  date: string;
  count: number;
}

interface NameCountItem {
  source?: string;
  device?: string;
  status?: string;
  count: number;
}

interface TopQuestionnaire {
  _id: string;
  title: string;
  answerCount: number;
  status: 'draft' | 'published' | 'closed';
}

interface DashboardData {
  overview: DashboardOverview;
  trend: TrendItem[];
  sourceStats: NameCountItem[];
  deviceStats: NameCountItem[];
  questionnaireStatusStats: NameCountItem[];
  topQuestionnaires: TopQuestionnaire[];
}

// ==================== 状态颜色映射 ====================

const statusColorMap: Record<string, string> = {
  draft: 'default',
  published: 'processing',
  closed: 'error',
};

const statusTextMap: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  closed: '已关闭',
};

// ==================== 仪表盘页面组件 ====================

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // ECharts 图表实例引用
  const trendChartRef = useRef<HTMLDivElement>(null);
  const sourceChartRef = useRef<HTMLDivElement>(null);
  const deviceChartRef = useRef<HTMLDivElement>(null);
  const statusChartRef = useRef<HTMLDivElement>(null);

  const trendChartInstance = useRef<echarts.ECharts | null>(null);
  const sourceChartInstance = useRef<echarts.ECharts | null>(null);
  const deviceChartInstance = useRef<echarts.ECharts | null>(null);
  const statusChartInstance = useRef<echarts.ECharts | null>(null);

  // ==================== 数据获取 ====================

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const response: any = await answerApi.getDashboard();
        if (response.success) {
          setData(response.data);
        } else {
          message.error(response.message || '加载仪表盘数据失败');
        }
      } catch (error) {
        console.error('加载仪表盘数据失败:', error);
        message.error('加载仪表盘数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  // ==================== 趋势折线图渲染 ====================

  useEffect(() => {
    if (!data || !trendChartRef.current) return;

    if (!trendChartInstance.current) {
      trendChartInstance.current = echarts.init(trendChartRef.current);
    }

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: data.trend.map(t => t.date.slice(5)), // MM-DD
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
      },
      series: [
        {
          name: '填写数',
          type: 'line',
          smooth: true,
          data: data.trend.map(t => t.count),
          itemStyle: { color: '#1890ff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(24,144,255,0.3)' },
              { offset: 1, color: 'rgba(24,144,255,0.05)' },
            ]),
          },
        },
      ],
    };

    trendChartInstance.current.setOption(option);

    const handleResize = () => trendChartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data]);

  // ==================== 来源分布饼图渲染 ====================

  useEffect(() => {
    if (!data || !sourceChartRef.current) return;

    if (!sourceChartInstance.current) {
      sourceChartInstance.current = echarts.init(sourceChartRef.current);
    }

    const sourceTextMap: Record<string, string> = {
      web: '网页',
      wechat: '微信',
      mobile: '移动端',
    };

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
      },
      series: [
        {
          name: '来源分布',
          type: 'pie',
          radius: ['40%', '70%'],
          avoidLabelOverlap: false,
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 18,
              fontWeight: 'bold',
            },
          },
          labelLine: {
            show: false,
          },
          data: data.sourceStats.map(s => ({
            name: sourceTextMap[s.source || '未知'] || s.source || '未知',
            value: s.count,
          })),
        },
      ],
    };

    sourceChartInstance.current.setOption(option);

    const handleResize = () => sourceChartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data]);

  // ==================== 设备分布柱状图渲染 ====================

  useEffect(() => {
    if (!data || !deviceChartRef.current) return;

    if (!deviceChartInstance.current) {
      deviceChartInstance.current = echarts.init(deviceChartRef.current);
    }

    const deviceTextMap: Record<string, string> = {
      desktop: '桌面端',
      mobile: '手机端',
      tablet: '平板',
    };

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: data.deviceStats.map(s => deviceTextMap[s.device || '未知'] || s.device || '未知'),
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
      },
      series: [
        {
          name: '设备数',
          type: 'bar',
          data: data.deviceStats.map(s => s.count),
          itemStyle: { color: '#52c41a' },
          barWidth: '40%',
        },
      ],
    };

    deviceChartInstance.current.setOption(option);

    const handleResize = () => deviceChartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data]);

  // ==================== 问卷状态分布饼图渲染 ====================

  useEffect(() => {
    if (!data || !statusChartRef.current) return;

    if (!statusChartInstance.current) {
      statusChartInstance.current = echarts.init(statusChartRef.current);
    }

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
      },
      series: [
        {
          name: '问卷状态',
          type: 'pie',
          radius: '60%',
          data: data.questionnaireStatusStats.map(s => ({
            name: statusTextMap[s.status || '未知'] || s.status || '未知',
            value: s.count,
          })),
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2,
          },
        },
      ],
    };

    statusChartInstance.current.setOption(option);

    const handleResize = () => statusChartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data]);

  // ==================== Top 5 问卷表格列定义 ====================

  const topColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '问卷标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '答卷数',
      dataIndex: 'answerCount',
      key: 'answerCount',
      width: 100,
      sorter: (a: TopQuestionnaire, b: TopQuestionnaire) =>
        b.answerCount - a.answerCount,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColorMap[status] || 'default'}>
          {statusTextMap[status] || status}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: TopQuestionnaire) => (
        <a
          onClick={() => navigate(`/admin/stats/${record._id}`)}
        >
          查看统计
        </a>
      ),
    },
  ];

  // ==================== 渲染 ====================

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载仪表盘数据..." />
      </div>
    );
  }

  if (!data) {
    return <Empty description="暂无数据" />;
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        数据概览仪表盘
      </Title>

      {/* 概览卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="总问卷数"
              value={data.overview.totalQuestionnaires}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="活跃问卷"
              value={data.overview.activeQuestionnaires}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="总填写数"
              value={data.overview.totalAnswers}
              prefix={<EditOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="今日新增"
              value={data.overview.todayNewAnswers}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={4}>
          <Card>
            <Statistic
              title="平均时长(秒)"
              value={data.overview.avgDuration}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 趋势 + 来源分布 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="近 7 天填写趋势">
            <div ref={trendChartRef} style={{ width: '100%', height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="来源分布">
            <div ref={sourceChartRef} style={{ width: '100%', height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* 设备分布 + 问卷状态分布 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="设备类型分布">
            <div ref={deviceChartRef} style={{ width: '100%', height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="问卷状态分布">
            <div ref={statusChartRef} style={{ width: '100%', height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* Top 5 问卷 */}
      <Card title="答卷数 Top 5 问卷" style={{ marginTop: 16 }}>
        <Table
          dataSource={data.topQuestionnaires}
          columns={topColumns}
          rowKey="_id"
          pagination={false}
          size="middle"
          locale={{ emptyText: '暂无答卷数据' }}
        />
      </Card>
    </div>
  );
};

export default DashboardPage;
