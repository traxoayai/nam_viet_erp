// src/features/medical/components/paraclinical/LabWorkspace.tsx
import {
  CheckCircleOutlined,
  SaveOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Table, Input, Button, message, Tag, Typography, Modal } from "antd";
import { useState, useRef } from "react";

import { paraclinicalService } from "@/features/medical/api/paraclinicalService";
import { printLabResult } from "@/shared/utils/printTemplates";

const { Text } = Typography;

interface Props {
  request: any;
  onComplete: () => void;
}

export const LabWorkspace = ({ request, onComplete }: Props) => {
  // Refs cho quản lý focus (Numpad UX)
  const inputRefs = useRef<{ [key: string]: any }>({});

  const [results, setResults] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: config = [], isLoading } = useQuery({
    queryKey: ["lab_config", request.service_package_id],
    queryFn: () => paraclinicalService.getLabConfig(request.service_package_id),
    enabled: !!request.service_package_id,
  });

  // Hàm đánh giá KQ dựa trên cấu hình (Màu sắc Warning)
  const evaluateResult = (val: string, conf: any) => {
    if (!val) return null;
    if (conf.value_type === "quantitative") {
      const num = parseFloat(val);
      if (isNaN(num)) return null;
      if (conf.min_normal !== null && num < conf.min_normal)
        return (
          <Tag color="red" className="m-0">
            ↓ Thấp
          </Tag>
        );
      if (conf.max_normal !== null && num > conf.max_normal)
        return (
          <Tag color="red" className="m-0">
            ↑ Cao
          </Tag>
        );
      return (
        <Tag color="green" className="m-0">
          Bình thường
        </Tag>
      );
    } else {
      // Định tính
      if (val === "Dương tính" || val === "Dương Tính" || val === "+")
        return (
          <Tag color="red" className="m-0">
            Dương tính
          </Tag>
        );
      if (val === "Âm tính" || val === "Âm Tính" || val === "-")
        return (
          <Tag color="green" className="m-0">
            Âm tính
          </Tag>
        );
      return (
        <Tag color="default" className="m-0">
          Bình thường
        </Tag>
      );
    }
  };

  // Hàm xử lý Numpad Keydown (Enter / Up / Down / + / -)
  const handleKeyDown = (e: any, index: number, conf: any) => {
    // Hỗ trợ nhập nhanh định tính
    if (conf.value_type === "qualitative") {
      if (e.key === "+" || e.key === "Add") {
        e.preventDefault();
        handleValueChange(conf.indicator_code, "Dương tính");
        focusNext(index);
        return;
      }
      if (e.key === "-" || e.key === "Subtract") {
        e.preventDefault();
        handleValueChange(conf.indicator_code, "Âm tính");
        focusNext(index);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      focusNext(index);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusNext(index);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusPrev(index);
    }
  };

  const focusNext = (currentIndex: number) => {
    const nextIndex = currentIndex + 1;
    if (inputRefs.current[nextIndex] && inputRefs.current[nextIndex].focus) {
      inputRefs.current[nextIndex].focus();
      inputRefs.current[nextIndex].select();
    }
  };

  const focusPrev = (currentIndex: number) => {
    const prevIndex = currentIndex - 1;
    if (inputRefs.current[prevIndex] && inputRefs.current[prevIndex].focus) {
      inputRefs.current[prevIndex].focus();
      inputRefs.current[prevIndex].select();
    }
  };

  const handleValueChange = (code: string, value: string) => {
    setResults((prev) => ({ ...prev, [code]: value }));
  };

  // Kiểm tra chặn ngớ ngẩn (Absurd Limit Warning)
  const validateAbsurdLimits = () => {
    for (const conf of config) {
      const val = results[conf.indicator_code];
      if (val && conf.value_type === "quantitative") {
        const num = parseFloat(val);
        if (conf.absurd_min !== null && num < conf.absurd_min) {
          return `Chỉ số ${conf.indicator_name} (${num}) đang nhỏ hơn mức nguy hiểm tối thiểu (${conf.absurd_min})`;
        }
        if (conf.absurd_max !== null && num > conf.absurd_max) {
          return `Chỉ số ${conf.indicator_name} (${num}) đang vượt ngưỡng nguy hiểm tối đa (${conf.absurd_max})`;
        }
      }
    }
    return null; // OK
  };

  const handleSubmit = async (status: "draft" | "completed") => {
    const absurdWarning = validateAbsurdLimits();
    if (absurdWarning && status === "completed") {
      Modal.confirm({
        title: "CẢNH BÁO NHẬP LIỆU BẤT THƯỜNG",
        content: (
          <div className="text-red-500 font-bold">
            {absurdWarning}. Bạn có chắc chắn muốn trả kết quả này?
          </div>
        ),
        okText: "Tôi xác nhận kết quả đúng",
        cancelText: "Kiểm tra lại",
        okButtonProps: { danger: true },
        onOk: () => doSubmit(status),
      });
    } else {
      doSubmit(status);
    }
  };

  const handlePrint = () => {
    const testsToPrint = config.map((c: any) => ({
      name: c.indicator_name,
      value: results[c.indicator_code] || "",
      unit: c.unit,
      ref:
        c.value_type === "quantitative"
          ? `${c.min_normal || ""} - ${c.max_normal || ""}`
          : c.qualitative_normal_value || "-",
      eval: evaluateResultText(results[c.indicator_code], c),
    }));

    printLabResult({
      patientInfo: request.patient,
      serviceName: request.service_name_snapshot,
      results: testsToPrint,
      doctorName: "Admin", // Lấy từ Auth Store
      date: new Date().toISOString(),
    });
  };

  const doSubmit = async (status: "draft" | "completed") => {
    setIsSubmitting(true);
    try {
      // Build JSON
      const tests = config.map((c: any) => ({
        indicator_code: c.indicator_code,
        indicator_name: c.indicator_name,
        value: results[c.indicator_code] || "",
        unit: c.unit,
        evaluation: evaluateResultText(results[c.indicator_code], c),
      }));

      await paraclinicalService.submitResult({
        request_id: request.id,
        results_json: { tests },
        status,
      });

      if (status === "completed") {
        message.success("Đã lưu và trả kết quả thành công!");
        onComplete();
      } else {
        message.success("Đã lưu nháp!");
      }
    } catch (error: any) {
      message.error(error.message || "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  };

  const evaluateResultText = (val: string, conf: any) => {
    if (!val) return "";
    if (conf.value_type === "quantitative") {
      const num = parseFloat(val);
      if (isNaN(num)) return "";
      if (conf.min_normal !== null && num < conf.min_normal) return "Low";
      if (conf.max_normal !== null && num > conf.max_normal) return "High";
      return "Normal";
    } else {
      if (val === "Dương tính") return "Positive";
      if (val === "Âm tính") return "Negative";
      return "";
    }
  };

  const columns = [
    {
      title: "STT",
      dataIndex: "display_order",
      width: 60,
      align: "center" as const,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: "Tên xét nghiệm",
      dataIndex: "indicator_name",
      render: (txt: string, r: any) => (
        <div>
          <div className="font-bold text-gray-800">{txt}</div>
          <div className="text-xs text-blue-500">{r.indicator_code}</div>
        </div>
      ),
    },
    {
      title: "Kết quả",
      dataIndex: "result",
      width: 200,
      render: (_: any, record: any, index: number) => {
        let colorClass = "";
        const ev = evaluateResultText(results[record.indicator_code], record);
        if (ev === "High" || ev === "Low" || ev === "Positive")
          colorClass = "text-red-500 font-bold bg-red-50 focus:bg-red-100";
        if (ev === "Negative")
          colorClass =
            "text-green-600 font-bold bg-green-50 focus:bg-green-100";

        return (
          <Input
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            size="large"
            className={`w-full text-center tracking-wider text-base ${colorClass}`}
            placeholder="..."
            value={results[record.indicator_code] || ""}
            onChange={(e) =>
              handleValueChange(record.indicator_code, e.target.value)
            }
            onKeyDown={(e) => handleKeyDown(e, index, record)}
            autoFocus={index === 0} // Auto focus dòng đầu
            autoComplete="off"
          />
        );
      },
    },
    {
      title: "Đánh giá",
      dataIndex: "eval",
      align: "center" as const,
      width: 120,
      render: (_: any, record: any) =>
        evaluateResult(results[record.indicator_code], record),
    },
    {
      title: "CSBT",
      dataIndex: "range",
      width: 150,
      align: "center" as const,
      render: (_: any, r: any) => {
        if (r.value_type === "quantitative") {
          if (r.min_normal && r.max_normal)
            return `${r.min_normal} - ${r.max_normal}`;
          if (r.max_normal) return `< ${r.max_normal}`;
          if (r.min_normal) return `> ${r.min_normal}`;
        }
        return r.qualitative_normal_value || "-";
      },
    },
    {
      title: "Đơn vị",
      dataIndex: "unit",
      width: 80,
      align: "center" as const,
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white h-screen">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10">
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            Phiếu Cận Lâm Sàng: {request.service_name_snapshot}
          </h2>
          <Text type="secondary">
            BN: {request.patient?.name || "Khách vãng lai"} - Trạng thái:{" "}
            {request.status}
          </Text>
        </div>
        <div className="flex gap-3">
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>
            In Phiếu
          </Button>
          <Button
            icon={<SaveOutlined />}
            onClick={() => handleSubmit("draft")}
            loading={isSubmitting}
          >
            Lưu Nháp
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={() => handleSubmit("completed")}
            loading={isSubmitting}
            style={{ backgroundColor: "#1890ff" }}
          >
            Hoàn Thành
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 custom-scrollbar">
        <Table
          dataSource={config}
          columns={columns}
          loading={isLoading}
          pagination={false}
          rowKey="indicator_code"
          bordered
          size="middle"
          rowClassName="hover:bg-blue-50/20"
        />

        <div className="mt-4 p-4 text-xs text-gray-400 bg-gray-50 rounded italic border border-gray-100">
          * Mẹo Numpad UX: Nhập số rồi ấn `Enter` để nhảy xuống dòng kế tiếp.
          Nhập dấu `+` để ra Dương tĩnh, dấu `-` để ra Âm tính (đối với Định
          tính). Sử dụng phím `Lên/Xuống` tự do.
        </div>
      </div>
    </div>
  );
};
