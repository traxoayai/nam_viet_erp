// src/pages/inventory/transfer/TransferListPage.tsx
import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, DatePicker } from 'antd';
import { PlusOutlined, ThunderboltOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useTransferStore } from '@/features/inventory/stores/useTransferStore';
import { AutoReplenishModal } from '@/features/inventory/components/transfer/AutoReplenishModal';
// columns defined inline below 
// Actually, strict requirements said "CREATE TransferListPage.tsx", I will put columns inside or separate if too large.
// I'll put columns inside for now to reduce file count unless complex.

const { RangePicker } = DatePicker;

const TransferListPage: React.FC = () => {
  const navigate = useNavigate();
  const {  
    transfers, 
    loading, 
    totalCount, 
    fetchList, 
    createAutoRequest 
  } = useTransferStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    page: 1,
    pageSize: 10,
    status: '',
    search: ''
  });

  useEffect(() => {
    fetchList(filters);
  }, [filters, fetchList]);

  const handleCreateAuto = async (warehouseId: number) => {
    const success = await createAutoRequest(warehouseId);
    if (success) {
      setModalOpen(false);
      fetchList(filters); // Refresh
    }
  };

  const getStatusTag = (status: string) => {
      switch (status) {
          case 'pending': return <Tag color="orange">Chờ duyệt</Tag>;
          case 'approved': return <Tag color="blue">Đã duyệt</Tag>;
          case 'shipping': return <Tag color="cyan">Đang chuyển</Tag>;
          case 'completed': return <Tag color="green">Hoàn thành</Tag>;
          case 'cancelled': return <Tag color="red">Đã hủy</Tag>;
          default: return <Tag>Unknown</Tag>;
      }
  };

  const tableColumns = [
    {
      title: 'Mã phiếu',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <b>{text}</b>
    },
    {
      title: 'Kho xuất',
      dataIndex: 'source_warehouse_name',
      key: 'source',
      render: (text: string) => text || '---'
    },
    {
      title: 'Kho nhập',
      dataIndex: 'dest_warehouse_name',
      key: 'dest',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status)
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('DD/MM/YYYY HH:mm')
    },
    {
      title: 'Hành động',
      key: 'action',
      align: 'center' as const,
      render: (_: any, record: any) => (
        <Button 
          type="text" 
          icon={<EyeOutlined />} 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/inventory/transfers/${record.id}`);
          }}
        />
      )
    },
  ];

  return (
    <div style={{ padding: 10 }}>
      <Card
        title="Danh sách điều chuyển kho"
        extra={
          <Space>
             <Button 
                type="primary" 
                icon={<ThunderboltOutlined />} 
                onClick={() => setModalOpen(true)}
                style={{ background: '#722ed1', borderColor: '#722ed1' }} // Purple for distinction
             >
                Tạo bù kho tự động (Min/Max)
             </Button>
            <Button type="default" icon={<PlusOutlined />} disabled>
              Tạo thủ công (Coming Soon)
            </Button>
          </Space>
        }
      >
        {/* FILTERS */}
        <Space style={{ marginBottom: 16 }}>
          <Input 
            placeholder="Tìm mã phiếu..." 
            prefix={<SearchOutlined />} 
            onChange={(e) => setFilters({...filters, search: e.target.value})}
            style={{ width: 500 }}
          />
          <Select 
            placeholder="Trạng thái"
            allowClear
            style={{ width: 150 }}
            options={[
                { value: 'pending', label: 'Chờ duyệt' },
                { value: 'approved', label: 'Đã duyệt' },
                { value: 'shipping', label: 'Đang chuyển' },
                { value: 'completed', label: 'Hoàn thành' },
            ]}
            onChange={(val) => setFilters({...filters, status: val})}
          />
          <RangePicker placeholder={['Từ ngày', 'Đến ngày']} />
        </Space>

        <Table
            dataSource={transfers}
            columns={tableColumns}
            rowKey="id"
            loading={loading}
            pagination={{
                current: filters.page,
                pageSize: filters.pageSize,
                total: totalCount,
                onChange: (page, pageSize) => setFilters({...filters, page, pageSize}),
                showSizeChanger: true
            }}
            onRow={(record) => ({
              onClick: () => navigate(`/inventory/transfers/${record.id}`),
              style: { cursor: 'pointer' }
            })}
        />
      </Card>

      <AutoReplenishModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onConfirm={handleCreateAuto}
        loading={loading}
      />
    </div>
  );
};

export default TransferListPage;
