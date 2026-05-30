import React from "react";
import { Card, Table, Typography, Alert, Tag, Spin } from "antd";
import dayjs from "dayjs";

const { Text } = Typography;

interface PromotionsCardProps {
  programs: any[];
  loading: boolean;
  error?: string;
}

export const PromotionsCard: React.FC<PromotionsCardProps> = ({ programs, loading, error }) => {
  if (error) {
    return <Alert type="error" message="Lỗi tải Khuyến mại" description={error} showIcon />;
  }

  const columns = [
    {
      title: "Chương trình",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Loại KM",
      dataIndex: "type",
      key: "type",
      render: (type: string) => <Tag color="blue">{type}</Tag>,
    },
    {
      title: "Chiết khấu",
      dataIndex: "rebate_percentage",
      key: "rebate_percentage",
      render: (val: number) => (val ? <Text type="success">{val}%</Text> : "-"),
    },
    {
      title: "Hạn mức",
      dataIndex: "valid_to",
      key: "valid_to",
      render: (val: string) => <Text type="secondary">{dayjs(val).format("DD/MM/YYYY")}</Text>,
    },
  ];

  return (
    <Card 
      title="Chương trình Khuyến Mại" 
      size="small" 
      style={{ height: '100%', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
      extra={loading && <Spin size="small" />}
    >
      <Table 
        size="small"
        dataSource={programs}
        columns={columns}
        rowKey="id"
        pagination={false}
        scroll={{ y: 200 }}
        locale={{ emptyText: loading ? "Đang tải..." : "Không có chương trình khuyến mại nào" }}
      />
    </Card>
  );
};
