// src/pages/partners/policies/components/PolicyGroupCard.tsx
import {
  DeleteOutlined,
  PlusOutlined,
  GiftOutlined,
  PercentageOutlined,
  ShoppingCartOutlined,
  DownloadOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import {
  Card,
  Form,
  Row,
  Col,
  Input,
  Select,
  Radio,
  Button,
  Tag,
  Space,
  InputNumber,
  App,
  Tooltip,
} from "antd";
import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";

import { ExcelPreviewModal } from "./ExcelPreviewModal";

import { supabase } from "@/shared/lib/supabaseClient";

interface Props {
  field: any; // Form List Field
  remove: (index: number) => void;
  openProductModal: (fieldKey: number) => void;
  form: any;
}

export const PolicyGroupCard: React.FC<Props> = ({
  field,
  remove,
  openProductModal,
  form,
}) => {
  const { message } = App.useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Fix: Extract key to avoid spreading it into Form.Item
  const { key, ...restField } = field;

  // --- HANDLER: DOWNLOAD TEMPLATE ---
  const handleDownloadTemplate = () => {
    const header = [["Product Name", "SKU", "Note (Optional)"]];
    const ws = XLSX.utils.aoa_to_sheet(header);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Import_Product_Template.xlsx");
  };

  // --- HANDLER: IMPORT EXCEL ---
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await readExcel(file);
      if (!data || data.length === 0) {
        message.warning("File không có dữ liệu!");
        return;
      }

      // Map keys (Header mapping)
      const formattedData = data
        .map((row: any) => ({
          name: row["Product Name"] || row["Tên sản phẩm"] || row["name"] || "",
          sku: row["SKU"] || row["Mã SKU"] || row["sku"] || "",
        }))
        .filter((i: any) => i.name || i.sku);

      if (formattedData.length === 0) {
        message.error("Không tìm thấy cột 'Product Name' hoặc 'SKU' hợp lệ.");
        return;
      }

      message.loading({ content: "Đang xử lý match...", key: "import_excel" });

      // Call RPC
      const { data: matchedResults, error } = await supabase.rpc(
        "match_products_from_excel",
        {
          p_data: formattedData,
        }
      );

      if (error) throw error;

      message.success({
        content: "Đã đọc xong file! Vui lòng kiểm tra lại.",
        key: "import_excel",
      });

      // Store data and OPEN MODAL
      setPreviewData(matchedResults || []);
      setPreviewOpen(true);
    } catch (error: any) {
      console.error(error);
      message.error({
        content: "Lỗi import: " + error.message,
        key: "import_excel",
      });
    } finally {
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmImport = (items: any[]) => {
    // Merge into Form
    const groups = form.getFieldValue("groups");
    const currentGroup = groups[field.name];

    const existingIds = new Set(currentGroup.product_ids || []);
    const newItems = items.filter((p: any) => !existingIds.has(p.id));

    if (newItems.length > 0) {
      groups[field.name].product_ids = [
        ...(currentGroup.product_ids || []),
        ...newItems.map((p: any) => p.id),
      ];
      groups[field.name]._product_display = [
        ...(currentGroup._product_display || []),
        ...newItems,
      ];
      form.setFieldsValue({ groups });
      message.success(`Đã thêm ${newItems.length} sản phẩm vào nhóm.`);
    } else {
      message.info("Các sản phẩm này đã có trong nhóm.");
    }
  };

  const readExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const bstr = e.target?.result;
          const wb = XLSX.read(bstr, { type: "binary" });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  return (
    <Card
      size="small"
      style={{ marginBottom: 16, background: "#fafafa" }}
      title={
        <Space>
          <span>Nhóm chính sách #{field.name + 1}</span>
        </Space>
      }
      extra={
        <Button
          danger
          type="text"
          icon={<DeleteOutlined />}
          onClick={() => remove(field.name)}
        />
      }
    >
      {/* 1. CONFIG ROW */}
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            {...restField}
            name={[field.name, "name"]}
            label="Tên nhóm"
            rules={[{ required: true, message: "Nhập tên nhóm" }]}
          >
            <Input placeholder="VD: Nhóm thuốc A" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            {...restField}
            name={[field.name, "rule_type"]}
            label="Loại quy tắc"
            initialValue="rebate_revenue"
          >
            <Select>
              <Select.Option value="rebate_revenue">
                <PercentageOutlined /> Đạt chỉ tiêu thưởng %
              </Select.Option>
              <Select.Option value="buy_x_get_y">
                <ShoppingCartOutlined /> Mua X Tặng Y
              </Select.Option>
              <Select.Option value="buy_amt_get_gift">
                <GiftOutlined /> Mua tiền Tặng Quà
              </Select.Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            {...restField}
            name={[field.name, "price_basis"]}
            label="Giá tính toán"
            initialValue="pre_vat"
          >
            <Radio.Group>
              <Radio value="pre_vat">Trước VAT</Radio>
              <Radio value="post_vat">Sau VAT</Radio>
            </Radio.Group>
          </Form.Item>
        </Col>
      </Row>

      {/* 2. DYNAMIC INPUTS */}
      <Form.Item
        noStyle
        shouldUpdate={(prev, curr) =>
          prev.groups?.[field.name]?.rule_type !==
          curr.groups?.[field.name]?.rule_type
        }
      >
        {({ getFieldValue }) => {
          const type = getFieldValue(["groups", field.name, "rule_type"]);

          if (type === "rebate_revenue") {
            return (
              <Row
                gutter={16}
                style={{
                  background: "#fff",
                  padding: 10,
                  borderRadius: 6,
                  marginBottom: 12,
                  border: "1px dashed #d9d9d9",
                }}
              >
                <Col span={12}>
                  <Form.Item
                    {...restField}
                    name={[field.name, "rules", "min_turnover"]}
                    label="Doanh số đạt mức (VNĐ)"
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      style={{ width: "100%" }}
                      formatter={(v) =>
                        `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      addonAfter="đ"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    {...restField}
                    name={[field.name, "rules", "rate"]}
                    label="% Chiết khấu thưởng"
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      style={{ width: "100%" }}
                      min={0}
                      max={100}
                      addonAfter="%"
                    />
                  </Form.Item>
                </Col>
              </Row>
            );
          }

          if (type === "buy_x_get_y") {
            return (
              <Row
                gutter={16}
                style={{
                  background: "#fff",
                  padding: 10,
                  borderRadius: 6,
                  marginBottom: 12,
                  border: "1px dashed #d9d9d9",
                }}
              >
                <Col span={12}>
                  <Form.Item
                    {...restField}
                    name={[field.name, "rules", "buy_qty"]}
                    label="Mua số lượng (X)"
                    rules={[{ required: true }]}
                  >
                    <InputNumber style={{ width: "100%" }} min={1} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    {...restField}
                    name={[field.name, "rules", "get_qty"]}
                    label="Tặng số lượng (Y)"
                    rules={[{ required: true }]}
                  >
                    <InputNumber style={{ width: "100%" }} min={1} />
                  </Form.Item>
                </Col>
              </Row>
            );
          }

          if (type === "buy_amt_get_gift") {
            return (
              <Row
                gutter={16}
                style={{
                  background: "#fff",
                  padding: 10,
                  borderRadius: 6,
                  marginBottom: 12,
                  border: "1px dashed #d9d9d9",
                }}
              >
                <Col span={12}>
                  <Form.Item
                    {...restField}
                    name={[field.name, "rules", "min_order_value"]}
                    label="Giá trị đơn hàng tối thiểu"
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      style={{ width: "100%" }}
                      formatter={(v) =>
                        `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                      }
                      addonAfter="đ"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    {...restField}
                    name={[field.name, "rules", "gift_name"]}
                    label="Quà tặng kèm"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Nhập tên quà..." />
                  </Form.Item>
                </Col>
              </Row>
            );
          }

          return null;
        }}
      </Form.Item>

      {/* 3. PRODUCT SCOPE */}
      <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>
          Sản phẩm áp dụng:
        </div>

        {/* Hidden Field for ID Array */}
        <Form.Item
          {...restField}
          name={[field.name, "product_ids"]}
          hidden
          initialValue={[]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          shouldUpdate={(prev, curr) =>
            prev.groups?.[field.name]?.product_ids !==
            curr.groups?.[field.name]?.product_ids
          }
          noStyle
        >
          {() => {
            const displayItems =
              form.getFieldValue(["groups", field.name, "_product_display"]) ||
              [];
            return (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                {displayItems.map((p: any) => (
                  <Tag
                    key={p.id}
                    closable
                    onClose={() => {
                      // Remove logic
                      const currentIds = form.getFieldValue([
                        "groups",
                        field.name,
                        "product_ids",
                      ]);
                      const currentDisplay = form.getFieldValue([
                        "groups",
                        field.name,
                        "_product_display",
                      ]);

                      const newIds = currentIds.filter(
                        (id: number) => id !== p.id
                      );
                      const newDisplay = currentDisplay.filter(
                        (item: any) => item.id !== p.id
                      );

                      const groups = form.getFieldValue("groups");
                      groups[field.name].product_ids = newIds;
                      groups[field.name]._product_display = newDisplay;
                      form.setFieldsValue({ groups });
                    }}
                  >
                    {p.name}
                  </Tag>
                ))}

                <Space>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => openProductModal(field.name)}
                  >
                    Chọn sản phẩm
                  </Button>

                  {/* EXCEL IMPORT */}
                  <Tooltip title="Tải file mẫu để nhập liệu">
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={handleDownloadTemplate}
                    >
                      Mẫu
                    </Button>
                  </Tooltip>

                  <Button
                    size="small"
                    icon={<FileExcelOutlined />}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      backgroundColor: "#52c41a",
                      color: "#fff",
                      borderColor: "#52c41a",
                    }}
                  >
                    Nhập Excel
                  </Button>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={handleExcelUpload}
                  />
                </Space>
              </div>
            );
          }}
        </Form.Item>
      </div>

      <ExcelPreviewModal
        open={previewOpen}
        data={previewData}
        onCancel={() => setPreviewOpen(false)}
        onConfirm={handleConfirmImport}
      />
    </Card>
  );
};
