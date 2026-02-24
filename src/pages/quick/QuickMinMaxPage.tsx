// src/pages/quick/QuickMinMaxPage.tsx
import {
  AudioOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  DollarCircleOutlined,
} from "@ant-design/icons";
import {
  Table,
  InputNumber,
  Typography,
  Card,
  Button,
  message,
  Statistic,
  Row,
  Col,
  Select,
  Tag,
  Input,
  Checkbox,
} from "antd";
import React, { useState, useEffect, useRef } from "react";

import { getWarehouses } from "@/features/inventory/api/warehouseService";
import { upsertProduct } from "@/features/product/api/productService";
import { getProductDetails } from "@/features/product/api/productService"; // Ensure this is imported for handleSaveRow
import { useDebounce } from "@/shared/hooks/useDebounce";
import { supabase } from "@/shared/lib/supabaseClient";

const { Title, Text } = Typography;
const { Option } = Select;
const { Search } = Input;

// Voice API Interface
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

// Add timeout property to window for voice logic debounce
declare global {
  interface Window {
    voiceTimeout?: any;
  }
}

const QuickMinMaxPage: React.FC = () => {
  // State
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [listening, setListening] = useState(false);

  // New Feature State
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(
    null
  );
  const [activeRowKey, setActiveRowKey] = useState<number | null>(null);

  // Search State
  const [searchText, setSearchText] = useState("");
  const debouncedSearch = useDebounce(searchText, 500);

  // [New] Pagination & Filter State (V43)
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showHasStockOnly, setShowHasStockOnly] = useState(false);

  // Voice Buffer State
  const [voiceBuffer, setVoiceBuffer] = useState<{
    min?: number;
    max?: number;
  }>({});

  // Refs
  const recognitionRef = useRef<any>(null);

  // Calculate Totals (Updated to handle NaN and conversion)
  const totalMinValue = products.reduce(
    (sum, p) =>
      sum +
      (p.min_stock || 0) * (p.conversion_rate || 1) * (p.actual_cost || 0),
    0
  );
  const totalMaxValue = products.reduce(
    (sum, p) =>
      sum +
      (p.max_stock || 0) * (p.conversion_rate || 1) * (p.actual_cost || 0),
    0
  );

  useEffect(() => {
    loadWarehouses();
    setupSpeechRecognition();
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Effect for Search & Pagination
  useEffect(() => {
    if (selectedWarehouseId) {
      loadProducts(debouncedSearch, currentPage, pageSize);
    }
  }, [
    debouncedSearch,
    currentPage,
    pageSize,
    selectedWarehouseId,
    showHasStockOnly,
  ]);

  const loadWarehouses = async () => {
    try {
      const res = await getWarehouses({}, 1, 100);
      setWarehouses(res.data);
      if (res.data.length > 0) {
        setSelectedWarehouseId(res.data[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // [REPLACE] Hàm loadProducts mới (Sử dụng RPC get_inventory_setup_grid)

  // [REPLACE] Hàm loadProducts mới (Sử dụng RPC get_inventory_setup_grid)

  const loadProducts = async (
    term: string = "",
    page: number = 1,
    size: number = 20
  ) => {
    if (!selectedWarehouseId) return;
    setLoading(true);

    try {
      // GỌI RPC MỚI - DỮ LIỆU PHẲNG
      // Không cần filter local, Backend đã làm hết
      const { data, error } = await supabase.rpc("get_inventory_setup_grid", {
        p_warehouse_id: selectedWarehouseId,
        p_search: term,
        p_limit: size,
        p_offset: (page - 1) * size,
        p_has_setup_only: showHasStockOnly, // Filter "Đã cài đặt"
      });

      if (error) throw error;

      // Map dữ liệu (Backend trả về đã chuẩn, chỉ cần tính lại giá trị hiển thị)
      const rows = (data || []).map((p: any) => ({
        key: p.product_id,
        id: p.product_id,
        sku: p.sku,
        name: p.name,

        // Các trường tính toán
        actual_cost: Number(p.actual_cost) || 0,
        wholesale_unit: p.unit_name, // Backend đã chọn giúp đơn vị hiển thị
        conversion_rate: p.conversion_rate, // Backend đã lấy tỷ lệ quy đổi

        // Min/Max trong DB lưu theo Base Unit -> Chia tỷ lệ để ra đơn vị hiển thị
        min_stock: (p.min_stock || 0) / p.conversion_rate,
        max_stock: (p.max_stock || 0) / p.conversion_rate,

        is_dirty: false,
      }));

      setProducts(rows);

      // Lấy total_count từ dòng đầu tiên để phân trang
      // Nếu không có dữ liệu thì total = 0
      const totalRecords =
        data && data.length > 0 ? Number(data[0].total_count) : 0;
      setTotal(totalRecords);

      // UX: Tự động focus dòng đầu
      if (rows.length > 0 && activeRowKey === null) setActiveRowKey(rows[0].id);
    } catch (error: any) {
      console.error("Lỗi tải data:", error);
      message.error("Lỗi tải dữ liệu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const setupSpeechRecognition = () => {
    const { webkitSpeechRecognition, SpeechRecognition } =
      window as unknown as IWindow;
    const Speech = SpeechRecognition || webkitSpeechRecognition;

    if (!Speech) {
      console.warn("Browser not support Speech API");
      return;
    }

    const recognition = new Speech();
    recognition.continuous = true;
    recognition.lang = "vi-VN";
    recognition.interimResults = true;

    recognition.onstart = () => {
      console.log("Voice started");
      setListening(true);
    };

    recognition.onend = () => {
      console.log("Voice ended");
      setListening(false);
    };

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.toLowerCase();
      processRealtimeVoice(transcript, result.isFinal);
    };

    recognition.onerror = (e: any) => {
      console.error("Voice Error:", e);
      if (e.error === "not-allowed") {
        message.error("Vui lòng cho phép truy cập Micro!");
      }
      setListening(false);
    };

    recognitionRef.current = recognition;
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const processRealtimeVoice = (text: string, _isFinal: boolean) => {
    if (activeRowKey === null) return;

    let minVal: number | undefined = undefined;
    let maxVal: number | undefined = undefined;

    if (text.includes("min")) {
      const match = text.match(/min\s*(\d+)/i);
      if (match) minVal = parseInt(match[1]);
    }
    if (text.includes("max")) {
      const match = text.match(/max\s*(\d+)/i);
      if (match) maxVal = parseInt(match[1]);
    }

    if (minVal === undefined && maxVal === undefined) {
      const numbers = text.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        minVal = parseInt(numbers[0]);
        maxVal = parseInt(numbers[1]);
      } else if (numbers && numbers.length === 1) {
        minVal = parseInt(numbers[0]);
      }
    }

    if (minVal !== undefined || maxVal !== undefined) {
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === activeRowKey) {
            const newMin = minVal !== undefined ? minVal : p.min_stock;
            const newMax = maxVal !== undefined ? maxVal : p.max_stock;
            return {
              ...p,
              min_stock: newMin,
              max_stock: newMax,
              is_dirty: true,
            };
          }
          return p;
        })
      );

      setVoiceBuffer((prev) => ({
        min: minVal !== undefined ? minVal : prev.min,
        max: maxVal !== undefined ? maxVal : prev.max,
      }));
    }

    const currentBuffer = {
      min: minVal !== undefined ? minVal : voiceBuffer.min,
      max: maxVal !== undefined ? maxVal : voiceBuffer.max,
    };

    if (currentBuffer.min !== undefined && currentBuffer.max !== undefined) {
      if (window.voiceTimeout) clearTimeout(window.voiceTimeout);

      window.voiceTimeout = setTimeout(() => {
        setProducts((prev) => {
          const found = prev.find((p) => p.id === activeRowKey);
          if (found) {
            const mergedRow = {
              ...found,
              min_stock: currentBuffer.min,
              max_stock: currentBuffer.max,
            };
            handleSaveRow(mergedRow, true);
            moveToNextRow(prev);
          }
          return prev;
        });
        setVoiceBuffer({});
      }, 1000);
    }
  };

  const moveToNextRow = (currentProducts: any[]) => {
    const currentIndex = currentProducts.findIndex(
      (p) => p.id === activeRowKey
    );
    if (currentIndex !== -1 && currentIndex < currentProducts.length - 1) {
      const nextId = currentProducts[currentIndex + 1].id;
      setActiveRowKey(nextId);
      const el = document.getElementById(`row-${nextId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleSaveRow = async (row: any, autoMove = false) => {
    if (!row.id || !selectedWarehouseId) {
      if (!selectedWarehouseId) message.warning("Vui lòng chọn Kho trước!");
      return;
    }

    setSavingId(row.id);
    try {
      const realMin = (row.min_stock || 0) * row.conversion_rate;
      const realMax = (row.max_stock || 0) * row.conversion_rate;

      const currentDetail = await getProductDetails(row.id);

      let invList: any[] = [];
      if (Array.isArray(currentDetail.inventorySettings)) {
        invList = [...currentDetail.inventorySettings];
      } else if (typeof currentDetail.inventorySettings === "object") {
        invList = Object.values(currentDetail.inventorySettings);
      }

      invList = invList.filter(
        (i: any) => i.warehouse_id !== selectedWarehouseId
      );

      const newItem = {
        warehouse_id: selectedWarehouseId,
        min: realMin,
        max: realMax,
        min_stock: realMin,
        max_stock: realMax,
        shelf_location: "",
        location_cabinet: "",
        location_row: "",
        location_slot: "",
      };

      invList.push(newItem);

      const payload = {
        ...currentDetail,
        inventorySettings: invList,
      };

      await upsertProduct(payload);

      if (!autoMove) message.success("Đã lưu!");
      setProducts((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, is_dirty: false } : p))
      );
    } catch (err) {
      console.error(err);
      message.error("Lỗi lưu");
    } finally {
      setSavingId(null);
    }
  };

  // UI Helpers
  const handleCellChange = (key: number, field: string, val: any) => {
    setProducts((prev) =>
      prev.map((item) =>
        item.key === key ? { ...item, [field]: val, is_dirty: true } : item
      )
    );
  };

  const columns = [
    { title: "SKU", dataIndex: "sku", width: 80 },
    {
      title: "Sản phẩm",
      dataIndex: "name",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Đơn vị",
      dataIndex: "wholesale_unit",
      width: 80,
      render: (t: string) => <Tag color="blue">{t}</Tag>,
    },
    {
      title: "Min (Tồn dự trữ)",
      dataIndex: "min_stock",
      width: 120,
      render: (val: number, record: any) => (
        <InputNumber
          value={val}
          onChange={(v) => handleCellChange(record.key, "min_stock", v)}
          onBlur={() => handleSaveRow(record)}
          style={{ width: "100%" }}
          onFocus={() => setActiveRowKey(record.id)}
        />
      ),
    },
    {
      title: "Max (Tồn tối đa)",
      dataIndex: "max_stock",
      width: 120,
      render: (val: number, record: any) => (
        <InputNumber
          value={val}
          onChange={(v) => handleCellChange(record.key, "max_stock", v)}
          onBlur={() => handleSaveRow(record)}
          style={{ width: "100%" }}
          onFocus={() => setActiveRowKey(record.id)}
        />
      ),
    },
    {
      title: "Vốn dự trữ (Min)",
      width: 150,
      render: (_: any, r: any) => {
        // [FIX 4] Prevent NaN
        const cost = r.actual_cost || 0;
        const min = r.min_stock || 0;
        const conv = r.conversion_rate || 1;

        const value = min * conv * cost;

        return (
          <Text type="secondary">
            {new Intl.NumberFormat("vi-VN", {
              style: "currency",
              currency: "VND",
            }).format(value)}
          </Text>
        );
      },
    },
    {
      title: "",
      width: 50,
      render: (_: any, record: any) => {
        if (savingId === record.id) return <SyncOutlined spin />;
        if (record.is_dirty === false)
          return <CheckCircleOutlined style={{ color: "green" }} />;
        return null;
      },
    },
  ];

  // Filter Logic
  // Filter Logic: Backend handles filtering via `p_has_setup_only` param
  const displayedProducts = products;

  return (
    <div style={{ padding: 24 }}>
      {/* TOOLBAR & STATISTICS */}
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={6}>
            <Title level={4} style={{ margin: 0 }}>
              Cài Min/Max & Tồn kho
            </Title>
          </Col>
          <Col span={6}>
            <Search
              placeholder="Tìm tên thuốc..."
              allowClear
              onSearch={(val) => setSearchText(val)}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col span={4}>
            <Select
              style={{ width: "100%" }}
              placeholder="Chọn kho..."
              value={selectedWarehouseId}
              onChange={(v) => setSelectedWarehouseId(v)}
            >
              {warehouses.map((w) => (
                <Option key={w.id} value={w.id}>
                  {w.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Checkbox
              checked={showHasStockOnly}
              onChange={(e) => setShowHasStockOnly(e.target.checked)}
            >
              Chỉ hiện SP đã cài Min/Max
            </Checkbox>
          </Col>
          <Col span={4} style={{ textAlign: "right" }}>
            <Button
              type={listening ? "primary" : "default"}
              danger={listening}
              icon={<AudioOutlined spin={listening} />}
              onClick={toggleListening}
            >
              {listening ? "Đang nghe..." : "Voice Control"}
            </Button>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Statistic
              title="Tổng Vốn Min"
              value={totalMinValue}
              prefix={<DollarCircleOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="Tổng Vốn Max"
              value={totalMaxValue}
              prefix={<DollarCircleOutlined />}
            />
          </Col>
        </Row>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={displayedProducts}
          loading={loading}
          rowKey="id"
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
          size="middle"
          scroll={{ y: 600 }}
          rowClassName={(record) =>
            record.id === activeRowKey ? "highlight-row" : ""
          }
          onRow={(record) => ({
            id: `row-${record.id}`, // Assign ID for scrolling
            onClick: () => setActiveRowKey(record.id),
          })}
        />
      </Card>
      <style>{`
                .highlight-row {
                    background-color: #fffbe6 !important; /* Light Yellow */
                    transition: background-color 0.3s;
                }
                .highlight-row:hover {
                    background-color: #fff1b8 !important;
                }
            `}</style>
    </div>
  );
};

export default QuickMinMaxPage;
