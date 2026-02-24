// src/pages/inventory/receipt/WarehouseInboundPage.tsx
import {
  ArrowRight,
  Calendar,
  CheckCircle,
  Filter,
  Package,
  Printer,
  Truck
} from "lucide-react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Progress,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Grid,
} from "antd";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useState } from "react";

import { useInboundList } from "@/features/inventory/hooks/useInboundList";
import { InboundTask } from "@/features/inventory/types/inbound";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { useBreakpoint } = Grid;

const WarehouseInboundPage = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();
  
  // Clean Logic Hook
  const {
      tasks,
      totalCount,
      loading,
      filters,
      setPage,
      handleSearch,
      handleStatusChange,
      handleDateChange,      
  } = useInboundList();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Columns Configuration
  const columns = [
    {
      title: "Mã PO",
      dataIndex: "code",
      width: 150,
      render: (text: string) => (
         <Text strong style={{ fontSize: 14 }}>{text}</Text>
      ),
    },
    {
      title: "Ngày nhập kho",
      dataIndex: "created_at",
      width: 140,
      render: (date: string) => date ? (
         <div style={{ display: 'flex', flexDirection: 'column' }}>
             <span style={{ fontWeight: 500, fontSize: 13 }}>{dayjs(date).format("DD/MM/YYYY")}</span>
             <span style={{ fontSize: 12, color: "#888" }}>{dayjs(date).format("HH:mm")}</span>
         </div>
      ) : <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: "Nhà cung cấp / Logistics",
      dataIndex: "supplier_name",
      render: (text: string, record: InboundTask) => (
        <div>
           <div style={{ fontWeight: 500 }}>{text}</div>
           {record.carrier_name && (
               <div style={{ fontSize: 10, color: "#666", display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                   <Truck size={12}/> 
                   {record.carrier_name} 
                   {record.carrier_contact && <span>- {record.carrier_contact}</span>}
               </div>
           )}
        </div>
      ),
    },
    {
      title: "Thông tin kiện",
      dataIndex: "total_packages",
      width: 120,
      render: (val: number) => val ? (
         <Tag icon={<Package size={12}/>} color="default">{val} kiện</Tag>
      ) : <span style={{color: '#ccc'}}>-</span>
    },
    {
      title: "Dự kiến về",
      dataIndex: "expected_delivery_time", // Or expected_delivery_date based on API
      width: 150,
      render: (date: string) => date ? (
         <Space size={4}>
            <Calendar size={14} color="#666"/>
            <span>{dayjs(date).format("HH:mm DD/MM")}</span>
         </Space>
      ) : "—",
    },
    {
      title: "Tiến độ nhập",
      dataIndex: "progress_percent",
      width: 160,
      render: (percent: number, record: InboundTask) => (
         <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                <span>{record.item_count}/{record.total_count} SP</span>
                <span>{percent}%</span>
            </div>
            <Progress 
                percent={percent} 
                showInfo={false} 
                size="small" 
                status={percent === 100 ? "success" : "active"}
                strokeColor={percent === 100 ? "#52c41a" : "#1890ff"} 
            />
         </div>
      )
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      width: 120,
      render: (status: string) => {
        let color = "default";
        let text = "Chờ nhập";
        
        if (status === "partial") {
            color = "processing";
            text = "Đang nhập";
        } else if (status === "completed") {
            color = "success";
            text = "Hoàn tất";
        }

        return <Tag color={color}>{text.toUpperCase()}</Tag>;
      },
    },
    {
      title: "Thao tác",
      align: "right" as const,
      width: 130,
      render: (_: any, record: InboundTask) => (
        <Button 
           type="primary" 
           size="small"
           icon={record.status === 'completed' ? <CheckCircle size={14}/> : <ArrowRight size={14}/>}
           ghost={record.status !== 'pending'}
           onClick={() => navigate(`/inventory/receipt/${record.task_id}`)}
        >
            {record.status === 'completed' ? "Xem" : "Nhập kho"}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: screens.md ? 24 : 12, paddingBottom: 80, background: "#f5f5f5", minHeight: "100vh" }}>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
           <Space align="center" size={12}>
               <div style={{ 
                   width: 40, height: 40, 
                   background: "#e6f7ff", 
                   borderRadius: 8, 
                   display: "flex", alignItems: "center", justifyContent: "center"
               }}>
                   <Package size={24} color="#1890ff" />
               </div>
               <div>
                   <Title level={4} style={{ margin: 0 }}>Nhập Kho (Inbound)</Title>
                   <Text type="secondary">Quản lý nhận hàng & PO</Text>
               </div>
           </Space>
        </div>

        {/* FILTER BAR */}
        <Card bodyStyle={{ padding: 16 }} bordered={false}>
            <Row gutter={[16, 16]} align="middle">
                <Col xs={24} md={8}>
                    <Input.Search 
                        placeholder="Tìm mã PO, Nhà cung cấp, Vận đơn..."
                        onSearch={handleSearch}
                        enterButton
                        allowClear
                    />
                </Col>
                <Col xs={12} md={4}>
                    <Select 
                        style={{ width: "100%" }} 
                        placeholder="Trạng thái"
                        allowClear
                        value={filters.status === 'all' ? undefined : filters.status}
                        onChange={(val) => handleStatusChange(val || 'all')}
                    >
                        <Select.Option value="all">Tất cả</Select.Option>
                        <Select.Option value="pending">Chờ nhập</Select.Option>
                        <Select.Option value="partial">Đang nhập</Select.Option>
                        <Select.Option value="completed">Đã xong</Select.Option>
                    </Select>
                </Col>
                <Col xs={12} md={6}>
                     <RangePicker 
                         style={{ width: "100%" }}
                         format="DD/MM/YYYY"
                         onChange={handleDateChange}
                     />
                </Col>
                
                {/* Actions when selected */}
                {selectedRowKeys.length > 0 && (
                     <Col xs={24} md={6} style={{ textAlign: "right" }}>
                         <Button icon={<Printer size={16}/>}>In phiếu xếp kệ ({selectedRowKeys.length})</Button>
                     </Col>
                )}
                
                {selectedRowKeys.length === 0 && (
                     <Col xs={24} md={6} style={{ textAlign: "right" }}>
                         <Button icon={<Filter size={16}/>}>Bộ lọc nâng cao</Button>
                     </Col>
                )}
            </Row>
        </Card>

        {/* TABLE */}
        <Card bodyStyle={{ padding: 0 }} bordered={false}>
            <Table
                rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys
                }}
                loading={loading}
                columns={columns}
                dataSource={tasks}
                rowKey="task_id"
                pagination={{
                    current: filters.page,
                    pageSize: filters.pageSize,
                    total: totalCount,
                    showSizeChanger: true,
                    onChange: (p, ps) => setPage(p, ps),
                    showTotal: (total) => `Tổng ${total} đơn` 
                }}
                scroll={{ x: 900 }}
            />
        </Card>
      </Space>
    </div>
  );
};

export default WarehouseInboundPage;
