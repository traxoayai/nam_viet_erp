// src/pages/quick/QuickUnitPage.tsx

import {
  UploadOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  DownloadOutlined,
  SearchOutlined,
  FileImageOutlined,
} from "@ant-design/icons";
import {
  Table,
  Input,
  InputNumber,
  Button,
  Typography,
  Card,
  Space,
  Upload,
  Modal,
  Tag,
  message,
  Row,
  Col,
  Avatar,
  Grid,
} from "antd";
import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";

import {
  getAllProductsLite,
  upsertProduct,
  getProducts,
  getProductDetails,
} from "@/features/product/api/productService";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { supabase } from "@/shared/lib/supabaseClient";

const { Title, Text } = Typography;
const { Search } = Input;

// Định nghĩa cấu trúc dữ liệu cho dòng trong bảng
interface ProductRow {
  key: number;
  id: number;
  name: string;
  sku: string;
  imageUrl?: string;
  actual_cost: number;
  
  base_unit: string; // Đơn vị gốc (Rate luôn = 1)
  
  retail_unit: string; 
  retail_rate: number; // 1 Lẻ = ? Base
  
  wholesale_unit: string;
  wholesale_rate: number; // 1 Sỉ = ? Base

  is_dirty?: boolean;
  is_saving?: boolean;
}

const { useBreakpoint } = Grid;

