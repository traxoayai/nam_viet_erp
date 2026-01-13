// src/components/shared/listing/FilterAction.tsx
import { SearchOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Col, Input, Row, Select, Space } from "antd";
import React from "react";

export interface FilterConfig {
  key: string;
  placeholder: string;
  options?: { label: string; value: any }[];
  style?: React.CSSProperties;
}

export interface ActionConfig {
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  type?: "primary" | "default" | "dashed" | "link" | "text";
  danger?: boolean;
  loading?: boolean; // [NEW]
  render?: React.ReactNode; // [NEW] Support Custom Render (e.g Upload)
}

interface Props {
  searchPlaceholder?: string;
  initialSearch?: string;
  onSearch?: (val: string) => void;
  filters?: FilterConfig[];
  filterValues?: any;
  onFilterChange?: (key: string, val: any) => void;
  actions?: ActionConfig[];
  onRefresh?: () => void;
}

// 1. Khai báo Component gốc (Base)
const FilterActionBase = ({
  searchPlaceholder = "Tìm kiếm...",
  initialSearch = "",
  onSearch,
  filters = [],
  filterValues = {},
  onFilterChange,
  actions = [],
  onRefresh,
}: Props) => {
  return (
    <div
      style={{
        padding: "16px 24px",
        background: "#fff",
        borderRadius: "8px 8px 0 0",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <Row gutter={[16, 16]} justify="space-between" align="middle">
        <Col flex="auto">
          <Space wrap>
            {onSearch ? (
              <Input
                placeholder={searchPlaceholder}
                prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                style={{ width: 250 }}
                allowClear
                // Dùng defaultValue thay vì value để Input không bị re-render liên tục khi cha render
                defaultValue={initialSearch}
                onChange={(e) => onSearch(e.target.value)}
              />
            ) : null}

            {filters.map((f) => (
              <Select
                key={f.key}
                placeholder={f.placeholder}
                style={{ width: 160, ...f.style }}
                allowClear
                options={f.options}
                value={
                  filterValues[f.key] ? String(filterValues[f.key]) : undefined
                }
                onChange={(val) => onFilterChange && onFilterChange(f.key, val)}
              />
            ))}

            {onRefresh ? (
              <Button icon={<ReloadOutlined />} onClick={onRefresh} />
            ) : null}
          </Space>
        </Col>

        <Col>
          <Space>
            {actions.map((act, idx) => (
              act.render ? (
                <React.Fragment key={idx}>{act.render}</React.Fragment>
              ) : (
                <Button
                  key={idx}
                  type={act.type || "default"}
                  icon={act.icon}
                  onClick={act.onClick}
                  danger={act.danger}
                  loading={act.loading}
                >
                  {act.label}
                </Button>
              )
            ))}
          </Space>
        </Col>
      </Row>
    </div>
  );
};

// 2. Bọc Memo và Export
export const FilterAction = React.memo(FilterActionBase);
