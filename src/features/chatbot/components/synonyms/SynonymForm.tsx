// Form thêm synonym mới cho SP (Gap 1 P2.5).
// - Validation client: length >= 2 (đồng bộ với RPC add_product_synonym).
// - Weight clamp [0.1, 10.0]; default 1.0.
// - Optional prop `initialSynonym` để fill sẵn từ "Câu bot không hiểu".

import { Button, Form, Input, InputNumber, Space, message } from "antd";
import { useEffect } from "react";

import { useAddSynonym } from "../../hooks/useSynonyms";

export interface SynonymFormProps {
  productId: number;
  initialSynonym?: string;
  onCreated?: () => void;
}

interface FormValues {
  synonym: string;
  weight: number;
}

export function SynonymForm({
  productId,
  initialSynonym,
  onCreated,
}: SynonymFormProps) {
  const [form] = Form.useForm<FormValues>();
  const addMut = useAddSynonym();

  useEffect(() => {
    if (initialSynonym) {
      form.setFieldsValue({ synonym: initialSynonym, weight: 1.0 });
    }
  }, [form, initialSynonym]);

  const onFinish = async (values: FormValues) => {
    try {
      await addMut.mutateAsync({
        productId,
        synonym: values.synonym,
        weight: values.weight,
      });
      message.success("Đã thêm synonym");
      form.resetFields();
      form.setFieldsValue({ weight: 1.0 });
      onCreated?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Thêm thất bại";
      message.error(msg);
    }
  };

  return (
    <Form
      form={form}
      layout="inline"
      initialValues={{ weight: 1.0 }}
      onFinish={(v) => void onFinish(v as FormValues)}
    >
      <Form.Item
        name="synonym"
        rules={[
          { required: true, message: "Bắt buộc" },
          {
            validator: (_, value: string) =>
              !value || value.trim().length >= 2
                ? Promise.resolve()
                : Promise.reject(new Error("Tối thiểu 2 ký tự")),
          },
        ]}
        style={{ flex: 1, minWidth: 200 }}
      >
        <Input placeholder="vd: xa20, xarelto20" />
      </Form.Item>
      <Form.Item
        name="weight"
        rules={[{ required: true, message: "Bắt buộc" }]}
        tooltip="0.1 — 10.0 (cao hơn = ưu tiên hơn)"
      >
        <InputNumber min={0.1} max={10} step={0.1} style={{ width: 100 }} />
      </Form.Item>
      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={addMut.isPending}>
            Thêm
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
