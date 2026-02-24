// src/pages/partners/policies/components/PolicyHeader.tsx
import { UploadOutlined } from "@ant-design/icons";
import { Card, Form, Row, Col, Input, Select, DatePicker } from "antd";
import React from "react";

import { useProductStore } from "@/features/product/stores/productStore";

const { RangePicker } = DatePicker;

export const PolicyHeader: React.FC = () => {
  const { suppliers } = useProductStore();

  return (
    <Card title="Thông tin chung" size="small" style={{ marginBottom: 16 }}>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="supplier_id"
            label="Nhà cung cấp"
            rules={[{ required: true }]}
          >
            <Select
              placeholder="Chọn nhà cung cấp"
              showSearch
              optionFilterProp="label"
              options={suppliers.map((s) => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="document_code"
            label="Số Hợp Đồng / Mã CT"
            rules={[{ required: true }]}
          >
            <Input placeholder="VD: HĐ-2024-001" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            name="name"
            label="Tên Chương trình"
            rules={[{ required: true }]}
          >
            <Input placeholder="VD: Chương trình khuyến mãi Quý 1" />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="type" label="Loại" initialValue="contract">
            <Select>
              <Select.Option value="contract">Hợp đồng</Select.Option>
              <Select.Option value="promotion">Khuyến mãi</Select.Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item
            name="range_picker"
            label="Thời gian hiệu lực"
            rules={[{ required: true }]}
          >
            <RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name="description" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Col>
        {/* Attachment URL (Simplified for now) */}
        <Col span={24}>
          <Form.Item name="attachment_url" label="Link tệp đính kèm">
            <Input
              prefix={<UploadOutlined />}
              placeholder="Dán link Google Drive hoặc URL tài liệu..."
            />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};
