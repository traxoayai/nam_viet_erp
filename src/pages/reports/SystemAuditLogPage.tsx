// src/pages/reports/SystemAuditLogPage.tsx
import { useState, useEffect } from 'react';
import { Table, Card, Typography, Space, Tag, Modal, Button, Row, Col, DatePicker, Select, Input } from 'antd';
import { EyeOutlined, SearchOutlined, LinkOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { safeRpc } from '@/shared/lib/safeRpc';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

// Type từ CORE
export interface SystemLog {
  id: number;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  module: string;
  record_id: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  created_at: string;
  user_id: string | null;
  user_name: string;
}

const SystemAuditLogPage = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [moduleFilter, setModuleFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await safeRpc('get_system_logs', {
        p_page: page,
        p_page_size: pageSize,
        p_module: moduleFilter || null,
        p_action: actionFilter || null,
        p_date_from: dateRange?.[0] || null,
        p_date_to: dateRange?.[1] || null,
      });
      setLogs(data?.data || []);
      setTotal(data?.total_count || 0);
    } catch (err: any) {
      // safeRpc handles logging
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, pageSize, actionFilter, dateRange]);

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const getDirectLink = (module: string, record_id: string) => {
    switch (module) {
      case 'products':
        return `/inventory/edit/${record_id}`;
      case 'orders':
        return `/b2b/orders/${record_id}`;
      case 'inventory_transfers':
        return `/inventory/outbound/${record_id}`;
      default:
        return null;
    }
  };

  const getActionTag = (action: string) => {
    switch (action) {
      case 'INSERT': return <Tag color="green">THÊM MỚI</Tag>;
      case 'UPDATE': return <Tag color="blue">CẬP NHẬT</Tag>;
      case 'DELETE': return <Tag color="red">XÓA</Tag>;
      default: return <Tag>{action}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      width: 150,
      render: (val: string) => dayjs(val).format('DD/MM/YYYY HH:mm:ss')
    },
    {
      title: 'Người thao tác',
      dataIndex: 'user_name',
      width: 150,
      render: (val: string) => <Text strong>{val}</Text>
    },
    {
      title: 'Module (Bảng)',
      dataIndex: 'module',
      width: 150,
      render: (val: string) => <Tag color="cyan">{val}</Tag>
    },
    {
      title: 'Thao tác',
      dataIndex: 'action',
      width: 100,
      render: (val: string) => getActionTag(val)
    },
    {
      title: 'ID Bản ghi',
      dataIndex: 'record_id',
      width: 150,
      render: (val: string) => <Text code>{val}</Text>
    },
    {
      title: 'Chi tiết',
      width: 180,
      align: 'center' as const,
      render: (_: any, record: SystemLog) => {
        const directLink = getDirectLink(record.module, record.record_id);
        return (
          <Space>
            <Button 
              type="text" 
              icon={<EyeOutlined />} 
              onClick={() => {
                setSelectedLog(record);
                setIsModalOpen(true);
              }}
            >
              Xem
            </Button>
            {directLink && (
              <Link to={directLink}>
                <Button type="text" icon={<LinkOutlined />}>
                  Đi tới
                </Button>
              </Link>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <Card title={<Title level={4} style={{ margin: 0 }}>Nhật ký Hệ thống (Audit Logs)</Title>}>
      {/* Filters */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Input 
            placeholder="Tìm theo Module (Ví dụ: products)" 
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            onPressEnter={handleSearch}
            suffix={<SearchOutlined onClick={handleSearch} style={{cursor: 'pointer'}} />}
            allowClear
          />
        </Col>
        <Col xs={24} md={4}>
          <Select 
            style={{ width: '100%' }} 
            placeholder="Lọc thao tác" 
            allowClear
            onChange={(val) => setActionFilter(val || '')}
            options={[
              { label: 'THÊM MỚI', value: 'INSERT' },
              { label: 'CẬP NHẬT', value: 'UPDATE' },
              { label: 'XÓA', value: 'DELETE' },
            ]}
          />
        </Col>
        <Col xs={24} md={8}>
          <RangePicker 
            style={{ width: '100%' }} 
            showTime 
            onChange={(dates) => {
              setDateRange(dates ? [dates[0]!.toISOString(), dates[1]!.toISOString()] : null);
            }} 
          />
        </Col>
      </Row>

      {/* Table */}
      <Table 
        columns={columns} 
        dataSource={logs} 
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); }
        }}
        scroll={{ x: 'max-content' }}
      />

      {/* Detail Modal */}
      <Modal
        title={`Chi tiết thao tác: ${selectedLog?.action} trên bảng ${selectedLog?.module}`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[<Button key="close" onClick={() => setIsModalOpen(false)}>Đóng</Button>]}
        width={800}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Text strong style={{ color: '#cf1322' }}>Dữ liệu CŨ (Old Data):</Text>
            <pre style={{ background: '#fff1f0', padding: 10, borderRadius: 4, maxHeight: 400, overflow: 'auto', fontSize: 12 }}>
              {selectedLog?.old_data ? JSON.stringify(selectedLog.old_data, null, 2) : 'Không có dữ liệu'}
            </pre>
          </Col>
          <Col span={12}>
            <Text strong style={{ color: '#389e0d' }}>Dữ liệu MỚI (New Data):</Text>
            <pre style={{ background: '#f6ffed', padding: 10, borderRadius: 4, maxHeight: 400, overflow: 'auto', fontSize: 12 }}>
              {selectedLog?.new_data ? JSON.stringify(selectedLog.new_data, null, 2) : 'Không có dữ liệu'}
            </pre>
          </Col>
        </Row>
      </Modal>
    </Card>
  );
};

export default SystemAuditLogPage;
