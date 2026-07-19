/**
 * 统计页面
 * 
 * 功能说明：
 * - 展示问卷的统计数据
 * - 使用 ECharts 进行数据可视化
 * - 支持导出数据（CSV/Excel）
 * 
 * 展示内容：
 * - 总答卷数、完成率、平均用时
 * - 各题目的统计图表（饼图、柱状图、折线图）
 * - 时间趋势分析
 * - 答卷来源分布
 */

import React, { useEffect, useState, useRef } from 'react';
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
  Typography,
  Divider,
  Space,
  Table,
  Tag,
  DatePicker,
  Select,
} from 'antd';
import {
  ArrowLeftOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  FileTextOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import { answerApi, questionnaireApi } from '@/services/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// ==================== 统计数据接口 ====================

interface StatisticsData {
  questionnaire: {
    title: string;
    totalQuestions: number;
    status: string;
  };
  overview: {
    totalAnswers: number;
    completedAnswers: number;
    completionRate: number;
    averageTime: number;
  };
  sourceDistribution: {
    web: number;
    wechat: number;
    mobile: number;
    other: number;
  };
  timeDistribution: {
    dates: string[];
    counts: number[];
  };
  questionStats: QuestionStat[];
}

interface QuestionStat {
  questionIndex: number;
  questionTitle: string;
  questionType: string;
  totalResponses: number;
  options?: {
    text: string;
    count: number;
    percentage: number;
  }[];
  textResponses?: {
    content: string;
    count: number;
  }[];
  averageRating?: number;
  ratingDistribution?: {
    rating: number;
    count: number;
  }[];
}

// ==================== 主组件 ====================

/**
 * 统计页面
 */
const StatisticsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // 状态管理
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [timeRange, setTimeRange] = useState<[string, string] | null>(null);

  // D-006 筛选参数
  const [filterSource, setFilterSource] = useState<string | undefined>(undefined);
  const [filterDevice, setFilterDevice] = useState<string | undefined>(undefined);
  const [filterDateRange, setFilterDateRange] = useState<[any, any] | null>(null);
  
  // 图表引用
  const sourceChartRef = useRef<HTMLDivElement>(null);
  const timeChartRef = useRef<HTMLDivElement>(null);
  const sourceChartInstance = useRef<echarts.ECharts | null>(null);
  const timeChartInstance = useRef<echarts.ECharts | null>(null);
  
  // ==================== 数据加载 ====================
  
  /**
   * 加载统计数据
   *
   * 后端 GET /api/answers/statistics/:id 返回结构：
   *   { success, questionnaire: {...}, statistics: {
   *     totalAnswers, sourceStats: [{source, count}], deviceStats,
   *     avgDuration, questionStats: [...]
   *   } }
   * 前端 StatisticsData 期望扁平结构，此处做字段映射。
   * - completedAnswers / completionRate：依赖 S-006 完成率字段，暂留 0
   * - timeDistribution：依赖 D-006 时间筛选，暂留空数组
   */
  useEffect(() => {
    const fetchStatistics = async () => {
      if (!id) return;

      try {
        setLoading(true);

        // 获取问卷基本信息
        const questionnaireResponse: any = await questionnaireApi.getById(id);

        // 获取统计数据
        // D-006 筛选参数
        const filterParams: any = {};
        if (filterDateRange && filterDateRange[0] && filterDateRange[1]) {
          filterParams.startDate = filterDateRange[0].format('YYYY-MM-DD');
          filterParams.endDate = filterDateRange[1].format('YYYY-MM-DD');
        }
        if (filterSource) filterParams.source = filterSource;
        if (filterDevice) filterParams.device = filterDevice;

        const statsResponse: any = await answerApi.getStatistics(id, filterParams);

        if (questionnaireResponse.success && statsResponse.success) {
          const questionnaire = questionnaireResponse.data;
          // 后端统计数据嵌套在 statistics 字段下
          const stats = statsResponse.data.statistics || {};

          // sourceStats 数组 → sourceDistribution 对象
          const sourceDist = { web: 0, wechat: 0, mobile: 0, other: 0 };
          (stats.sourceStats || []).forEach((s: { source: string; count: number }) => {
            if (s.source in sourceDist) {
              (sourceDist as any)[s.source] = s.count;
            } else {
              sourceDist.other += s.count;
            }
          });

          // 构建完整的统计数据
          const fullStats: StatisticsData = {
            questionnaire: {
              title: questionnaire.title,
              totalQuestions: questionnaire.questions?.length || 0,
              status: questionnaire.status,
            },
            overview: {
              totalAnswers: stats.totalAnswers || 0,
              completedAnswers: stats.completedAnswers || 0,
              completionRate: stats.completionRate || 0,
              averageTime: stats.avgDuration || 0,
            },
            sourceDistribution: sourceDist,
            timeDistribution: {
              dates: [],
              counts: [],
            },
            questionStats: stats.questionStats || [],
          };

          setStatistics(fullStats);
        }
      } catch (error) {
        message.error('加载统计数据失败');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, [id, filterSource, filterDevice, filterDateRange]);
  
  // ==================== 图表渲染 ====================
  
  /**
   * 渲染来源分布饼图
   */
  useEffect(() => {
    if (!statistics || !sourceChartRef.current) return;
    
    // 初始化图表
    if (!sourceChartInstance.current) {
      sourceChartInstance.current = echarts.init(sourceChartRef.current);
    }
    
    const { sourceDistribution } = statistics;
    const total = sourceDistribution.web + sourceDistribution.wechat + 
                  sourceDistribution.mobile + sourceDistribution.other;
    
    // 图表配置
    const option: echarts.EChartsOption = {
      title: {
        text: '答卷来源分布',
        left: 'center',
        textStyle: { fontSize: 16, fontWeight: 'bold' },
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
        top: 'middle',
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['60%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2,
          },
          label: {
            show: false,
            position: 'center',
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 20,
              fontWeight: 'bold',
            },
          },
          labelLine: { show: false },
          data: [
            { value: sourceDistribution.web, name: '网页端', itemStyle: { color: '#5470c6' } },
            { value: sourceDistribution.wechat, name: '微信', itemStyle: { color: '#91cc75' } },
            { value: sourceDistribution.mobile, name: '移动端', itemStyle: { color: '#fac858' } },
            { value: sourceDistribution.other, name: '其他', itemStyle: { color: '#ee6666' } },
          ],
        },
      ],
    };
    
    sourceChartInstance.current.setOption(option);
    
    // 窗口大小变化时重新调整
    const handleResize = () => sourceChartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [statistics]);
  
  /**
   * 渲染时间趋势折线图
   */
  useEffect(() => {
    if (!statistics || !timeChartRef.current) return;
    
    // 初始化图表
    if (!timeChartInstance.current) {
      timeChartInstance.current = echarts.init(timeChartRef.current);
    }
    
    const { timeDistribution } = statistics;
    
    // 图表配置
    const option: echarts.EChartsOption = {
      title: {
        text: '答卷时间趋势',
        left: 'center',
        textStyle: { fontSize: 16, fontWeight: 'bold' },
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      xAxis: {
        type: 'category',
        data: timeDistribution.dates,
        axisLabel: { rotate: 45 },
      },
      yAxis: {
        type: 'value',
        name: '答卷数',
      },
      series: [
        {
          type: 'line',
          data: timeDistribution.counts,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 3, color: '#1890ff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
            ]),
          },
          itemStyle: { color: '#1890ff' },
        },
      ],
      grid: {
        left: '10%',
        right: '10%',
        bottom: '15%',
        top: '15%',
      },
    };
    
    timeChartInstance.current.setOption(option);
    
    // 窗口大小变化时重新调整
    const handleResize = () => timeChartInstance.current?.resize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [statistics]);
  
  // ==================== 导出功能 ====================
  
  /**
   * 导出数据
   * @param format 导出格式（csv 或 excel）
   */
  const handleExport = async (format: 'csv' | 'excel') => {
    if (!id) return;
    
    try {
      message.loading({ content: '正在导出...', key: 'export' });
      
      const response: any = await answerApi.export(id, format);
      
      // 创建下载链接
      const mimeType = format === 'csv'
        ? 'text/csv;charset=utf-8;'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      
      const blob = new Blob([response], { type: mimeType });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `问卷数据_${id}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      link.click();
      URL.revokeObjectURL(link.href);
      
      message.success({ content: '导出成功', key: 'export' });
    } catch (error) {
      message.error({ content: '导出失败，请稍后重试', key: 'export' });
    }
  };
  
  // ==================== 加载中状态 ====================
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载统计数据..." />
      </div>
    );
  }
  
  if (!statistics) {
    return (
      <div style={{ padding: '50px 20px', textAlign: 'center' }}>
        <Empty description="暂无统计数据" />
        <div style={{ marginTop: 16 }}>
          <Button type="primary" onClick={() => navigate('/admin/list')}>
            返回列表
          </Button>
        </div>
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
            {statistics.questionnaire.title} - 统计分析
          </Title>
          <Tag color={statistics.questionnaire.status === 'published' ? 'green' : 'orange'}>
            {statistics.questionnaire.status === 'published' ? '已发布' : '草稿'}
          </Tag>
        </Space>
        
        <Space>
          <Button
            icon={<FileTextOutlined />}
            onClick={() => handleExport('csv')}
          >
            导出 CSV
          </Button>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={() => handleExport('excel')}
          >
            导出 Excel
          </Button>
        </Space>
      </div>

      {/* D-006 筛选面板 */}
      <Card style={{ marginBottom: 16 }} size="small">
        <Space wrap>
          <Text strong>筛选：</Text>
          <RangePicker
            placeholder={['开始日期', '结束日期']}
            onChange={(dates) => setFilterDateRange(dates as [any, any] | null)}
            allowClear
          />
          <Select
            placeholder="来源"
            allowClear
            style={{ width: 120 }}
            value={filterSource}
            onChange={setFilterSource}
            options={[
              { label: '网页端', value: 'web' },
              { label: '微信', value: 'wechat' },
              { label: '移动端', value: 'mobile' },
            ]}
          />
          <Select
            placeholder="设备"
            allowClear
            style={{ width: 120 }}
            value={filterDevice}
            onChange={setFilterDevice}
            options={[
              { label: '桌面端', value: 'desktop' },
              { label: '手机', value: 'mobile' },
              { label: '平板', value: 'tablet' },
            ]}
          />
        </Space>
      </Card>

      {/* 总览统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总答卷数"
              value={statistics.overview.totalAnswers}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="完成答卷"
              value={statistics.overview.completedAnswers}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="完成率"
              value={statistics.overview.completionRate}
              suffix="%"
              precision={1}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="平均用时"
              value={statistics.overview.averageTime}
              suffix="秒"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
      </Row>
      
      {/* 图表区域 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card>
            <div
              ref={sourceChartRef}
              style={{ width: '100%', height: 300 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <div
              ref={timeChartRef}
              style={{ width: '100%', height: 300 }}
            />
          </Card>
        </Col>
      </Row>
      
      {/* 各题目统计 */}
      <Card title="题目统计分析" style={{ marginBottom: 24 }}>
        {statistics.questionStats.length === 0 ? (
          <Empty description="暂无题目统计数据" />
        ) : (
          statistics.questionStats.map((stat, index) => (
            <QuestionStatCard
              key={index}
              stat={stat}
              index={index}
            />
          ))
        )}
      </Card>
    </div>
  );
};

// ==================== 单题统计卡片组件 ====================

interface QuestionStatCardProps {
  stat: QuestionStat;
  index: number;
}

/**
 * 单题统计卡片
 * 包含题目统计图表和详细数据
 *
 * 题型兼容：后端统计接口返回后端存储类型 single/multiple/text/rating/matrix
 * （见项目记忆 6.1 题型映射规则），同时兼容前端旧字段 single_choice/multiple_choice
 */
const QuestionStatCard: React.FC<QuestionStatCardProps> = ({ stat, index }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 题型判断辅助：兼容 single / single_choice 两种写法
  const isSingle = stat.questionType === 'single' || stat.questionType === 'single_choice';
  const isMultiple = stat.questionType === 'multiple' || stat.questionType === 'multiple_choice';
  const isChoice = isSingle || isMultiple;
  const isRating = stat.questionType === 'rating';
  const isText = stat.questionType === 'text';
  const isMatrix = stat.questionType === 'matrix';

  /**
   * 渲染题目图表
   */
  useEffect(() => {
    if (!chartRef.current) return;

    // 文本题不渲染 ECharts 图表
    if (isText) return;

    // 初始化图表
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    let option: echarts.EChartsOption;

    // 选择题：柱状图
    if (isChoice) {
      option = {
        title: {
          text: `Q${index + 1} ${stat.questionTitle}`,
          left: 'left',
          textStyle: { fontSize: 14 },
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: any) => {
            const data = params[0];
            return `${data.name}: ${data.value} 人 (${stat.options?.find(o => o.text === data.name)?.percentage?.toFixed(1) || 0}%)`;
          },
        },
        xAxis: {
          type: 'category',
          data: stat.options?.map(o => o.text) || [],
          axisLabel: { interval: 0, rotate: 30 },
        },
        yAxis: {
          type: 'value',
          name: '选择人数',
        },
        series: [
          {
            type: 'bar',
            data: stat.options?.map(o => o.count) || [],
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#1890ff' },
                { offset: 1, color: '#69c0ff' },
              ]),
            },
            barWidth: '60%',
          },
        ],
        grid: {
          left: '10%',
          right: '10%',
          bottom: '20%',
          top: '15%',
        },
      };
    } else if (isRating) {
      // V-005 评分题雷达图
      option = {
        title: {
          text: `Q${index + 1} ${stat.questionTitle}`,
          left: 'left',
          textStyle: { fontSize: 14 },
        },
        tooltip: {},
        radar: {
          indicator: stat.ratingDistribution?.map(r => ({
            name: `${r.rating}星`,
            max: Math.max(...(stat.ratingDistribution?.map(d => d.count) || [1])),
          })) || [],
        },
        series: [
          {
            type: 'radar',
            data: [
              {
                value: stat.ratingDistribution?.map(r => r.count) || [],
                name: '评分分布',
                areaStyle: { opacity: 0.3 },
              },
            ],
          },
        ],
      };
    } else if (isMatrix) {
      // V-007 矩阵题热力图
      const rowStats = (stat as any).rowStats;
      if (!rowStats || rowStats.length === 0) return;

      const rows = rowStats.map((r: any) => r.row);
      const cols = rowStats[0]?.columns?.map((c: any) => c.col) || [];
      const data: number[][] = [];
      rowStats.forEach((row: any, ri: number) => {
        row.columns?.forEach((col: any, ci: number) => {
          data.push([ci, ri, col.count]);
        });
      });
      const maxCount = Math.max(...data.map(d => d[2]), 1);

      option = {
        title: {
          text: `Q${index + 1} ${stat.questionTitle}`,
          left: 'left',
          textStyle: { fontSize: 14 },
        },
        tooltip: {
          formatter: (params: any) => {
            const d = params.data;
            return `${rows[d[1]]} × ${cols[d[0]]}: ${d[2]} 人`;
          },
        },
        grid: {
          left: '15%',
          right: '10%',
          bottom: '20%',
          top: '15%',
        },
        xAxis: {
          type: 'category',
          data: cols,
          splitArea: { show: true },
          axisLabel: { rotate: 30 },
        },
        yAxis: {
          type: 'category',
          data: rows,
          splitArea: { show: true },
        },
        visualMap: {
          min: 0,
          max: maxCount,
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 0,
          inRange: { color: ['#e0f3db', '#a8ddb5', '#7bccc4', '#43a2ca', '#0868ac'] },
        },
        series: [
          {
            type: 'heatmap',
            data: data,
            label: { show: true },
            emphasis: {
              itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' },
            },
          },
        ],
      };
    } else {
      // 其他题型：暂不渲染图表
      return;
    }

    chartInstance.current.setOption(option);

    // 窗口大小变化时重新调整
    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, [stat, index, isChoice, isRating, isText, isMatrix]);

  return (
    <Card
      style={{ marginBottom: 16 }}
      size="small"
    >
      <Row gutter={16}>
        {/* 图表区域 */}
        {(isChoice || isRating || isMatrix) && (
          <Col xs={24} lg={12}>
            <div
              ref={chartRef}
              style={{ width: '100%', height: 250 }}
            />
          </Col>
        )}

        {/* 数据表格区域 */}
        <Col xs={24} lg={12}>
          <div style={{ padding: '10px 0' }}>
            <Text strong style={{ marginBottom: 8 }}>
              题型：{isSingle ? '单选题' :
                     isMultiple ? '多选题' :
                     isRating ? '评分题' :
                     isText ? '文本题' : stat.questionType}
            </Text>
            <Divider style={{ margin: '8px 0' }} />

            {/* 选择题选项统计 */}
            {stat.options && (
              <Table
                dataSource={stat.options.map((o, i) => ({
                  key: i,
                  option: o.text,
                  count: o.count,
                  percentage: `${o.percentage.toFixed(1)}%`,
                }))}
                columns={[
                  { title: '选项', dataIndex: 'option', key: 'option' },
                  { title: '选择人数', dataIndex: 'count', key: 'count' },
                  { title: '占比', dataIndex: 'percentage', key: 'percentage' },
                ]}
                pagination={false}
                size="small"
              />
            )}

            {/* 评分题统计 */}
            {isRating && stat.averageRating !== undefined && (
              <Statistic
                title="平均评分"
                value={stat.averageRating}
                suffix="星"
                precision={2}
                valueStyle={{ color: '#fa8c16' }}
              />
            )}

            {/* 文本题统计 */}
            {isText && stat.textResponses && (
              <div>
                <Text type="secondary">共 {stat.totalResponses} 条回答</Text>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {stat.textResponses.slice(0, 10).map((r, i) => (
                    <div key={i} style={{ marginBottom: 8 }}>
                      <Text>{r.content}</Text>
                      <Tag style={{ marginLeft: 8 }}>{r.count}次</Tag>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Col>
      </Row>
    </Card>
  );
};

export default StatisticsPage;