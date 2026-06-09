/**
 * 问卷列表页面
 * 
 * 功能说明：
 * - 展示所有问卷列表
 * - 支持分页、搜索、状态筛选
 * - 提供创建、编辑、删除、发布等操作
 * 
 * 页面布局：
 * - 顶部：搜索框 + 筛选器 + 创建按钮
 * - 中部：问卷卡片/表格列表
 * - 底部：分页器
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  message,
  Popconfirm,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  BarChartOutlined,
  PlayCircleOutlined,
  StopOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { questionnaireApi } from '@/services/api';
import { useQuestionnaireStore } from '@/store/questionnaireStore';
import TemplateSelectModal from '@/components/Admin/TemplateSelectModal';

const { Title } = Typography;
const { Option } = Select;

/**
 * 状态标签映射
 */
const statusMap: Record<string, { color: string; text: string }> = {
  draft: { color: 'default', text: '草稿' },
  published: { color: 'success', text: '已发布' },
  closed: { color: 'error', text: '已关闭' },
};

/**
 * 问卷列表页面
 */
const QuestionnaireListPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    questionnaires,
    loading,
    pagination,
    searchQuery,
    statusFilter,
    setQuestionnaires,
    setLoading,
    setPagination,
    setSearchQuery,
    setStatusFilter,
    updateQuestionnaire,
    removeQuestionnaire,
  } = useQuestionnaireStore();
  
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  
  /**
   * 获取问卷列表
   */
  const fetchQuestionnaires = async () => {
    setLoading(true);
    
    try {
      const response: any = await questionnaireApi.getList({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        status: statusFilter,
      });
      
      if (response.success) {
        setQuestionnaires(response.data);
        setPagination({ total: response.pagination.total });
      }
    } catch (error) {
      message.error('获取问卷列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 页面加载时获取数据
   */
  useEffect(() => {
    fetchQuestionnaires();
  }, [pagination.page, pagination.limit, searchQuery, statusFilter]);
  
  /**
   * 处理搜索
   */
  const handleSearch = () => {
    setSearchQuery(localSearch);
  };
  
  /**
   * 处理发布问卷
   * @param id 问卷ID
   */
  const handlePublish = async (id: string) => {
    try {
      const response: any = await questionnaireApi.publish(id);
      if (response.success) {
        message.success('问卷已发布');
        updateQuestionnaire(id, { status: 'published' });
      }
    } catch (error) {
      message.error('发布失败');
    }
  };
  
  /**
   * 处理关闭问卷
   * @param id 问卷ID
   */
  const handleClose = async (id: string) => {
    try {
      const response: any = await questionnaireApi.close(id);
      if (response.success) {
        message.success('问卷已关闭');
        updateQuestionnaire(id, { status: 'closed' });
      }
    } catch (error) {
      message.error('关闭失败');
    }
  };
  
  /**
   * 处理删除问卷
   * @param id 问卷ID
   */
  const handleDelete = async (id: string) => {
    try {
      const response: any = await questionnaireApi.delete(id);
      if (response.success) {
        message.success('问卷已删除');
        removeQuestionnaire(id);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };
  
  /**
   * 表格列定义
   */
  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: any) => (
        <a onClick={() => navigate(`/admin/edit/${record._id}`)}>
          {text}
        </a>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusMap[status]?.color}>
          {statusMap[status]?.text}
        </Tag>
      ),
    },
    {
      title: '题目数',
      dataIndex: 'questions',
      key: 'questionCount',
      width: 100,
      render: (questions: any[]) => questions?.length || 0,
    },
    {
      title: '答卷数',
      dataIndex: 'answerCount',
      key: 'answerCount',
      width: 100,
      render: (count: number) => count || 0,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_: any, record: any) => (
        <Space size="small">
          {/* 编辑 */}
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/admin/edit/${record._id}`)}
          >
            编辑
          </Button>
          
          {/* 预览 */}
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => window.open(`/fill/${record._id}`, '_blank')}
          >
            预览
          </Button>
          
          {/* 统计 */}
          <Button
            type="text"
            icon={<BarChartOutlined />}
            onClick={() => navigate(`/admin/stats/${record._id}`)}
          >
            统计
          </Button>
          
          {/* 发布/关闭 */}
          {record.status === 'draft' && (
            <Button
              type="text"
              icon={<PlayCircleOutlined />}
              onClick={() => handlePublish(record._id)}
            >
              发布
            </Button>
          )}
          {record.status === 'published' && (
            <Button
              type="text"
              danger
              icon={<StopOutlined />}
              onClick={() => handleClose(record._id)}
            >
              关闭
            </Button>
          )}
          
          {/* 删除 */}
          <Popconfirm
            title="确认删除"
            description="删除后无法恢复，是否继续？"
            onConfirm={() => handleDelete(record._id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  
  return (
    <div>
      {/* 页面标题 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          问卷列表
        </Title>
        <Space size="middle">
          <Button
            type="default"
            icon={<FileTextOutlined />}
            onClick={() => setShowTemplateModal(true)}
            size="large"
          >
            从模板创建
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/admin/create')}
            size="large"
          >
            创建问卷
          </Button>
        </Space>
      </div>
      
      {/* 搜索和筛选 */}
      <Card style={{ marginBottom: 24 }}>
        <Space wrap>
          {/* 搜索框 */}
          <Input
            placeholder="搜索问卷标题"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            allowClear
          />
          <Button onClick={handleSearch}>搜索</Button>
          
          {/* 状态筛选 */}
          <Select
            placeholder="筛选状态"
            value={statusFilter || undefined}
            onChange={(value) => setStatusFilter(value)}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="draft">草稿</Option>
            <Option value="published">已发布</Option>
            <Option value="closed">已关闭</Option>
          </Select>
        </Space>
      </Card>
      
      {/* 问卷列表 */}
      <Table
        columns={columns}
        dataSource={questionnaires}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPagination({ page, limit: pageSize || 10 });
          },
        }}
      />

      {/* 模板选择弹窗 */}
      <TemplateSelectModal
        visible={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onSuccess={fetchQuestionnaires}
      />
    </div>
  );
};

export default QuestionnaireListPage;