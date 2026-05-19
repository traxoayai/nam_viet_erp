// Dialog import CSV synonyms (Gap 1 P2.5).
// - Parse CSV inline (split \n và \,). Header: sku, synonym, weight (weight optional).
// - Bỏ trống cell rỗng; trim mỗi field.
// - Preview tối đa 10 dòng đầu trước khi gửi RPC.
// - Sau bulkImportSynonyms → hiện tóm tắt inserted/skipped/errors.

import { InboxOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  List,
  Modal,
  Space,
  Statistic,
  Table,
  Typography,
  Upload,
  message,
} from "antd";
import { useState } from "react";

import { useBulkImportSynonyms } from "../../hooks/useSynonyms";

import type { BulkImportResult, BulkImportRow } from "../../api/synonymApi";

const { Text, Paragraph } = Typography;

export interface ImportCSVDialogProps {
  open: boolean;
  onClose: () => void;
}

// Pure helper exported cho unit test.
export function parseSynonymCsv(raw: string): BulkImportRow[] {
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const iSku = header.indexOf("sku");
  const iSyn = header.indexOf("synonym");
  const iWeight = header.indexOf("weight");
  if (iSku < 0 || iSyn < 0) return [];
  const out: BulkImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const sku = cols[iSku] ?? "";
    const syn = cols[iSyn] ?? "";
    if (!sku || !syn) continue;
    const row: BulkImportRow = { sku, synonym: syn };
    if (iWeight >= 0 && cols[iWeight]) {
      const w = Number(cols[iWeight]);
      if (Number.isFinite(w)) row.weight = w;
    }
    out.push(row);
  }
  return out;
}

export function ImportCSVDialog({ open, onClose }: ImportCSVDialogProps) {
  const [rows, setRows] = useState<BulkImportRow[]>([]);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const importMut = useBulkImportSynonyms();

  const reset = () => {
    setRows([]);
    setResult(null);
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      const parsed = parseSynonymCsv(text);
      if (parsed.length === 0) {
        message.error(
          "CSV trống hoặc thiếu cột bắt buộc (cần header: sku, synonym)"
        );
        return;
      }
      setRows(parsed);
      setResult(null);
    };
    reader.readAsText(file);
    return false;
  };

  const onSubmit = async () => {
    try {
      const res = await importMut.mutateAsync(rows);
      setResult(res);
      message.success(`Đã thêm ${res.inserted} synonym, bỏ qua ${res.skipped}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import thất bại";
      message.error(msg);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      title="Import synonyms từ CSV"
      open={open}
      onCancel={handleClose}
      width={700}
      footer={
        <Space>
          <Button onClick={handleClose}>Đóng</Button>
          <Button
            type="primary"
            disabled={rows.length === 0 || importMut.isPending}
            loading={importMut.isPending}
            onClick={() => void onSubmit()}
          >
            Import {rows.length} dòng
          </Button>
        </Space>
      }
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Định dạng CSV"
        description="Cột bắt buộc: sku, synonym. Cột optional: weight (mặc định 1.0). Dòng đầu là header."
      />
      <Upload.Dragger
        accept=".csv,text/csv"
        beforeUpload={onFile}
        showUploadList={false}
        multiple={false}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Kéo thả file CSV hoặc click để chọn</p>
      </Upload.Dragger>

      {rows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Paragraph>
            <Text strong>Xem trước ({rows.length} dòng, 10 đầu):</Text>
          </Paragraph>
          <Table
            size="small"
            rowKey={(_, idx) => String(idx)}
            pagination={false}
            dataSource={rows.slice(0, 10)}
            columns={[
              { title: "SKU", dataIndex: "sku" },
              { title: "Synonym", dataIndex: "synonym" },
              { title: "Weight", dataIndex: "weight" },
            ]}
          />
        </div>
      )}

      {result ? (
        <div style={{ marginTop: 12 }}>
          <Space size="large">
            <Statistic title="Đã thêm" value={result.inserted} />
            <Statistic title="Bỏ qua" value={result.skipped} />
          </Space>
          {result.errors.length > 0 && (
            <List
              size="small"
              style={{ marginTop: 12 }}
              header={<Text strong>Lỗi:</Text>}
              bordered
              dataSource={result.errors.slice(0, 50)}
              renderItem={(e) => (
                <List.Item>
                  <Text type="danger">
                    [{e.sku ?? "?"}] {e.synonym ?? ""} — {e.reason}
                  </Text>
                </List.Item>
              )}
            />
          )}
        </div>
      ) : null}
    </Modal>
  );
}