const QuickUnitPage: React.FC = () => {
  const screens = useBreakpoint();
  const isMobile = screens.xs || (screens.sm && !screens.md);

  // --- STATE ---
  // [UPDATE] Thêm state pagination
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0,
  });
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");

  // Excel Logic State
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [matchedData, setMatchedData] = useState<any[]>([]);

  const debouncedSearch = useDebounce(searchText, 500);

  // --- EFFECT ---
  useEffect(() => {
    loadProducts(1, pagination.pageSize);
  }, [debouncedSearch]);

  // --- CORE: QUERY PAGE & PAGE CHANGE ---
  const handleTableChange = (newPagination: any) => {
    loadProducts(newPagination.current, newPagination.pageSize);
  };

  // --- CORE: LOAD DATA ---
  const loadProducts = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      let data = [];
      let total = 0;

      // 1. Nếu có từ khóa -> Gọi API Search
      if (debouncedSearch) {
        const res = await getProducts({
          filters: { search_query: debouncedSearch },
          page: page,
          pageSize: pageSize,
        });
        data = res.data;
        total = res.totalCount;
      } else {
        // 2. Nếu không -> Gọi API lấy tất cả (Lite) với Server-side Pagination
        const res = await getAllProductsLite(page, pageSize);
        data = res.data;
        total = res.total;
      }

      // 3. Map dữ liệu DB -> State Table
      const rows = data.map((p: any) => {
        const units = p.product_units || [];

        // Lấy đúng 3 unit từ DB
        const baseUnitObj = units.find((u: any) => u.is_base || u.unit_type === "base");
        const retailUnitObj = units.find((u: any) => !u.is_base && u.unit_type === "retail");
        const wholesaleUnitObj = units.find((u: any) => !u.is_base && u.unit_type === "wholesale");

        return {
          key: p.id,
          id: p.id,
          name: p.name,
          sku: p.sku,
          imageUrl: p.image_url,
          actual_cost: p.actual_cost || 0,
          
          base_unit: baseUnitObj?.unit_name || p.retail_unit || "Viên",
          
          retail_unit: retailUnitObj?.unit_name || "",
          retail_rate: retailUnitObj?.conversion_rate || 1,
          
          wholesale_unit: wholesaleUnitObj?.unit_name || p.wholesale_unit || "",
          wholesale_rate: wholesaleUnitObj?.conversion_rate || p.items_per_carton || 1,
          
          is_dirty: false,
        };
      });

      setProducts(rows);

      // 4. Update Pagination State
      setPagination((prev) => ({
        ...prev,
        current: page,
        pageSize: pageSize,
        total: total,
      }));
    } catch (error) {
      console.error("Load Error:", error);
      message.error("Lỗi tải danh sách sản phẩm.");
    } finally {
      setLoading(false);
    }
  };

  // --- CORE: SAVE LOGIC ---
  const handleSaveRow = async (row: ProductRow) => {
    if (!row.id) return;
    setSavingId(row.id);

    try {
      // 1. Lấy chi tiết hiện tại để lấy ID của các unit cũ
      const currentDetail = await getProductDetails(row.id);
      const currentUnits = currentDetail.units || [];

      // Tìm ID cũ để update (tránh mất ID)
      const oldBaseUnit = currentUnits.find((u: any) => u.unit_type === "base" || u.is_base);
      const oldRetailUnit = currentUnits.find((u: any) => u.unit_type === "retail" && !u.is_base);
      const oldWholesaleUnit = currentUnits.find((u: any) => u.unit_type === "wholesale" && !u.is_base);

      // Tạo Base Unit
      const baseUnitObj = {
        id: oldBaseUnit?.id,
        unit_name: row.base_unit || "Viên",
        unit_type: "base",
        conversion_rate: 1,
        is_base: true,
        is_direct_sale: true,
        price: row.actual_cost,
        product_id: row.id,
      };

      // Tạo Retail Unit (Nếu có nhập)
      const retailUnitObj = row.retail_unit ? {
        id: oldRetailUnit?.id,
        unit_name: row.retail_unit,
        unit_type: "retail",
        conversion_rate: row.retail_rate || 1,
        is_base: false,
        is_direct_sale: true,
        price: 0, 
        product_id: row.id,
      } : null;

      // Tạo Wholesale Unit (Nếu có nhập)
      const wholesaleUnitObj = row.wholesale_unit ? {
        id: oldWholesaleUnit?.id,
        unit_name: row.wholesale_unit,
        unit_type: "wholesale",
        conversion_rate: row.wholesale_rate || 1,
        is_base: false,
        is_direct_sale: true,
        price: 0,
        product_id: row.id,
      } : null;

      // Gom mảng và lọc bỏ null
      const newUnits = [baseUnitObj, retailUnitObj, wholesaleUnitObj].filter(Boolean);
      
      const payload = {
        ...currentDetail,
        units: newUnits,
      };

      // 9. Gọi API
      await upsertProduct(payload);

      message.success("Đã lưu!", 0.5);

      // Update state local để tắt trạng thái 'dirty'
      setProducts((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, is_dirty: false } : p))
      );
    } catch (err) {
      message.error("Lỗi lưu đơn vị");
      console.error(err);
    } finally {
      setSavingId(null);
    }
  };

  // Sự kiện khi rời khỏi ô nhập liệu (Auto-save)
  const handleBlur = (record: ProductRow) => {
    if (record.is_dirty) {
      handleSaveRow(record);
    }
  };

  // Cập nhật state local khi gõ
  const handleCellChange = (key: number, field: string, value: any) => {
    setProducts((prev) =>
      prev.map((item) => {
        if (item.key === key) {
          return { ...item, [field]: value, is_dirty: true };
        }
        return item;
      })
    );
  };

  // --- TEMPLATE DOWNLOAD ---
  const handleDownloadTemplate = () => {
    const header = [
      "SKU",
      "Tên Sản Phẩm",
      "Đơn vị Cơ Sở", // VD: Viên
      "Đơn vị Lẻ", // VD: Vỉ
      "Quy đổi Lẻ (Rate)", // VD: 10 (1 Vỉ = 10 Viên)
      "Đơn vị Buôn", // VD: Hộp
      "Quy đổi Buôn (Rate)", // VD: 100 (1 Hộp = 100 Viên)
    ];
    const data = [
      ["PAN001", "Panadol Extra", "Viên", "Vỉ", 10, "Hộp", 100],
      ["EFF001", "Efferalgan 500", "Viên", "Tuýp", 16, "Thùng", 320],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws["!cols"] = [
      { wch: 15 },
      { wch: 30 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Quy_Cach_3_Cap");
    XLSX.writeFile(wb, "Mau_Setup_Quy_Cach_V2.xlsx");
  };

  // --- EXCEL SMART MATCH LOGIC ---
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const ab = e.target?.result;
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(ws);
      processExcelData(jsonData);
    };
    reader.readAsArrayBuffer(file);
    return false; // Prevent default upload
  };

  const processExcelData = async (excelRows: any[]) => {
    // 1. Chuẩn bị dữ liệu (Lấy cả Tên và SKU từ Excel)
    const itemsToMatch = excelRows
      .map((row) => {
        // Lấy giá trị thô
        const rawSku = row["SKU"] || row["Mã hàng"] || row["Mã"];

        // [FIX] Chuẩn hóa SKU: Chuyển về String, Trim khoảng trắng
        let cleanSku = "";
        if (rawSku !== undefined && rawSku !== null) {
          cleanSku = String(rawSku).trim();
        }

        return {
          name: (
            row["Tên Sản Phẩm"] ||
            row["Product Name"] ||
            row["Tên"] ||
            ""
          ).trim(),
          sku: cleanSku,
        };
      })
      .filter((item) => item.name); // Lọc bỏ dòng trống tên

    if (itemsToMatch.length === 0) {
      message.warning(
        "File Excel không có dữ liệu hợp lệ (Cần cột 'Tên Sản Phẩm')"
      );
      return;
    }

    // 2. Cấu hình Batching
    const BATCH_SIZE = 10;
    const totalBatches = Math.ceil(itemsToMatch.length / BATCH_SIZE);
    let allServerMatches: any[] = [];

    const hideLoading = message.loading(
      `Đang đối chiếu dữ liệu (0/${itemsToMatch.length})...`,
      0
    );

    try {
      // Loop từng Batch
      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE;
        const end = start + BATCH_SIZE;
        const batchItems = itemsToMatch.slice(start, end);

        hideLoading();
        message.loading(
          `Đang đối chiếu: ${Math.min(end, itemsToMatch.length)}/${itemsToMatch.length} sản phẩm...`,
          0
        );

        // [NEW API CALL] Gửi JSONB {name, sku}
        const { data: batchResults, error } = await supabase.rpc(
          "match_products_from_excel",
          {
            p_data: batchItems,
          }
        );

        if (error) throw error;
        if (batchResults) {
          allServerMatches = [...allServerMatches, ...batchResults];
        }
      }

      // 3. Map kết quả trả về vào cấu trúc bảng Preview
      const matches: any[] = [];

      excelRows.forEach((row, index) => {
        const name =
          row["Tên Sản Phẩm"] || row["Product Name"] || row["Tên"] || "";
        const sku = String(row["SKU"] || row["Mã hàng"] || "").trim();

        // Map 3 cấp đơn vị
        const baseUnit = row["Đơn vị Cơ Sở"] || "Viên"; // Mặc định Viên nếu trống
        const retailUnit = row["Đơn vị Lẻ"] || "";
        const retailRate =
          Number(row["Quy đổi Lẻ (Rate)"] || row["Quy đổi Lẻ"]) || 1;
        const wholesaleUnit = row["Đơn vị Buôn"] || "";
        const wholesaleRate =
          Number(row["Quy đổi Buôn (Rate)"] || row["Quy đổi Buôn"]) || 1;

        if (!name) return;

        // [FIX] Chuẩn hóa để so sánh an toàn
        const serverMatch = allServerMatches.find((m: any) => {
          // So sánh tên (Trimmed)
          const nameMatch = m.excel_name === name;

          // So sánh SKU (Chấp nhận null == '' == undefined)
          const serverSku = m.excel_sku ? String(m.excel_sku).trim() : "";
          const clientSku = sku ? String(sku).trim() : "";
          const skuMatch = serverSku === clientSku;

          return nameMatch && skuMatch;
        });

        matches.push({
          rowIndex: index,
          excel: {
            name,
            sku,
            baseUnit,
            retailUnit,
            retailRate,
            wholesaleUnit,
            wholesaleRate,
          },
          match: serverMatch?.product_id
            ? {
                id: serverMatch.product_id,
                name: serverMatch.product_name,
                sku: serverMatch.product_sku,
              }
            : null,
          score: serverMatch?.similarity_score || 0,
          matchType: serverMatch?.match_type, // 'sku_exact', 'name_exact', 'name_fuzzy'
        });
      });

      // 4. Hiển thị Modal Review
      const confidentMatches = matches.sort((a, b) => b.score - a.score);
      setMatchedData(confidentMatches);
      setReviewModalVisible(true);

      message.success("Đối chiếu hoàn tất!");
    } catch (err) {
      console.error("Match Error:", err);
      message.error("Lỗi khi đối chiếu dữ liệu với Server.");
    } finally {
      hideLoading();
    }
  };

  const applyMatches = async () => {
    setLoading(true);

    console.log("Matched Data:", matchedData); // [DEBUG]

    // [FIX] Lọc linh hoạt hơn
    const payload = matchedData
      .filter((m) => m.match && m.match.id) // Chỉ cần có match object và có ID
      .map((m) => ({
        product_id: m.match.id,
        sku: m.match.sku || m.excel.sku, // Ưu tiên SKU hệ thống

        base_unit: m.excel.baseUnit,

        retail_unit: m.excel.retailUnit,
        retail_rate: m.excel.retailRate,

        wholesale_unit: m.excel.wholesaleUnit,
        wholesale_rate: m.excel.wholesaleRate,
      }));

    console.log("Payload to send:", payload); // [DEBUG] Check xem có dữ liệu không

    if (payload.length === 0) {
      message.warning("Không tìm thấy dữ liệu khớp hợp lệ để lưu.");
      setLoading(false);
      return;
    }

    try {
      // Gọi RPC mới
      const { error } = await supabase.rpc(
        "bulk_update_product_units_for_quick_unit_page",
        {
          p_data: payload,
        }
      );

      if (error) throw error;

      message.success(`Đã cập nhật quy cách cho ${payload.length} sản phẩm!`);
      setReviewModalVisible(false);
      loadProducts(pagination.current, pagination.pageSize); // Reload bảng
    } catch (err: any) {
      console.error(err);
      message.error("Lỗi cập nhật: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- TABLE COLUMNS ---
  const columns = [
    {
      title: "SKU",
      dataIndex: "sku",
      width: 100,
      fixed: "left" as const,
    },
    {
      title: "Ảnh",
      dataIndex: "imageUrl",
      width: 70,
      render: (url: string) => (
        <Avatar
          shape="square"
          size={50}
          src={url}
          icon={<FileImageOutlined />}
          style={{ backgroundColor: "#f0f0f0" }}
        />
      ),
    },
    {
      title: "Sản phẩm",
      dataIndex: "name",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Đơn vị Cơ Sở (Kho)",
      dataIndex: "base_unit",
      width: 120,
      render: (text: string, record: ProductRow) => (
        <Input
          value={text}
          onChange={(e) => handleCellChange(record.key, "base_unit", e.target.value)}
          onBlur={() => handleBlur(record)}
          style={{ borderColor: record.is_dirty ? "#1890ff" : undefined }}
          placeholder="Viên"
        />
      ),
    },
    {
      title: "Đơn vị Lẻ",
      dataIndex: "retail_unit",
      width: 120,
      render: (text: string, record: ProductRow) => (
        <Input
          value={text}
          onChange={(e) => handleCellChange(record.key, "retail_unit", e.target.value)}
          onBlur={() => handleBlur(record)}
          style={{ borderColor: record.is_dirty ? "#1890ff" : undefined }}
          placeholder="Vỉ"
        />
      ),
    },
    {
      title: "Rate Lẻ",
      dataIndex: "retail_rate",
      width: 100,
      render: (val: number, record: ProductRow) => (
        <InputNumber
          value={val}
          min={1}
          onChange={(v) => handleCellChange(record.key, "retail_rate", v)}
          onBlur={() => handleBlur(record)}
          style={{ width: "100%", borderColor: record.is_dirty ? "#1890ff" : undefined }}
        />
      ),
    },
    {
      title: "Đơn vị Sỉ",
      dataIndex: "wholesale_unit",
      width: 120,
      render: (text: string, record: ProductRow) => (
        <Input
          value={text}
          onChange={(e) => handleCellChange(record.key, "wholesale_unit", e.target.value)}
          onBlur={() => handleBlur(record)}
          style={{ borderColor: record.is_dirty ? "#1890ff" : undefined }}
          placeholder="Hộp"
        />
      ),
    },
    {
      title: "Rate Sỉ",
      dataIndex: "wholesale_rate",
      width: 100,
      render: (val: number, record: ProductRow) => (
        <InputNumber
          value={val}
          min={1}
          onChange={(v) => handleCellChange(record.key, "wholesale_rate", v)}
          onBlur={() => handleBlur(record)}
          style={{ width: "100%", borderColor: record.is_dirty ? "#1890ff" : undefined }}
        />
      ),
    },
    {
      title: "Trạng thái",
      width: 80,
      align: "center" as const,
      render: (_: any, record: ProductRow) => {
        if (savingId === record.id)
          return <SyncOutlined spin style={{ color: "#1890ff" }} />;
        if (record.is_dirty === false)
          return (
            <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
          );
        return null;
      },
    },
  ];

  const renderMobileCard = (item: ProductRow) => (
    <Card 
      key={item.key} 
      size="small" 
      style={{ marginBottom: 12, borderRadius: 12, border: item.is_dirty ? '1px solid #1890ff' : 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
      styles={{ body: { padding: 12 } }}
    >
      <Row wrap={false} align="middle" justify="space-between" style={{ marginBottom: 12 }}>
        <Col flex="auto">
          <Space>
            {item.imageUrl ? <Avatar shape="square" size={40} src={item.imageUrl} /> : <Avatar shape="square" size={40} icon={<FileImageOutlined />} style={{ backgroundColor: "#f0f0f0" }} />}
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.2 }}>{item.name}</div>
              <div style={{ fontSize: 12, color: '#888' }}>SKU: {item.sku}</div>
            </div>
          </Space>
        </Col>
        <Col>
          <Button 
            type="primary" 
            shape="circle" 
            icon={savingId === item.id ? <SyncOutlined spin /> : <CheckCircleOutlined />} 
            disabled={!item.is_dirty}
            onClick={() => handleSaveRow(item)}
          />
        </Col>
      </Row>

      <div style={{ background: '#f8f9fa', padding: 12, borderRadius: 8 }}>
        <Row gutter={[8, 12]}>
          {/* Cấp 1: Base */}
          <Col span={24}>
            <Text strong style={{ fontSize: 13, color: '#1677ff' }}>1. Đơn vị Cơ Sở (Kho)</Text>
            <Input
              value={item.base_unit}
              onChange={(e) => handleCellChange(item.key, "base_unit", e.target.value)}
              placeholder="VD: Viên, Gói, Lọ"
              style={{ marginTop: 4, borderColor: item.is_dirty ? "#1890ff" : undefined }}
            />
          </Col>

          {/* Cấp 2: Retail */}
          <Col span={24}>
            <Text strong style={{ fontSize: 13, color: '#52c41a' }}>2. Đơn vị Lẻ (Bán Quầy)</Text>
            <Space.Compact style={{ width: '100%', marginTop: 4 }}>
              <Input
                style={{ width: '50%', borderColor: item.is_dirty ? "#1890ff" : undefined }}
                value={item.retail_unit}
                onChange={(e) => handleCellChange(item.key, "retail_unit", e.target.value)}
                placeholder="VD: Vỉ"
              />
              <InputNumber
                style={{ width: '50%', borderColor: item.is_dirty ? "#1890ff" : undefined }}
                value={item.retail_rate}
                min={1}
                onChange={(v) => handleCellChange(item.key, "retail_rate", v)}
                addonBefore={`= ? ${item.base_unit || 'Cơ sở'}`}
              />
            </Space.Compact>
          </Col>

          {/* Cấp 3: Wholesale */}
          <Col span={24}>
            <Text strong style={{ fontSize: 13, color: '#fa8c16' }}>3. Đơn vị Sỉ (Nhập/Bán Buôn)</Text>
            <Space.Compact style={{ width: '100%', marginTop: 4 }}>
              <Input
                style={{ width: '50%', borderColor: item.is_dirty ? "#1890ff" : undefined }}
                value={item.wholesale_unit}
                onChange={(e) => handleCellChange(item.key, "wholesale_unit", e.target.value)}
                placeholder="VD: Hộp"
              />
              <InputNumber
                style={{ width: '50%', borderColor: item.is_dirty ? "#1890ff" : undefined }}
                value={item.wholesale_rate}
                min={1}
                onChange={(v) => handleCellChange(item.key, "wholesale_rate", v)}
                addonBefore={`= ? ${item.base_unit || 'Cơ sở'}`}
              />
            </Space.Compact>
          </Col>
        </Row>
      </div>
    </Card>
  );

  return (
    <div style={{ height: 'calc(100vh - 64px)', padding: isMobile ? 0 : '16px', backgroundColor: isMobile ? '#f5f5f5' : 'transparent' }}>
      <Card 
        style={{ height: '100%', display: 'flex', flexDirection: 'column', border: isMobile ? 'none' : undefined, borderRadius: isMobile ? 0 : 8 }}
        bodyStyle={{ display: 'flex', flexDirection: 'column', flex: 1, padding: isMobile ? '8px' : '16px', overflow: 'hidden' }}
      >
        {/* Header Toolbar */}
        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Title level={4} style={{ margin: 0 }}>
              <ThunderboltOutlined style={{ color: "#faad14" }} /> Cài đặt Quy Cách Nhanh
            </Title>
          </Col>
          <Col xs={24} md={8}>
            <Search
              placeholder="Tìm tên thuốc, hoạt chất..."
              allowClear
              enterButton={<SearchOutlined />}
              onSearch={(val) => setSearchText(val)}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          <Col xs={24} md={8} style={{ textAlign: "right" }}>
            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
              >
                Tải File Mẫu
              </Button>
              <Upload
                beforeUpload={handleFileUpload}
                showUploadList={false}
                accept=".xlsx, .xls"
              >
                <Button icon={<UploadOutlined />} type="primary" ghost>
                  Import Excel Match
                </Button>
              </Upload>
            </Space>
          </Col>
        </Row>

        {/* Khối Nội Dung */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {isMobile ? (
            <div style={{ paddingBottom: 60 }}>
              {products.map(item => renderMobileCard(item))}
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={products}
              loading={loading}
              rowKey="key"
              // Server-side Pagination Configuration
              pagination={{
                current: pagination.current,
                pageSize: pagination.pageSize,
                total: pagination.total,
                position: ["bottomRight"],
                pageSizeOptions: ["10", "20", "50", "100"],
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `Hiển thị ${range[0]}-${range[1]} của ${total} sản phẩm`,
              }}
              onChange={handleTableChange} // [IMPORTANT] Trigger loading on change
              size="middle"
              scroll={{ x: 1000, y: 'calc(100vh - 280px)' }}
              bordered
            />
          )}
        </div>
      </Card>

      {/* Modal Review Excel Match */}
      <Modal
        title="Kết quả So khớp Excel (Smart Match)"
        open={reviewModalVisible}
        onOk={applyMatches}
        onCancel={() => setReviewModalVisible(false)}
        width={800}
        zIndex={9999}
        okText="Áp dụng Tất cả"
        cancelText="Hủy"
      >
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          <Table
            dataSource={matchedData}
            rowKey={(r) => r.rowIndex}
            pagination={false}
            columns={[
              {
                title: "Thông tin Excel",
                dataIndex: "excel",
                render: (excel) => (
                  <div>
                    <b>{excel.name}</b> <br />
                    <Text type="secondary">
                      {excel.baseUnit} (1) {" -> "}
                      {excel.retailUnit} ({excel.retailRate}) {" -> "}
                      {excel.wholesaleUnit} ({excel.wholesaleRate})
                    </Text>
                  </div>
                ),
              },
              {
                title: "Khớp với (Hệ thống)",
                dataIndex: "match",
                render: (match, record: any) => (
                  <div
                    style={{
                      padding: 8,
                      background: record.score >= 0.9 ? "#f6ffed" : "#fffbe6",
                      borderRadius: 4,
                      border: "1px solid #ddd",
                    }}
                  >
                    {match ? (
                      <>
                        <div>
                          {/* Hiển thị Icon độ tin cậy */}
                          {record.matchType === "sku_exact" && (
                            <Tag color="green">Khớp SKU</Tag>
                          )}
                          {record.matchType === "name_exact" && (
                            <Tag color="cyan">Khớp Tên</Tag>
                          )}
                          {record.matchType === "name_fuzzy" && (
                            <Tag color="orange">Gần giống</Tag>
                          )}

                          <b style={{ marginLeft: 4 }}>{match.name}</b>
                        </div>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          Mã: {match.sku}
                          {record.matchType === "name_fuzzy" &&
                            ` (Độ giống: ${Math.round(record.score * 100)}%)`}
                        </div>
                      </>
                    ) : (
                      <Text type="danger">Không tìm thấy</Text>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
};

export default QuickUnitPage;
