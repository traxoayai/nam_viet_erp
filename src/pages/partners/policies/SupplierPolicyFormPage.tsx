// src/pages/partners/policies/SupplierPolicyFormPage.tsx
import React, { useEffect, useState } from "react";
import {
  Form,
  Button,
  Layout,
  Typography,
  Space,
  App,
  Spin,
  Affix,
} from "antd";
import { ArrowLeftOutlined, SaveOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import { supplierPolicyService } from "@/features/purchasing/api/supplierPolicyService";
import { useProductStore } from "@/features/product/stores/productStore";
import { PolicyHeader } from "./components/PolicyHeader";
import { PolicyGroupCard } from "./components/PolicyGroupCard";
import { PolicyProductModal } from "./components/PolicyProductModal";
import { PolicyFormValues } from "@/features/purchasing/types/supplierPolicy";

const { Title } = Typography;
const { Content } = Layout;

const SupplierPolicyFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id && id !== "new";
  const { message } = App.useApp();
  const [form] = Form.useForm();
  
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);

  const { fetchCommonData } = useProductStore();

  useEffect(() => {
    fetchCommonData();
    if (isEditMode) {
      loadDetail();
    }
  }, [id]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const data = await supplierPolicyService.getPolicyDetail(Number(id));
      if (!data) throw new Error("Không tìm thấy chính sách");
      
      const mapped = supplierPolicyService.mapToFormState(data);
      
      // Convert dates to Dayjs
      mapped.range_picker = [
          dayjs(mapped.range_picker[0] || data.valid_from),
          dayjs(mapped.range_picker[1] || data.valid_to)
      ];

      form.setFieldsValue(mapped);
    } catch (error: any) {
      message.error("Lỗi tải dữ liệu: " + error.message);
      navigate("/partners/policies");
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: PolicyFormValues) => {
    setLoading(true);
    try {
        if (!values.groups || values.groups.length === 0) {
            throw new Error("Vui lòng thêm ít nhất 1 nhóm chính sách!");
        }

        if (isEditMode) {
            await supplierPolicyService.updatePolicy(Number(id), values);
            message.success("Cập nhật thành công!");
        } else {
            await supplierPolicyService.createPolicy(values);
            message.success("Tạo mới thành công!");
        }
        navigate("/partners/policies");
    } catch (error: any) {
        console.error(error);
        message.error("Lỗi lưu dữ liệu: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  // Handle Product Selection from Modal
  const handleProductSelect = (products: any[]) => {
      if (activeGroupIndex === null) return;
      
      const groups = form.getFieldValue('groups');
      const currentGroup = groups[activeGroupIndex];
      
      // Merge unique
      const existingIds = new Set(currentGroup.product_ids || []);
      const newItems = products.filter(p => !existingIds.has(p.id));
      
      if (newItems.length === 0) return;

      groups[activeGroupIndex].product_ids = [
          ...(currentGroup.product_ids || []),
          ...newItems.map(p => p.id)
      ];
      groups[activeGroupIndex]._product_display = [
          ...(currentGroup._product_display || []),
          ...newItems
      ];
      
      form.setFieldsValue({ groups });
      message.success(`Đã thêm ${newItems.length} sản phẩm`);
  };

  return (
    <Content style={{ padding: 24, paddingBottom: 100 }}>
       <Spin spinning={loading}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          
          {/* HEADER ACTION */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/partners/policies')}>
                  Quay lại
              </Button>
              <Title level={4} style={{ margin: 0 }}>
                  {isEditMode ? "Chỉnh sửa Chính Sách / Hợp Đồng" : "Tạo Mới Chính Sách & Hợp Đồng"}
              </Title>
              <div />
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            initialValues={{ groups: [], type: 'contract' }}
          >
            {/* 1. GENERAL INFO */}
            <PolicyHeader />

            {/* 2. GROUPS */}
            <div style={{ marginTop: 24 }}>
                <Title level={5}>Cấu hình Chi tiết (Groups)</Title>
                <Form.List name="groups">
                    {(fields, { add, remove }) => (
                        <>
                            {fields.map((field, index) => (
                                <PolicyGroupCard 
                                    key={field.key} 
                                    field={field} 
                                    remove={remove} 
                                    form={form}
                                    openProductModal={() => {
                                        setActiveGroupIndex(index);
                                        setModalOpen(true);
                                    }}
                                />
                            ))}

                            <Button 
                                type="dashed" 
                                onClick={() => add({ name: '', rule_type: 'rebate_revenue', product_ids: [], _product_display: [] })} 
                                block 
                                icon={<PlusOutlined />}
                                style={{ height: 50 }}
                            >
                                + Thêm Nhóm Chính Sách
                            </Button>
                        </>
                    )}
                </Form.List>
            </div>
            
            {/* FOOTER AFFIX */}
            <Affix offsetBottom={0}>
                <div style={{ background: '#fff', padding: '12px 24px', borderTop: '1px solid #f0f0f0', textAlign: 'right', marginTop: 32, boxShadow: '0 -2px 8px rgba(0,0,0,0.06)' }}>
                    <Space>
                        <Button onClick={() => navigate('/partners/policies')}>Hủy bỏ</Button>
                        <Button type="primary" icon={<SaveOutlined />} htmlType="submit" loading={loading} size="large">
                            {isEditMode ? "Cập nhật" : "Lưu lại"}
                        </Button>
                    </Space>
                </div>
            </Affix>
          </Form>

          {/* MODAL */}
          <PolicyProductModal 
            open={modalOpen} 
            onCancel={() => setModalOpen(false)} 
            onSelect={handleProductSelect}
            // Optional: Pass supplier_id to filter products??
          />

        </div>
       </Spin>
    </Content>
  );
};

export default SupplierPolicyFormPage;
