import { useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Mic,
  Printer,
  Upload
} from "lucide-react";
import {
  Affix,
  Button,
  Card,
  DatePicker,
  Grid,
  Input,
  InputNumber,
  Row,
  Col,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  Result,
  Empty,
  message, // [NEW]
} from "antd";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import { useInboundDetail } from "@/features/inventory/hooks/useInboundDetail";
import { InboundDetailItem } from "@/features/inventory/types/inbound";
import { PutawayListTemplate } from "@/features/inventory/components/print/PutawayListTemplate";
import { supabase } from "@/shared/lib/supabaseClient"; 
import { ScannerListener } from "@/shared/ui/warehouse-tools/ScannerListener"; // [NEW]
import { BarcodeAssignModal } from "@/features/product/components/BarcodeAssignModal"; // [NEW]
import { useRowFlasher } from "@/shared/hooks/useRowFlasher"; // [NEW]

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const WarehouseReceiptPage = () => {
  const params = useParams();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  
  // [NEW] Row Flasher Hook
  const { highlightedKey, flash } = useRowFlasher();

  // FIX ID LOGIC: Handle id, poId, taskId
  const idStr = params.id || params.poId || params.taskId;

  const {
      detail,
      workingItems,
      loading,
      error,
      isSubmitting,
      updateWorkingItem,
      handleSubmit,
      handleVoiceCommand,
      handleCameraScan,
      handleDocUpload
  } = useInboundDetail(idStr);

  // [NEW] Integration Logic
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState("");

  const handleScan = async (code: string) => {
      // 1. Kiểm tra Local trước (Ưu tiên sản phẩm đã có trong phiếu)
      // Tìm theo Barcode hoặc SKU
      const existingItem = workingItems.find(i => i.barcode === code || i.sku === code);

      if (existingItem) {
          // [LOGIC] Tự động tăng số lượng
          const newQty = (existingItem.input_quantity || 0) + 1;
          updateWorkingItem(existingItem.product_id, { input_quantity: newQty });
          
          message.success(`Đã nhập thêm: ${existingItem.product_name}`);
          flash(existingItem.product_id); // [NEW] Flash UI
          return;
      }

      const hide = message.loading("Tra cứu...", 0);
      try {
          // 2. Lookup via RPC
          const { data } = await supabase.rpc('search_products_pos', {
             p_keyword: code,
             p_limit: 1,
             p_warehouse_id: 0 // Global search or use proper ID if available
          });

          if (data && data.length > 0) {
              const product = data[0];
              // Check again by ID in case barcode mismatch locally
              const item = workingItems.find(i => i.product_id === product.id);
              if (item) {
                  updateWorkingItem(item.product_id, { input_quantity: (item.input_quantity || 0) + 1 });
                  message.success(`Đã +1: ${product.name}`);
                  flash(item.product_id);
              } else {
                  message.warning(`Sản phẩm "${product.name}" không có trong phiếu nhập này!`);
              }
          } else {
               // Not found -> Quick Assign
               setUnknownBarcode(code);
               setAssignModalVisible(true);
          }
      } catch (err) {
          console.error(err);
      } finally {
          hide();
      }
  };

  const handleAssignSuccess = (product: any) => {
        setAssignModalVisible(false);
        const item = workingItems.find(i => i.product_id === product.id);
        if (item) {
            updateWorkingItem(item.product_id, { input_quantity: (item.input_quantity || 0) + 1 });
            message.success(`Đã gán mã & Nhập thêm: ${product.name}`);
            flash(item.product_id);
        } else {
            message.warning(`Đã gán mã cho "${product.name}", nhưng sản phẩm này không nằm trong phiếu nhập!`);
        }
  };

  // --- COLUMNS ---
  const columns = [
    {
      title: "Sản phẩm",
      dataIndex: "product_name",
      width: 250,
      render: (text: string, record: InboundDetailItem) => (
          <Space>
              <div style={{ width: 48, height: 48, background: "#f0f0f0", borderRadius: 4, overflow: "hidden" }}>
                  <img src={record.image_url || "https://placehold.co/48"} alt="" style={{width: "100%", height: "100%", objectFit: "cover"}}/>
              </div>
              <div>
                  <div style={{ fontWeight: 600 }}>{text}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{record.sku}</div>
              </div>
          </Space>
      )
    },
    {
       title: "ĐVT",
       dataIndex: "unit",
       width: 80,
       align: "center" as const
    },
    {
      title: "Tiến độ",
      width: 50,
      render: (_: any, record: InboundDetailItem) => {
          const received = record.quantity_received_prev;
          const total = record.quantity_ordered;
          const remaining = record.quantity_remaining;
          const isFull = remaining <= 0;

          return (
              <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span>Đã về: <b>{received}</b>/{total}</span>
                  </div>
                  {isFull ? <Tag color="success">Đủ hàng</Tag> : <Text type="warning" style={{ fontSize: 12 }}>Thiếu: {remaining}</Text>}
              </div>
          );
      }
    },
    {
      title: "Số Lượng Nhập",
      width: 50,
      render: (_: any, record: InboundDetailItem) => (
          <InputNumber 
              min={0}
              value={record.input_quantity}
              onChange={(val) => updateWorkingItem(record.product_id, { input_quantity: val || 0 })}
              style={{ width: "100%" }}
              disabled={record.quantity_remaining <= 0}
              placeholder="0"
              status={((record.input_quantity || 0) > 0) ? "warning" : ""}
          />
      )
    },
    // SPLIT COLUMNS LOGIC
    {
        title: "Số Lô (Batch)",
        width: 100,
        render: (_: any, record: InboundDetailItem) => {
             if (record.stock_management_type !== 'lot_date') return <Text disabled>--</Text>;
             return (
                 <Input 
                    placeholder="Nhập số lô"
                    value={record.input_lot}
                    onChange={(e) => updateWorkingItem(record.product_id, { input_lot: e.target.value })}
                    disabled={(record.input_quantity || 0) === 0}
                 />
             )
        }
    },
    {
        title: "Hạn Sử Dụng",
        width: 100,
        render: (_: any, record: InboundDetailItem) => {
             if (record.stock_management_type !== 'lot_date') return <Text disabled>--</Text>;
             return (
                 <DatePicker 
                    placeholder="Chọn ngày"
                    style={{ width: "100%" }}
                    format="DD/MM/YYYY"
                    value={record.input_expiry ? dayjs(record.input_expiry) : null}
                    onChange={(date) => updateWorkingItem(record.product_id, { input_expiry: date ? date.toISOString() : undefined })}
                    disabled={(record.input_quantity || 0) === 0}
                 />
             )
        }
    }
  ];

  if (!idStr) return <Result status="404" title="URL không hợp lệ" subTitle="Không tìm thấy mã phiếu nhập" extra={<Button type="primary" onClick={() => navigate("/inventory/inbound")}>Quay lại</Button>} />;

  if (loading) return <div style={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}><Spin size="large"/></div>;
  if (error) return <Result status="error" title="Lỗi" subTitle={error} extra={<Button onClick={() => navigate("/inventory/inbound")}>Quay lại</Button>} />;
  if (!detail) return <Empty description="Không tìm thấy dữ liệu"/>;

  const handlePrintPutaway = () => {
      window.print();
  };

  return (
    <div style={{ padding: screens.md ? 24 : 12, paddingBottom: 100, background: "#f5f5f5", minHeight: "100vh" }}>
        
        {/* HEADER & TOOLS */}
        <Card bodyStyle={{ padding: "16px 24px" }} style={{ marginBottom: 16 }} bordered={false}>
            <Row justify="space-between" align="middle" gutter={[16, 16]}>
                <Col>
                    <Space align="center">
                         <Button icon={<ArrowLeft size={18}/>} onClick={() => navigate("/inventory/inbound")} type="text"/>
                         <div>
                             <Title level={4} style={{ margin: 0 }}>{detail.po_info.code} - {detail.po_info.supplier_name}</Title>
                         </div>
                         <Tag color="geekblue">{detail.po_info.status}</Tag>
                    </Space>
                </Col>
                <Col>
                    <Space>
                        <Tooltip title="Đọc lệnh: 'Số lượng 50, Lô A123'">
                           <Button icon={<Mic size={16}/>} onClick={handleVoiceCommand} shape="circle" size="large"/>
                        </Tooltip>
                        <Tooltip title="Quét Camera AI">
                           <Button icon={<Camera size={16}/>} onClick={handleCameraScan} shape="circle" size="large"/>
                        </Tooltip>
                        <Tooltip title="Upload phiếu giao hàng">
                           <Button icon={<Upload size={16}/>} onClick={() => handleDocUpload(new File([], ""))} shape="circle" size="large"/>
                        </Tooltip>
                    </Space>
                </Col>
            </Row>
        </Card>

        {/* MAIN TABLE */}
        <Card bodyStyle={{ padding: 0 }} title="Danh sách hàng nhập" bordered={false}>
            <Table
                columns={columns}
                dataSource={workingItems}
                rowKey="product_id"
                pagination={false}
                scroll={{ x: 1000 }}
                // [NEW] Highlight row animation
                rowClassName={(record) => String(record.product_id) === highlightedKey ? "flash-row" : ""}
            />
        </Card>

        {/* FOOTER ACTIONS */}
        <Affix offsetBottom={0}>
            <div style={{ 
                padding: "16px 24px", 
                background: "#fff", 
                boxShadow: "0 -2px 10px rgba(0,0,0,0.05)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderTop: "1px solid #f0f0f0"
            }}>
                <Button icon={<Printer size={16}/>} onClick={handlePrintPutaway}>In Phiếu Xếp Kệ</Button>
                
                <Space>
                    <Button onClick={() => navigate("/inventory/inbound")}>Thoát</Button>
                    <Button 
                        type="primary" 
                        icon={<CheckCircle size={16}/>} 
                        size="large"
                        onClick={handleSubmit}
                        loading={isSubmitting}
                        disabled={detail.po_info.status === 'completed'}
                    >
                        Hoàn tất Nhập Kho
                    </Button>
                </Space>
            </div>
        </Affix>

        {/* PRINT TEMPLATE */}
        <PutawayListTemplate 
            items={workingItems.filter(i => (i.input_quantity || 0) > 0)} 
            poCode={detail.po_info.code}
        />

        {/* [NEW] Tools */}
        <ScannerListener onScan={handleScan} enabled={true} />
        <BarcodeAssignModal 
            visible={assignModalVisible}
            scannedBarcode={unknownBarcode}
            onCancel={() => setAssignModalVisible(false)}
            onSuccess={handleAssignSuccess}
        />
    </div>
  );
};

export default WarehouseReceiptPage;
