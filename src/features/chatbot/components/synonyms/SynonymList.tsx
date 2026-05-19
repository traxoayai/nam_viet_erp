// Table list synonym của 1 SP (Gap 1 P2.5).
// - Cột: synonym | weight | created_at | action delete (Popconfirm).
// - Loading state khi useProductSynonyms đang fetch.
// - Hook delete invalidate query → list auto refresh.

import { DeleteOutlined } from "@ant-design/icons";
import { Button, Empty, Popconfirm, Table, Tag, message } from "antd";
import dayjs from "dayjs";

import { useDeleteSynonym, useProductSynonyms } from "../../hooks/useSynonyms";

import type { ProductSynonym } from "../../api/synonymApi";

export interface SynonymListProps {
  productId: number;
}

export function SynonymList({ productId }: SynonymListProps) {
  const { data, isLoading } = useProductSynonyms(productId);
  const deleteMut = useDeleteSynonym(productId);

  const onDelete = async (id: number) => {
    try {
      await deleteMut.mutateAsync(id);
      message.success("Đã xóa synonym");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Xóa thất bại";
      message.error(msg);
    }
  };

  const columns = [
    {
      title: "Từ đồng nghĩa",
      dataIndex: "synonym",
      key: "synonym",
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: "Trọng số",
      dataIndex: "weight",
      key: "weight",
      width: 100,
      render: (v: number) => v.toFixed(2),
    },
    {
      title: "Tạo lúc",
      dataIndex: "created_at",
      key: "created_at",
      width: 160,
      render: (v: string) => dayjs(v).format("HH:mm DD/MM/YYYY"),
    },
    {
      title: "",
      key: "action",
      width: 60,
      render: (_: unknown, row: ProductSynonym) => (
        <Popconfirm
          title="Xóa synonym này?"
          okText="Xóa"
          okButtonProps={{ danger: true }}
          cancelText="Hủy"
          onConfirm={() => void onDelete(row.id)}
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            loading={deleteMut.isPending}
          />
        </Popconfirm>
      ),
    },
  ];

  if (!isLoading && (data?.length ?? 0) === 0) {
    return <Empty description="SP chưa có synonym nào" />;
  }

  return (
    <Table
      rowKey="id"
      size="small"
      loading={isLoading}
      dataSource={data ?? []}
      columns={columns}
      pagination={false}
    />
  );
}
