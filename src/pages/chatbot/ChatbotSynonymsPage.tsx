// Trang quản lý từ đồng nghĩa SP cho Marketing (Gap 1 Chatbot P2.5).
// Layout 2 cột:
//  - Trái: ProductPicker + SynonymList + SynonymForm
//  - Phải: UnmatchedSuggestions + nút Import CSV
// Quyền truy cập gate ở router qua PermissionGuard(CHATBOT.ADMIN).

import { Button, Card, Col, Row, Typography } from "antd";
import { useState } from "react";

import type { ProductSearchResult } from "@/features/chatbot/api/synonymApi";

import { ImportCSVDialog } from "@/features/chatbot/components/synonyms/ImportCSVDialog";
import { ProductPicker } from "@/features/chatbot/components/synonyms/ProductPicker";
import { SynonymForm } from "@/features/chatbot/components/synonyms/SynonymForm";
import { SynonymList } from "@/features/chatbot/components/synonyms/SynonymList";
import { UnmatchedSuggestions } from "@/features/chatbot/components/synonyms/UnmatchedSuggestions";

const { Title } = Typography;

export default function ChatbotSynonymsPage() {
  const [selected, setSelected] = useState<ProductSearchResult | null>(null);
  const [prefillSynonym, setPrefillSynonym] = useState<string | undefined>(
    undefined
  );
  const [importOpen, setImportOpen] = useState(false);

  const onPickFromUnmatched = (
    product: ProductSearchResult,
    question: string
  ) => {
    setSelected(product);
    setPrefillSynonym(question);
  };

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Từ đồng nghĩa SP cho Chatbot
        </Title>
        <Button onClick={() => setImportOpen(true)}>Import CSV</Button>
      </div>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card title="Chọn sản phẩm" size="small" style={{ marginBottom: 16 }}>
            <ProductPicker
              value={selected}
              onChange={(p) => {
                setSelected(p);
                setPrefillSynonym(undefined);
              }}
            />
          </Card>

          {selected ? (
            <>
              <Card
                title={`Synonym của ${selected.name}`}
                size="small"
                style={{ marginBottom: 16 }}
              >
                <SynonymList productId={selected.id} />
              </Card>
              <Card title="Thêm synonym mới" size="small">
                <SynonymForm
                  productId={selected.id}
                  initialSynonym={prefillSynonym}
                  onCreated={() => setPrefillSynonym(undefined)}
                />
              </Card>
            </>
          ) : null}
        </Col>

        <Col xs={24} lg={10}>
          <UnmatchedSuggestions onPickProduct={onPickFromUnmatched} />
        </Col>
      </Row>

      <ImportCSVDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
