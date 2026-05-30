import { useState, useEffect } from "react";
import { Typography, Card, Row, Col, Button, Select, Space, message } from "antd";
import { SaveOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/shared/lib/supabaseClient";

import { SupplierInfoCard } from "../../features/purchasing-v2/components/SupplierInfoCard";
import { ShippingInfoCard } from "../../features/purchasing-v2/components/ShippingInfoCard";
import { PromotionsCard } from "../../features/purchasing-v2/components/PromotionsCard";
import { ProductSelectionLayout } from "../../features/purchasing-v2/components/ProductSelectionLayout";


const { Title, Text } = Typography;
const { Option } = Select;

export default function PurchaseV2CreateSinglePage() {
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [shippingPartners, setShippingPartners] = useState<any[]>([]);
  
  const [supplierInfo, setSupplierInfo] = useState<any>(null);
  const [supplierLoading, setSupplierLoading] = useState(false);
  
  const [shippingPartnerInfo, setShippingPartnerInfo] = useState<any>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingType, setShippingType] = useState<string>("app");
  const [shippingNote, setShippingNote] = useState<string>("");

  const [promotions, setPromotions] = useState<any[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);

  const [totalAmount, setTotalAmount] = useState<number>(0);

  useEffect(() => {
    fetchBaseData();
  }, []);

  const fetchBaseData = async () => {
    try {
      const [suppRes, partnerRes] = await Promise.all([
        supabase.from("suppliers").select("id, name, tax_code").eq("status", "active"),
        supabase.from("shipping_partners").select("id, name").eq("status", "active")
      ]);
      if (suppRes.data) setSuppliers(suppRes.data);
      if (partnerRes.data) setShippingPartners(partnerRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSupplierChange = async (id: number) => {
    setSupplierLoading(true);
    setPromotionsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("info-supplier", {
        body: { id },
      });
      if (error) throw error;
      setSupplierInfo(data?.data);

      const promoRes = await supabase.functions.invoke("info-supplier-programs", {
        body: { id },
      });
      if (promoRes.data) {
        setPromotions(promoRes.data.data || []);
      }
    } catch (err: any) {
      message.error("Lỗi lấy thông tin NCC: " + err.message);
    } finally {
      setSupplierLoading(false);
      setPromotionsLoading(false);
    }
  };

  const handlePartnerChange = async (id: number) => {
    setShippingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("info-shipping-partner", {
        body: { id },
      });
      if (error) throw error;
      setShippingPartnerInfo(data?.data);
      if (data?.data?.type) setShippingType(data.data.type);
    } catch (err: any) {
      message.error("Lỗi lấy thông tin ĐVVC: " + err.message);
    } finally {
      setShippingLoading(false);
    }
  };

  const handleSave = () => {
    message.success("Đơn hàng đang được lưu (chức năng đang hoàn thiện)!");
  };

  return (
    <div style={{ padding: 24, minHeight: '100vh', background: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/inventory/purchase-v2")} />
          <Title level={4} style={{ margin: 0 }}>Tạo Đơn Lẻ</Title>
        </Space>
        
        <Space>
          <div style={{ background: '#fff', padding: '4px 16px', borderRadius: 4, border: '1px solid #d9d9d9' }}>
            <Text type="secondary">Tổng tiền: </Text>
            <Text strong style={{ fontSize: 18, color: '#f5222d' }}>
              {new Intl.NumberFormat('vi-VN').format(totalAmount)} đ
            </Text>
          </div>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>Lưu Đơn Hàng</Button>
        </Space>
      </div>

      {/* Selectors */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Chọn Nhà Cung Cấp *</Text>
            <Select 
              showSearch
              style={{ width: '100%' }} 
              placeholder="Gõ để tìm nhà cung cấp..."
              optionFilterProp="children"
              onChange={handleSupplierChange}
            >
              {suppliers.map(s => <Option key={s.id} value={s.id}>{s.name} - {s.tax_code}</Option>)}
            </Select>
          </Col>
          <Col span={8}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Chọn Đơn Vị Vận Chuyển *</Text>
            <Select 
              showSearch
              style={{ width: '100%' }} 
              placeholder="Gõ để tìm ĐVVC..."
              optionFilterProp="children"
              onChange={handlePartnerChange}
            >
              {shippingPartners.map(s => <Option key={s.id} value={s.id}>{s.name}</Option>)}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* 3 Info Blocks */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <SupplierInfoCard 
            supplier={supplierInfo} 
            loading={supplierLoading} 
            note={shippingNote}
            onNoteChange={setShippingNote}
          />
        </Col>
        <Col span={8}>
          <ShippingInfoCard 
            partner={shippingPartnerInfo} 
            loading={shippingLoading} 
            supplierLeadTime={supplierInfo?.lead_time || 0}
            shippingType={shippingType}
            onShippingTypeChange={setShippingType}
          />
        </Col>
        <Col span={8}>
          <PromotionsCard programs={promotions} loading={promotionsLoading} />
        </Col>
      </Row>

      {/* Main Product Selection Layout */}
      <ProductSelectionLayout onTotalChange={setTotalAmount} />

    </div>
  );
}
