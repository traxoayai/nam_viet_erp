import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Typography,
  Popconfirm,
  Select,
  Upload,
  Tag,
  Row,
  Col,
} from "antd";
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  UploadOutlined, 
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined
} from "@ant-design/icons";
import { App as AntApp } from "antd";
import * as XLSX from "xlsx";

import { supabase } from "@/shared/lib/supabaseClient";
import DebounceProductSelect from "@/shared/ui/common/DebounceProductSelect";

const { Text, Title } = Typography;

interface SupplierProductMappingTabProps {
  vendorTaxCode: string;
  vendorId?: number;
  vendorName?: string;
}

const SupplierProductMappingTab: React.FC<SupplierProductMappingTabProps> = ({
  vendorTaxCode,
  vendorId,
  vendorName,
}) => {
  const { message } = AntApp.useApp();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Normal Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [productUnits, setProductUnits] = useState<any[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);

  // Import Review Mode State
  const [importReviewMode, setImportReviewMode] = useState(false);
  const [importedItems, setImportedItems] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [savingImport, setSavingImport] = useState(false);

  useEffect(() => {
    if (vendorTaxCode) {
      fetchMappings();
    }
  }, [vendorTaxCode]);

  useEffect(() => {
    if (selectedProductId) {
      fetchProductUnits(selectedProductId);
    } else {
      setProductUnits([]);
    }
  }, [selectedProductId]);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const { data: mappings, error } = await supabase
        .from("vendor_product_mappings")
        .select(`
          *,
          products:internal_product_id(id, name, sku),
          product_units:internal_product_unit_id(id, unit_name)
        `)
        .eq("vendor_tax_code", vendorTaxCode)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setData(mappings || []);
    } catch (error: any) {
      message.error("Lỗi khi tải danh sách ánh xạ: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductUnits = async (productId: number) => {
    setUnitsLoading(true);
    try {
      const { data: units, error } = await supabase
        .from("product_units")
        .select("id, unit_name, conversion_rate, unit_type")
        .eq("product_id", productId);
        
      if (error) throw error;
      setProductUnits(units || []);
    } catch (error: any) {
      message.error("Lỗi tải danh sách ĐVT: " + error.message);
    } finally {
      setUnitsLoading(false);
    }
  };

  // ----- EXPORT / IMPORT EXCEL -----
  const handleExportExcel = () => {
    if (!data || data.length === 0) {
      message.warning("Không có dữ liệu để xuất.");
      return;
    }
    const exportData = data.map((item) => ({
      "Tên Nhà Cung Cấp": vendorName || "NCC",
      "Mã số Thuế": item.vendor_tax_code,
      "Mã SKU NCC": item.supplier_sku || "",
      "Tên sản phẩm NCC": item.vendor_product_name || "",
      "Đơn vị tính NCC": item.vendor_unit || "",
      "Giá trước VAT": item.pre_vat_price || 0,
      "Thuế VAT": item.vat_of_supplier || 0,
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Anh_Xa_SP");
    XLSX.writeFile(wb, `Mapping_${vendorTaxCode}.xlsx`);
  };

  const handleImportExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsImporting(true);
      try {
        const fileData = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(fileData, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonArray: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        const itemsForRpc = jsonArray.map((row: any) => ({
          sku: row["Mã SKU NCC"] || row["supplier_sku"] || "",
          name: row["Tên sản phẩm NCC"] || row["vendor_product_name"] || "",
          unit: row["Đơn vị tính NCC"] || row["vendor_unit"] || "",
          quantity: 1,
          unit_price: row["Giá trước VAT"] || row["pre_vat_price"] || 0,
          vat_of_supplier: row["Thuế VAT"] || row["vat_of_supplier"] || 0,
        })).filter(item => item.name); // Bỏ qua dòng trống tên

        if (itemsForRpc.length === 0) {
          message.warning("File Excel không có dữ liệu hợp lệ (Thiếu Tên SP).");
          setIsImporting(false);
          return;
        }

        if (!vendorId) {
          message.error("Lỗi: Chưa có ID Nhà cung cấp (Vui lòng tải lại trang).");
          setIsImporting(false);
          return;
        }

        message.loading({ content: "AI đang phân tích và đối chiếu...", key: "ai_mapping" });

        const { data: rpcData, error } = await supabase.rpc("map_scanned_invoice_products" as any, {
          p_vendor_id: vendorId,
          p_items: itemsForRpc
        });

        if (error) throw error;

        const rpcArray = (rpcData as any[]) || [];

        // Gom nhóm các ID SP để fetch ĐVT
        const matchedProductIds = Array.from(new Set(
          rpcArray.map((r: any) => r.internal_product_id as number).filter(Boolean)
        ));

        let unitsMap: Record<number, any[]> = {};
        if (matchedProductIds.length > 0) {
          const { data: unitsData } = await supabase
            .from("product_units")
            .select("id, product_id, unit_name")
            .in("product_id", matchedProductIds);
          
          if (unitsData) {
            unitsMap = unitsData.reduce((acc, curr) => {
              if (curr.product_id) {
                if (!acc[curr.product_id]) acc[curr.product_id] = [];
                acc[curr.product_id].push(curr);
              }
              return acc;
            }, {} as Record<number, any[]>);
          }
        }

        // Tạo mảng hiển thị lên Review Table
        const mergedItems = itemsForRpc.map((orig, index) => {
          const mapped = rpcArray[index];
          return {
            key: index,
            supplier_sku: orig.sku,
            vendor_product_name: orig.name,
            vendor_unit: orig.unit,
            pre_vat_price: orig.unit_price,
            vat_of_supplier: orig.vat_of_supplier,
            internal_product_id: mapped?.internal_product_id || null,
            internal_product_name: mapped?.internal_product_name || "",
            internal_product_unit_id: mapped?.internal_product_unit_id || null,
            match_method: mapped?.match_method || "Not Found",
            product_units: mapped?.internal_product_id ? (unitsMap[mapped.internal_product_id] || []) : []
          };
        });

        message.success({ content: "Đã phân tích xong!", key: "ai_mapping", duration: 2 });
        setImportedItems(mergedItems);
        setImportReviewMode(true);
      } catch (err: any) {
        message.error({ content: "Lỗi xử lý file Excel: " + err.message, key: "ai_mapping" });
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Chặn upload mặc định của Ant Design
  };

  const handleImportItemChange = (index: number, field: string, value: any) => {
    const newItems = [...importedItems];
    newItems[index][field] = value;
    setImportedItems(newItems);
  };

  const handleSaveImportedItems = async () => {
    // Validate
    const invalidItems = importedItems.filter(i => !i.internal_product_id || !i.internal_product_unit_id);
    if (invalidItems.length > 0) {
      message.error(`Còn ${invalidItems.length} sản phẩm chưa được chọn đúng Ánh xạ Nội bộ hoặc ĐVT!`);
      return;
    }

    setSavingImport(true);
    try {
      // Upsert: Dựa trên vendor_tax_code và (vendor_product_name hoặc supplier_sku)
      // Nhưng an toàn nhất là xóa mapping cũ và insert lại, HOẶC chỉ insert thông thường.
      // Vì hệ thống hiện tại vendor_product_mappings không có Unique constraint đặc thù, 
      // dùng insert thẳng sẽ tạo bản ghi. Để tránh trùng lặp, ta có thể dùng bulk insert.
      
      const payload = importedItems.map(item => ({
        vendor_tax_code: vendorTaxCode,
        vendor_product_name: item.vendor_product_name,
        supplier_sku: item.supplier_sku,
        vendor_unit: item.vendor_unit,
        internal_product_id: item.internal_product_id,
        internal_product_unit_id: item.internal_product_unit_id,
        pre_vat_price: item.pre_vat_price,
        vat_of_supplier: item.vat_of_supplier,
      }));

      const { error } = await supabase.from("vendor_product_mappings").insert(payload);
      if (error) throw error;

      message.success(`Đã lưu ${payload.length} ánh xạ thành công!`);
      setImportReviewMode(false);
      fetchMappings();
    } catch (err: any) {
      message.error("Lỗi khi lưu ánh xạ: " + err.message);
    } finally {
      setSavingImport(false);
    }
  };

  // ----- MODAL NORMAL MODE -----
  const handleOpenModal = (record?: any) => {
    setIsModalVisible(true);
    if (record) {
      setEditingId(record.id);
      setSelectedProductId(record.internal_product_id);
      form.setFieldsValue({
        vendor_product_name: record.vendor_product_name,
        supplier_sku: record.supplier_sku,
        vendor_unit: record.vendor_unit,
        internal_product_id: record.internal_product_id,
        internal_product_unit_id: record.internal_product_unit_id,
        pre_vat_price: record.pre_vat_price,
        vat_of_supplier: record.vat_of_supplier,
      });
    } else {
      setEditingId(null);
      setSelectedProductId(null);
      form.resetFields();
    }
  };

  const handleCancelModal = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const payload = {
        vendor_tax_code: vendorTaxCode,
        vendor_product_name: values.vendor_product_name,
        supplier_sku: values.supplier_sku,
        vendor_unit: values.vendor_unit,
        internal_product_id: values.internal_product_id,
        internal_product_unit_id: values.internal_product_unit_id,
        pre_vat_price: values.pre_vat_price,
        vat_of_supplier: values.vat_of_supplier,
      };

      if (editingId) {
        const { error } = await supabase.from("vendor_product_mappings").update(payload).eq("id", editingId);
        if (error) throw error;
        message.success("Cập nhật ánh xạ thành công!");
      } else {
        const { error } = await supabase.from("vendor_product_mappings").insert([payload]);
        if (error) throw error;
        message.success("Thêm mới ánh xạ thành công!");
      }

      setIsModalVisible(false);
      fetchMappings();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error("Lỗi khi lưu ánh xạ: " + error.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase.from("vendor_product_mappings").delete().eq("id", id);
      if (error) throw error;
      message.success("Xóa ánh xạ thành công!");
      fetchMappings();
    } catch (error: any) {
      message.error("Lỗi khi xóa: " + error.message);
    }
  };

  // ----- COLUMNS -----
  const columns = [
    {
      title: "Mã SP (NCC)",
      dataIndex: "supplier_sku",
      key: "supplier_sku",
    },
    {
      title: "Tên Sản phẩm (NCC)",
      dataIndex: "vendor_product_name",
      key: "vendor_product_name",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Giá chưa thuế",
      dataIndex: "pre_vat_price",
      key: "pre_vat_price",
      render: (val: number) => val ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val) : "-",
    },
    {
      title: "% Thuế",
      dataIndex: "vat_of_supplier",
      key: "vat_of_supplier",
      render: (val: number) => val ? `${val}%` : "-",
    },
    {
      title: "Ánh xạ hệ thống",
      key: "internal_mapping",
      render: (_: any, record: any) => (
        <div>
          <div><Text type="secondary">SP:</Text> {record.products?.name} <Text type="secondary" style={{fontSize: 12}}>({record.products?.sku})</Text></div>
          <div><Text type="secondary">ĐVT:</Text> {record.product_units?.unit_name || record.internal_unit || "-"}</div>
        </div>
      )
    },
    {
      title: "Thao tác",
      key: "action",
      width: 120,
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleOpenModal(record)} />
          <Popconfirm title="Bạn có chắc muốn xóa ánh xạ này?" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const importReviewColumns = [
    {
      title: "SP Nhà cung cấp",
      width: 250,
      render: (_: any, record: any, index: number) => (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input 
            placeholder="Mã SKU (tùy chọn)" 
            value={record.supplier_sku} 
            onChange={(e) => handleImportItemChange(index, "supplier_sku", e.target.value)} 
            style={{ width: "100%", fontSize: 12 }} 
          />
          <Input 
            placeholder="Tên Sản phẩm" 
            value={record.vendor_product_name} 
            onChange={(e) => handleImportItemChange(index, "vendor_product_name", e.target.value)} 
            style={{ width: "100%", fontWeight: "bold" }} 
          />
        </Space>
      )
    },
    {
      title: "ĐVT (NCC)",
      dataIndex: "vendor_unit",
      width: 100,
      render: (text: string, _record: any, index: number) => (
        <Input value={text} onChange={(e) => handleImportItemChange(index, "vendor_unit", e.target.value)} />
      )
    },
    {
      title: "Giá / VAT (NCC)",
      width: 150,
      render: (_: any, record: any, index: number) => (
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <InputNumber 
            placeholder="Giá gốc" 
            value={record.pre_vat_price} 
            onChange={(v) => handleImportItemChange(index, "pre_vat_price", v)} 
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            style={{ width: "100%" }}
          />
          <InputNumber 
            placeholder="% VAT" 
            value={record.vat_of_supplier} 
            onChange={(v) => handleImportItemChange(index, "vat_of_supplier", v)} 
            style={{ width: "100%" }}
          />
        </Space>
      )
    },
    {
      title: "Chọn SP Nội bộ Nam Việt",
      dataIndex: "internal_product_id",
      width: 300,
      render: (productId: number | null, record: any, index: number) => (
        <DebounceProductSelect
          searchTypes={["product"]}
          value={productId}
          initialOptions={record.internal_product_id ? [{ value: record.internal_product_id, label: record.internal_product_name }] : []}
          placeholder="Tìm theo tên/SKU..."
          style={{ width: "100%" }}
          onChange={async (val, opt: any) => {
            handleImportItemChange(index, "internal_product_id", val);
            handleImportItemChange(index, "internal_product_name", opt?.product?.name || "");
            handleImportItemChange(index, "internal_product_unit_id", null);
            if (val) {
              const { data: units } = await supabase.from("product_units").select("id, product_id, unit_name").eq("product_id", val);
              const newItems = [...importedItems];
              newItems[index].product_units = units || [];
              setImportedItems(newItems);
            }
          }}
        />
      )
    },
    {
      title: "ĐVT Nội bộ",
      dataIndex: "internal_product_unit_id",
      width: 180,
      render: (unitId: number | null, record: any, index: number) => (
        <Select
          value={unitId}
          style={{ width: "100%" }}
          placeholder="Chọn ĐVT"
          disabled={!record.internal_product_id}
          onChange={(val) => handleImportItemChange(index, "internal_product_unit_id", val)}
        >
          {record.product_units?.map((u: any) => (
            <Select.Option key={u.id} value={u.id}>{u.unit_name}</Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 100,
      render: (_: any, record: any) => {
        if (record.internal_product_id && record.internal_product_unit_id) {
          return <Tag color="success" icon={<CheckCircleOutlined />}>Đã khớp</Tag>;
        }
        if (record.internal_product_id && !record.internal_product_unit_id) {
          return <Tag color="warning">Thiếu ĐVT</Tag>;
        }
        return <Tag color="error">Chưa khớp</Tag>;
      }
    },
    {
      title: "",
      key: "action",
      width: 50,
      render: (_: any, _record: any, index: number) => (
        <Button 
          type="text" 
          danger 
          icon={<CloseCircleOutlined />} 
          onClick={() => {
            const newItems = [...importedItems];
            newItems.splice(index, 1);
            setImportedItems(newItems);
          }} 
        />
      )
    }
  ];

  if (!vendorTaxCode) {
    return <Text type="secondary">Vui lòng nhập Mã số thuế cho Nhà cung cấp này để có thể sử dụng tính năng Ánh xạ.</Text>;
  }

  return (
    <div>
      {!importReviewMode ? (
        // ----- CHẾ ĐỘ VIEW BÌNH THƯỜNG -----
        <>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <Text type="secondary">
              Quản lý danh mục ánh xạ giúp hệ thống tự động điền Giá, Thuế và Đơn vị tính khi quét hóa đơn.
            </Text>
            <Space>
              <Upload 
                accept=".xlsx, .xls" 
                showUploadList={false} 
                beforeUpload={handleImportExcel}
                disabled={isImporting}
              >
                <Button icon={<UploadOutlined />} loading={isImporting}>Nhập Excel</Button>
              </Upload>
              <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>Xuất Excel</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                Thêm Ánh xạ
              </Button>
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </>
      ) : (
        // ----- CHẾ ĐỘ REVIEW IMPORT EXCEL -----
        <div style={{ background: "#fafafa", padding: 16, borderRadius: 8, border: "1px dashed #d9d9d9" }}>
          <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
            <Col>
              <Title level={5} style={{ margin: 0, color: "#1890ff" }}>Đối chiếu Dữ liệu Import Excel</Title>
              <Text type="secondary">Vui lòng kiểm tra và đảm bảo tất cả sản phẩm đều đã được khớp nội bộ.</Text>
            </Col>
            <Col>
              <Space>
                <Button onClick={() => setImportReviewMode(false)}>Hủy bỏ</Button>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveImportedItems} loading={savingImport}>
                  Lưu tất cả Ánh xạ ({importedItems.filter(i => i.internal_product_id && i.internal_product_unit_id).length}/{importedItems.length})
                </Button>
              </Space>
            </Col>
          </Row>

          <Table
            columns={importReviewColumns}
            dataSource={importedItems}
            rowKey="key"
            pagination={false}
            size="small"
            scroll={{ x: 1100, y: 500 }}
          />
        </div>
      )}

      {/* ----- MODAL NẾU BẤM THÊM / SỬA LẺ ----- */}
      <Modal
        title={editingId ? "Cập nhật Ánh xạ" : "Thêm mới Ánh xạ"}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={handleCancelModal}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Typography.Title level={5}>1. Thông tin từ Nhà cung cấp</Typography.Title>
          <Space align="start" style={{ width: "100%" }}>
            <Form.Item name="supplier_sku" label="Mã SP (Supplier SKU)">
              <Input placeholder="Nhập mã SP..." />
            </Form.Item>
            <Form.Item
              name="vendor_product_name"
              label="Tên SP trên Hóa đơn"
              rules={[{ required: true, message: "Vui lòng nhập tên SP" }]}
              style={{ width: 300 }}
            >
              <Input placeholder="Tên SP in trên hóa đơn của NCC..." />
            </Form.Item>
            <Form.Item name="vendor_unit" label="ĐVT (NCC)">
              <Input placeholder="VD: Tube, Viên..." />
            </Form.Item>
          </Space>

          <Space align="start" style={{ width: "100%" }}>
            <Form.Item name="pre_vat_price" label="Giá chưa Thuế (Giá gốc)">
              <InputNumber
                style={{ width: 200 }}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                addonAfter="₫"
              />
            </Form.Item>
            <Form.Item name="vat_of_supplier" label="% Thuế VAT">
              <InputNumber style={{ width: 150 }} addonAfter="%" />
            </Form.Item>
          </Space>

          <Typography.Title level={5} style={{ marginTop: 16 }}>2. Ánh xạ vào Hệ thống nội bộ</Typography.Title>
          <Form.Item
            name="internal_product_id"
            label="Sản phẩm Nam Việt"
            rules={[{ required: true, message: "Vui lòng chọn sản phẩm nội bộ" }]}
          >
            <DebounceProductSelect
              placeholder="Tìm theo tên hoặc SKU..."
              searchTypes={["product"]}
              onChange={(val) => {
                setSelectedProductId(val);
                form.setFieldsValue({ internal_product_unit_id: null });
              }}
            />
          </Form.Item>
          
          <Form.Item
            name="internal_product_unit_id"
            label="Đơn vị tính quy đổi"
            rules={[{ required: true, message: "Vui lòng chọn ĐVT" }]}
          >
            <Select 
              placeholder="Chọn đơn vị tính tương ứng" 
              loading={unitsLoading}
              disabled={!selectedProductId}
            >
              {productUnits.map(u => (
                <Select.Option key={u.id} value={u.id}>
                  {u.unit_name} (Quy đổi: {u.conversion_rate})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SupplierProductMappingTab;
