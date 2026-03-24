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
  Grid,
} from "antd";
import React, { useState, useEffect, useRef } from "react";

import { getWarehouses } from "@/features/inventory/api/warehouseService";
import { getSuppliers } from "@/features/purchasing/api/supplierService";
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

const { useBreakpoint } = Grid;

const QuickMinMaxPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = screens.xs || (screens.sm && !screens.md);

  // State
  const [products, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
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
    
    // [NEW] Load nhà cung cấp
    const fetchSuppliers = async () => {
      const data = await getSuppliers();
      setSuppliers(data);
    };
    fetchSuppliers();

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
        distributor_id: p.distributor_id || null, // [NEW] Hứng ID Nhà cung cấp

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

  const handleUpdateDistributor = async (productId: number, supplierId: number) => {
    setSavingId(productId);
    try {
      // 1. Lấy chi tiết sản phẩm cũ để không làm mất data
      const currentDetail = await getProductDetails(productId);

      // 2. Chèn supplierId mới vào (upsertProduct đang dùng biến formValues.distributor)
      const payload = {
        ...currentDetail,
        distributor: supplierId 
      };

      // 3. Đẩy lên server
      await upsertProduct(payload);

      // 4. Cập nhật UI ngay lập tức
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, distributor_id: supplierId, is_dirty: false } : p))
      );
      message.success("Đã lưu Nhà cung cấp!");
    } catch (err) {
      console.error(err);
      message.error("Lỗi cập nhật Nhà cung cấp");
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
    { title: "SKU", dataIndex: "sku", width: 130 },
    {
      title: "Sản phẩm",
      dataIndex: "name",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Đơn vị",
      dataIndex: "wholesale_unit",
      width: 80,
      render: (t: string) => <Tag color="geekblue" className="rounded-md font-medium">{t}</Tag>,
    },
    {
      title: "Nhà Cung Cấp",
      dataIndex: "distributor_id",
      width: 550,
      render: (val: any, record: any) => (
        <Select
          showSearch
          className={`w-full transition-all ${record.is_dirty ? 'border-orange-400 bg-orange-50' : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:shadow-[0_0_0_2px_rgba(24,144,255,0.2)]'}`}
          placeholder="Chọn NCC..."
          optionFilterProp="children"
          value={val}
          onChange={(newId) => handleUpdateDistributor(record.id, newId)}
          disabled={savingId === record.id} // Khóa khi đang lưu
          loading={savingId === record.id}
          filterOption={(input, option) =>
            (option?.children as unknown as string)
              ?.toLowerCase()
              .includes(input.toLowerCase())
          }
        >
          {suppliers.map(s => (
            <Option key={s.id} value={s.id}>{s.name}</Option>
          ))}
        </Select>
      )
    },
    {
      title: "Min (Tồn dự trữ)",
      dataIndex: "min_stock",
      width: 120,
      render: (val: number, record: any) => (
        <InputNumber
          className={`w-full transition-all ${record.is_dirty ? 'border-orange-400 bg-orange-50' : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:shadow-[0_0_0_2px_rgba(24,144,255,0.2)]'}`}
          value={val}
          onChange={(v) => handleCellChange(record.key, "min_stock", v)}
          onBlur={() => handleSaveRow(record)}
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
          className={`w-full transition-all ${record.is_dirty ? 'border-orange-400 bg-orange-50' : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:shadow-[0_0_0_2px_rgba(24,144,255,0.2)]'}`}
          value={val}
          onChange={(v) => handleCellChange(record.key, "max_stock", v)}
          onBlur={() => handleSaveRow(record)}
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
  const renderMobileCards = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
      {displayedProducts.map((record: any) => (
        <div key={record.id} className={`rounded-xl border ${record.is_dirty ? 'border-orange-400' : 'border-gray-200'} shadow-sm bg-white overflow-hidden`}>
          {/* Header */}
          <div className="bg-slate-50 p-3 border-b border-gray-100 flex justify-between items-start">
            <div>
              <Text strong className="text-base">{record.name}</Text>
              <div className="text-gray-400 text-xs mt-1">SKU: {record.sku} | <Tag color="geekblue" className="rounded-md font-medium ml-1">{record.wholesale_unit}</Tag></div>
            </div>
            {savingId === record.id ? <SyncOutlined spin className="text-blue-500 text-lg" /> : (record.is_dirty === false ? <CheckCircleOutlined className="text-green-500 text-lg" /> : null)}
          </div>

          {/* Body */}
          <div className="p-4">
          <Select
            showSearch
            className={`w-full mb-4 transition-all ${record.is_dirty ? 'border-orange-400 bg-orange-50' : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:shadow-[0_0_0_2px_rgba(24,144,255,0.2)]'}`}
            placeholder="Chọn nhà cung cấp..."
            optionFilterProp="children"
            value={record.distributor_id}
            onChange={(newId) => handleUpdateDistributor(record.id, newId)}
            disabled={savingId === record.id}
            loading={savingId === record.id}
            filterOption={(input, option) =>
              (option?.children as unknown as string)
                ?.toLowerCase()
                .includes(input.toLowerCase())
            }
          >
            {suppliers.map(s => (
              <Option key={s.id} value={s.id}>{s.name}</Option>
            ))}
          </Select>

          <Row gutter={12}>
            <Col span={12}>
              <Text type="secondary" className="text-xs">Min (Dự trữ)</Text>
              <InputNumber 
                className={`w-full mt-1 h-10 rounded-lg transition-all ${record.is_dirty ? 'border-orange-400 bg-orange-50' : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:shadow-[0_0_0_2px_rgba(24,144,255,0.2)]'}`}
                value={record.min_stock} 
                onChange={(v) => handleCellChange(record.key, "min_stock", v)}
                onBlur={() => handleSaveRow(record)}
                size="large"
              />
            </Col>
            <Col span={12}>
              <Text type="secondary" className="text-xs">Max (Tối đa)</Text>
              <InputNumber 
                className={`w-full mt-1 h-10 rounded-lg transition-all ${record.is_dirty ? 'border-orange-400 bg-orange-50' : 'border-gray-300 hover:border-blue-400 focus:border-blue-500 focus:shadow-[0_0_0_2px_rgba(24,144,255,0.2)]'}`}
                value={record.max_stock} 
                onChange={(v) => handleCellChange(record.key, "max_stock", v)}
                onBlur={() => handleSaveRow(record)}
                size="large"
              />
            </Col>
          </Row>
          </div>
        </div>
      ))}
    </div>
  );

  // Filter Logic: Backend handles filtering via `p_has_setup_only` param
  const displayedProducts = products;

  return (
    <div style={{ padding: isMobile ? 8 : 10, paddingBottom: isMobile ? 60 : 10 }}>
      {/* TOOLBAR & STATISTICS */}
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12} lg={6}>
            <Title level={4} style={{ margin: 0 }}>
              Cài Min/Max & Tồn kho
            </Title>
          </Col>
          <Col xs={24} md={12} lg={6}>
            <Search
              className={`transition-all ${listening ? 'animate-pulse text-red-500 border-red-500' : 'border-blue-500 text-blue-600 hover:bg-blue-50'} ${isMobile ? 'w-full' : ''}`}
              placeholder="Tìm tên thuốc..."
              allowClear
              onSearch={(val) => setSearchText(val)}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Select
              className={`transition-all ${listening ? 'animate-pulse text-red-500 border-red-500' : 'border-blue-500 text-blue-600 hover:bg-blue-50'} ${isMobile ? 'w-full' : ''}`}
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
          <Col xs={24} sm={12} lg={4}>
            <Checkbox
              checked={showHasStockOnly}
              onChange={(e) => setShowHasStockOnly(e.target.checked)}
            >
              Chỉ hiện SP đã cài Min/Max
            </Checkbox>
          </Col>
          <Col xs={24} lg={4} style={{ textAlign: isMobile ? "left" : "right" }}>
            <Button
              className={`transition-all ${listening ? 'animate-pulse text-red-500 border-red-500' : 'border-blue-500 text-blue-600 hover:bg-blue-50'} ${isMobile ? 'w-full' : ''}`}
              icon={<AudioOutlined spin={listening} />}
              onClick={toggleListening}
            >
              {listening ? "Đang nghe..." : "Voice Control"}
            </Button>
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={12} sm={12}>
            <Statistic
              title="Tổng Vốn Min"
              value={totalMinValue}
              valueStyle={{ fontSize: isMobile ? 16 : 24, color: '#22c55e' }}
              prefix={<DollarCircleOutlined className="text-green-500" />}
            />
          </Col>
          <Col xs={12} sm={12}>
            <Statistic
              title="Tổng Vốn Max"
              value={totalMaxValue}
              valueStyle={{ fontSize: isMobile ? 16 : 24, color: '#22c55e' }}
              prefix={<DollarCircleOutlined className="text-green-500" />}
            />
          </Col>
        </Row>
      </Card>

      {isMobile ? (
        renderMobileCards()
      ) : (
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
      )}
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
