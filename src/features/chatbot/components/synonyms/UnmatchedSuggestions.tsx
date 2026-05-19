// List 20 câu "bot không hiểu" gần nhất (Gap 1 P2.5).
// - Dùng RPC chat_unmatched_questions(from, to, 20) — đã có trong Plan 2.
// - Khoảng thời gian default: 7 ngày gần nhất.
// - Click 1 row → mở Drawer ProductPicker → chọn SP → callback prefill synonym.

import { useQuery } from "@tanstack/react-query";
import { Button, Card, Drawer, Empty, List, Spin, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { useMemo, useState } from "react";

import { fetchUnmatched, type UnmatchedQuestion } from "../../api/analyticsApi";

import { ProductPicker } from "./ProductPicker";

import type { ProductSearchResult } from "../../api/synonymApi";

const { Text } = Typography;

export interface UnmatchedSuggestionsProps {
  onPickProduct: (
    product: ProductSearchResult,
    suggestedSynonym: string
  ) => void;
}

export function UnmatchedSuggestions({
  onPickProduct,
}: UnmatchedSuggestionsProps) {
  const filters = useMemo(() => {
    const to = dayjs().format("YYYY-MM-DD");
    const from = dayjs().subtract(7, "day").format("YYYY-MM-DD");
    return { from, to };
  }, []);

  const { data, isLoading } = useQuery<UnmatchedQuestion[]>({
    queryKey: ["chatbot", "unmatched-for-synonyms", filters],
    queryFn: () => fetchUnmatched(filters, 20),
  });

  const [picking, setPicking] = useState<UnmatchedQuestion | null>(null);

  const handlePicked = (product: ProductSearchResult | null) => {
    if (!product || !picking) return;
    onPickProduct(product, picking.question);
    setPicking(null);
  };

  return (
    <Card title="Câu bot không hiểu (7 ngày)" size="small">
      {isLoading ? <Spin /> : null}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <Empty description="Không có câu unmatched" />
      )}
      <List
        size="small"
        dataSource={data ?? []}
        renderItem={(q) => (
          <List.Item
            actions={[
              <Button
                key="pick"
                size="small"
                type="link"
                onClick={() => setPicking(q)}
              >
                Gán SP
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={<Text>{q.question}</Text>}
              description={
                <Tag color="default">
                  {dayjs(q.occurred_at).format("HH:mm DD/MM")}
                </Tag>
              }
            />
          </List.Item>
        )}
      />

      <Drawer
        title="Chọn SP để gán synonym"
        open={!!picking}
        onClose={() => setPicking(null)}
        width={420}
      >
        {picking ? (
          <>
            <Text type="secondary">Câu khách hỏi:</Text>
            <div style={{ marginBottom: 16 }}>
              <Text strong>{picking.question}</Text>
            </div>
            <ProductPicker value={null} onChange={handlePicked} />
          </>
        ) : null}
      </Drawer>
    </Card>
  );
}
