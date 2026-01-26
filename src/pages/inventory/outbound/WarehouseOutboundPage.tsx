// src/pages/inventory/outbound/WarehouseOutboundPage.tsx
import {
  ArrowRight,
  CheckCircle,
  Package,
  Printer,
  Truck,
  XCircle,
  Filter,
  Layers,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  Grid
} from "antd";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOrderPrint } from "@/features/sales/hooks/useOrderPrint"; // [NEW]


import { useOutboundStore } from "@/features/inventory/stores/useOutboundStore";
import { outboundService } from "@/features/inventory/api/outboundService";
import { OutboundTask, OutboundDetailResponse } from "@/features/inventory/types/outbound";
import { WarehouseToolBar } from "@/shared/ui/warehouse-tools";
import { PickingListTemplate } from "@/features/inventory/components/print/PickingListTemplate";
import { ShippingLabelTemplate } from "@/features/inventory/components/print/ShippingLabelTemplate";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;
const { RangePicker } = DatePicker;

const WarehouseOutboundPage = () => {
  const navigate = useNavigate();
  const screens = useBreakpoint();

  // --- ZUSTAND STORE ---
  const {
      tasks,
      stats,
      loading,
      filters,
      totalCount,
      fetchTasks,
      fetchStats,
      setFilters,
      setPage,
      updatePackageCount,
      cancelTask
  } = useOutboundStore();

  // Local UI State
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [selectedTaskToCancel, setSelectedTaskToCancel] = useState<string | null>(null);
  
  // Print State
  const [printData, setPrintData] = useState<OutboundDetailResponse | null>(null);
  const [printingTaskId, setPrintingTaskId] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState<'picking' | 'label' | 'b2b' | null>(null);

  const { printOrder } = useOrderPrint(); // [NEW]

  // Initial Fetch
  useEffect(() => {
    fetchStats();
    fetchTasks();
  }, []);

  // --- HANDLERS ---
  const handleUpdatePackage = async (taskId: string, count: number) => {
     await updatePackageCount(taskId, count);
     message.success("Đã cập nhật số kiện");
  };

  const handleCancelConfirm = async () => {
     if (!selectedTaskToCancel || !cancelReason) return;
     try {
        await cancelTask(selectedTaskToCancel, cancelReason);
        message.success("Đã hủy nhiệm vụ");
        setCancelModalVisible(false);
        setCancelReason("");
     } catch (error) {
        message.error("Lỗi hủy đơn");
     }
  };

  const handleSmartScan = (code: string) => {
      // Find in current list
      const task = tasks.find((t) => t.code === code);
      if (task) {
        navigate(`/inventory/outbound/${task.task_id}`);
      } else {
        // Search Global
        setFilters({ search: code });
        message.info(`Đang tìm kiếm: ${code}`);
      }
  };
  
  const handlePrint = async (taskId: string, mode: 'picking' | 'label' | 'b2b') => {
      setPrintingTaskId(taskId);
      try {
          const detail = await outboundService.getOrderDetail(taskId);

          if (mode === 'b2b') {
              // Map Outbound Detail -> B2B Order format
              const orderData = {
                  ...detail.order_info,
                  items: detail.items,
                  customer_id: (detail.order_info as any).customer_id, // Ensure debt fetch works
                  final_amount: (detail.order_info as any).final_amount // Ensure total calculation works
              };
              await printOrder(orderData); // Use the Hook
              setPrintingTaskId(null);
              return;
          }

          setPrintData(detail);
          setPrintMode(mode);
          
          setTimeout(() => {
              window.print();
              setPrintingTaskId(null);
              setPrintMode(null);
          }, 500);
      } catch (error) {
          message.error("Lỗi chuẩn bị in");
          setPrintingTaskId(null);
          setPrintMode(null);
      }
  };

  // --- COLUMNS ---
  const columns = [
    {
      title: "Loại",
      dataIndex: "task_type",
      width: 100,
      render: (val: string) => (
         <Tag color={val === "Bán hàng" ? "blue" : "orange"} icon={val === "Bán hàng" ? <Truck size={12}/> : <Layers size={12}/>}>
            {val}
         </Tag>
      ),
    },
    {
      title: "Mã Đơn / Ngày tạo",
      dataIndex: "code",
      render: (text: string, record: OutboundTask) => (
        <div>
          <Text strong style={{ fontSize: 15 }}>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(record.created_at).toLocaleString("vi-VN", { month: "numeric", day: "numeric", hour: "2-digit", minute:"2-digit" })}
          </Text>
        </div>
      ),
    },
    {
      title: "Khách hàng",
      dataIndex: "customer_name",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Vận chuyển",
      dataIndex: "shipping_partner_name",
      render: (text: string, record: OutboundTask) => (
         <div>
            <Text>{text || "Tự giao hàng"}</Text>
            {(record.shipping_contact_name || record.shipping_contact_phone) && (
               <div style={{ fontSize: 12, color: "#666" }}>
                  {record.shipping_contact_name} - {record.shipping_contact_phone}
               </div>
            )}
         </div>
      ),
    },
    {
      title: "Số kiện",
      dataIndex: "package_count",
      width: 100,
      render: (val: number, record: OutboundTask) => (
          <InputNumber 
             defaultValue={val} 
             min={0} 
             max={100} 
             onBlur={(e) => {
                const newVal = parseInt(e.target.value) || 0;
                if (newVal !== val) handleUpdatePackage(record.task_id, newVal);
             }}
             onPressEnter={(e) => {
                const newVal = parseInt((e.target as HTMLInputElement).value) || 0;
                if (newVal !== val) handleUpdatePackage(record.task_id, newVal);
             }}
          />
      ),
    },
    {
        title: "Tiến độ nhặt",
        dataIndex: "progress_picked",
        width: 150,
        render: (_: number, record: OutboundTask) => {
            const percent = Math.round((record.progress_picked / (record.progress_total || 1)) * 100);
            return (
                <Progress 
                   percent={percent} 
                   size="small" 
                   status={percent === 100 ? "success" : "active"}
                   strokeColor={percent < 100 ? "#ff4d4f" : "#52c41a"} 
                />
            );
        }
    },
    {
      title: "Trạng thái",
      dataIndex: "status_label",
      width: 120,
      render: (val: string, record: OutboundTask) => {
          let color = "default";
          if (record.status === "CONFIRMED") color = "processing";
          if (record.status === "SHIPPING") color = "warning";
          if (record.status === "DELIVERED") color = "success";
          if (record.status === "CANCELLED") color = "error";
          
          return <Badge status={color as any} text={val} />;
      },
    },
    {
      title: "Thao tác",
      align: "right" as const,
      width: 140,
      render: (_: any, record: OutboundTask) => (
        <Space size={2}>
           <Tooltip title="In Phiếu nhặt hàng">
             <Button 
                icon={<Printer size={16} />} 
                size="small" 
                loading={printingTaskId === record.task_id && printMode === 'picking'}
                onClick={() => handlePrint(record.task_id, 'picking')}
             />
           </Tooltip>
           <Tooltip title="In Vận Đơn">
             <Button 
                icon={<Package size={16} />} 
                size="small" 
                loading={printingTaskId === record.task_id && printMode === 'label'}
                onClick={() => handlePrint(record.task_id, 'label')}
             />
           </Tooltip>
           <Tooltip title="In Hóa Đơn B2B">
             <Button 
                icon={<Printer size={16} />} 
                size="small" 
                loading={printingTaskId === record.task_id && printMode === 'b2b'}
                onClick={() => handlePrint(record.task_id, 'b2b')}
                style={{ color: '#1890ff', borderColor: '#1890ff' }}
             />
           </Tooltip>
           <Tooltip title="Hủy đơn">
             <Button 
                danger 
                icon={<XCircle size={16} />} 
                size="small" 
                onClick={() => {
                   setSelectedTaskToCancel(record.task_id);
                   setCancelModalVisible(true);
                }}
             />
           </Tooltip>
           <Button 
              type="primary" 
              ghost 
              icon={<ArrowRight size={16} />} 
              size="small"
              onClick={() => navigate(`/inventory/outbound/${record.task_id}`)}
           />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: screens.md ? 24 : 12, paddingBottom: 80, background: "#f5f5f5", minHeight: "100vh" }}>
      {/* HIDDEN PRINT COMPONENTS */}
      {printMode === 'picking' && <PickingListTemplate orderInfo={printData?.order_info || null} items={printData?.items || []} />}
      {printMode === 'label' && (
          <ShippingLabelTemplate 
            orderInfo={printData?.order_info || null} 
            packageCount={printData?.order_info?.package_count || 1} // Fetch from order info if available, else 1
          />
      )}

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Title level={4} style={{ margin: 0 }}>Danh sách phiếu Xuất Kho</Title>
          </div>

          {/* 1. STATS CARDS */}
          <Row gutter={[16, 16]}>
            <Col xs={8} md={8}>
              <Card bodyStyle={{ padding: 16 }}>
                <Statistic
                  title="Chờ đóng gói"
                  value={stats.pending_packing}
                  valueStyle={{ color: "#faad14" }}
                  prefix={<Package size={20} />}
                />
              </Card>
            </Col>
            <Col xs={8} md={8}>
              <Card bodyStyle={{ padding: 16 }}>
                <Statistic
                  title="Đang giao hàng"
                  value={stats.shipping}
                  valueStyle={{ color: "#1890ff" }}
                  prefix={<Truck size={20} />}
                />
              </Card>
            </Col>
            <Col xs={8} md={8}>
              <Card bodyStyle={{ padding: 16 }}>
                <Statistic
                  title="Hoàn tất hôm nay"
                  value={stats.completed_today}
                  valueStyle={{ color: "#52c41a" }}
                  prefix={<CheckCircle size={20} />}
                />
              </Card>
            </Col>
          </Row>

          {/* 2. FILTER BAR */}
          <Card bodyStyle={{ padding: 16 }}>
              <Row gutter={[16, 16]}>
                  <Col xs={24} md={8}>
                      <Input.Search 
                          placeholder="Tìm mã đơn, khách, SKU..." 
                          enterButton 
                          onSearch={(val) => setFilters({ search: val })} // Zustand Action
                          allowClear
                      />
                  </Col>
                  
                  <Col xs={12} md={4}>
                      <Select 
                          style={{ width: "100%" }} 
                          placeholder="Trạng thái"
                          allowClear
                          onChange={(val) => setFilters({ status: val || "All" })}
                      >
                          <Select.Option value="All">Tất cả</Select.Option>
                          <Select.Option value="CONFIRMED">Đã duyệt / Chờ đóng</Select.Option>
                          <Select.Option value="SHIPPING">Đang giao</Select.Option>
                          <Select.Option value="DELIVERED">Hoàn tất</Select.Option>
                          <Select.Option value="CANCELLED">Đã hủy</Select.Option>
                      </Select>
                  </Col>

                  <Col xs={12} md={5}>
                      <RangePicker 
                          style={{ width: "100%" }} 
                          format="DD/MM/YYYY"
                          onChange={(dates) => {
                              setFilters({
                                  date_from: dates ? dates[0]?.toISOString() : undefined,
                                  date_to: dates ? dates[1]?.toISOString() : undefined,
                              });
                          }}
                      />
                  </Col>

                  <Col xs={12} md={4}>
                      <Select 
                          style={{ width: "100%" }} 
                          placeholder="Loại đơn"
                          allowClear
                          onChange={(val) => setFilters({ type: val })}
                      >
                          <Select.Option value="Bán hàng">Bán hàng</Select.Option>
                          <Select.Option value="Chuyển kho">Chuyển kho</Select.Option>
                      </Select>
                  </Col>
                  
                   <Col xs={12} md={3} style={{ textAlign: "right" }}>
                      <Button icon={<Filter size={16} />}>Lọc thêm</Button>
                   </Col>
              </Row>
          </Card>

          {/* 3. TABLE */}
          <Card bodyStyle={{ padding: 0 }}>
              <Table
                  rowSelection={{
                      selectedRowKeys,
                      onChange: setSelectedRowKeys,
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
                      onChange: (page, pageSize) => setPage(page, pageSize), // Zustand Action
                      showTotal: (total) => `Tổng ${total} đơn`,
                  }}
                  scroll={{ x: 1000 }} 
              />
          </Card>
      </Space>

      {/* 4. TOOLS */}
      <WarehouseToolBar 
         onScan={handleSmartScan}
         onVoice={(text) => setFilters({ search: text })}
      />

       {/* MODAL: CANCEL */}
       <Modal
          title="Hủy Nhiệm vụ / Đơn hàng"
          open={cancelModalVisible}
          onOk={handleCancelConfirm}
          onCancel={() => setCancelModalVisible(false)}
          okText="Xác nhận Hủy"
          okButtonProps={{ danger: true }}
          cancelText="Bỏ qua"
       >
          <Text>Lý do hủy:</Text>
          <Input.TextArea 
             rows={3} 
             style={{ marginTop: 8 }} 
             placeholder="Nhập lý do..."
             value={cancelReason}
             onChange={(e) => setCancelReason(e.target.value)}
          />
       </Modal>
    </div>
  );
};

export default WarehouseOutboundPage;
