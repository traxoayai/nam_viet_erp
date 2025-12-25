// src/features/crm/components/segmentation/CriteriaBuilder.tsx
import React from "react";
import { Form, Select, InputNumber, Card, Row, Col, Space } from "antd";
import { SegmentCriteria } from "../../types/segments"; // <-- Import từ segments.ts

const { Option } = Select;

interface CriteriaBuilderProps {
  value?: SegmentCriteria;
  onChange?: (val: SegmentCriteria) => void;
}

export const CriteriaBuilder: React.FC<CriteriaBuilderProps> = ({ value = {}, onChange }) => {
  const updateCriteria = (key: keyof SegmentCriteria, val: any) => {
    // Clone object để tránh mutate state trực tiếp
    const newValue = { ...value };

    if (val === undefined || val === null || val === "") {
      // [FIX] Ép kiểu any để delete không bị báo lỗi
      delete (newValue as any)[key];
    } else {
      // [FIX] Ép kiểu any để gán dynamic value (vì val có thể là string hoặc number)
      (newValue as any)[key] = val;
    }
    
    onChange?.(newValue);
  };

  return (
    <Card size="small" title="Bộ Lọc Tự Động" style={{ background: "#f9f9f9", marginTop: 8 }}>
      <Row gutter={[12, 12]}>
        <Col span={12}>
          <Form.Item label="Giới tính" style={{marginBottom: 0}}>
            <Select allowClear placeholder="Tất cả" value={value.gender} onChange={(v) => updateCriteria("gender", v)}>
              <Option value="Nam">Nam</Option>
              <Option value="Nữ">Nữ</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Tháng Sinh Nhật" style={{marginBottom: 0}}>
            <Select allowClear placeholder="Chọn tháng" value={value.birthday_month} onChange={(v) => updateCriteria("birthday_month", v)}>
              <Option value="current">⭐️ Tháng này</Option>
              {[...Array(12)].map((_, i) => <Option key={i+1} value={i+1}>Tháng {i+1}</Option>)}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Độ tuổi" style={{marginBottom: 0}}>
            <Space.Compact>
              <InputNumber placeholder="Min" value={value.min_age} onChange={(v) => updateCriteria("min_age", v)} style={{width: '50%'}} />
              <InputNumber placeholder="Max" value={value.max_age} onChange={(v) => updateCriteria("max_age", v)} style={{width: '50%'}} />
            </Space.Compact>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Điểm Tích Lũy >=" style={{marginBottom: 0}}>
            <InputNumber 
                style={{ width: "100%" }} 
                value={value.min_loyalty} 
                onChange={(v) => updateCriteria("min_loyalty", v)}
                formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
};
