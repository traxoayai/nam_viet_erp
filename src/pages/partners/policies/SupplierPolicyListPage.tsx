// src/pages/partners/policies/SupplierPolicyListPage.tsx
import {
  PlusOutlined,
  EditOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import {
  Table,
  Card,
  Button,
  Space,
  Tag,
  Typography,
  Select,
  Row,
  Col,
} from "antd";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useProductStore } from "@/features/product/stores/productStore";
import { supplierPolicyService } from "@/features/purchasing/api/supplierPolicyService";

const { Title, Text } = Typography;

const SupplierPolicyListPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const { suppliers, fetchCommonData } = useProductStore();

  // Filters
  const [filters, setFilters] = useState({
    supplier_id: null,
    type: null,
  });

  useEffect(() => {
    fetchCommonData();
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await supplierPolicyService.getPolicies(filters);
      setData(res || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Mã CT",
      dataIndex: "code",
      key: "code",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Tên Chương Trình / Hợp Đồng",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: any) => (
        <div>
          <div style={{ fontWeight: 600 }}>{text}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.supplier?.name}
          </Text>
        </div>
      ),
    },
    {
      title: "Loại",
      dataIndex: "type",
      key: "type",
      render: (type: string) => {
        return type === "contract" ? (
          <Tag color="geekblue">Hợp đồng</Tag>
        ) : (
          <Tag color="magenta">Khuyến mãi</Tag>
        );
      },
    },
    {
      title: "Thời gian áp dụng",
      key: "duration",
      render: (_: any, record: any) => (
        <Space direction="vertical" size={0}>
          <Text>Từ: {dayjs(record.valid_from).format("DD/MM/YYYY")}</Text>
          <Text>Đến: {dayjs(record.valid_to).format("DD/MM/YYYY")}</Text>
        </Space>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      render: (_: any, record: any) => {
        const now = dayjs();
        const start = dayjs(record.valid_from);
        const end = dayjs(record.valid_to);

        if (now.isBefore(start)) return <Tag>Chưa bắt đầu</Tag>;
        if (now.isAfter(end)) return <Tag color="red">Hết hạn</Tag>;
        return <Tag color="green">Đang hiệu lực</Tag>;
      },
    },
    {
      title: "Hành động",
      key: "action",
      render: (_: any, record: any) => (
        <Button
          icon={<EditOutlined />}
          size="small"
          onClick={() => navigate(`/partners/policies/${record.id}`)}
        >
          Sửa
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Card>
        <Row
          justify="space-between"
          align="middle"
          style={{ marginBottom: 16 }}
        >
          <Col>
            <Title level={4}>
              <FileTextOutlined /> Quản lý Chính Sách & Hợp Đồng
            </Title>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate("/partners/policies/new")}
            >
              Thêm mới
            </Button>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Select
              placeholder="Lọc theo Nhà cung cấp"
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: "100%" }}
              onChange={(val) =>
                setFilters((prev) => ({ ...prev, supplier_id: val }))
              }
              options={suppliers.map((s) => ({
                label: s.name,
                value: s.id,
              }))}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="Loại"
              allowClear
              style={{ width: "100%" }}
              onChange={(val) => setFilters((prev) => ({ ...prev, type: val }))}
            >
              <Select.Option value="contract">Hợp đồng</Select.Option>
              <Select.Option value="promotion">Khuyến mãi</Select.Option>
            </Select>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default SupplierPolicyListPage;
