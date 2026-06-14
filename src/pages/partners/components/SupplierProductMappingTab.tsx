import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Typography,
  Popconfirm,
  Select,
  Upload,
  Tag,
  Row,
  Col,
} from "antd";
import { App as AntApp } from "antd";
import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { supabase } from "@/shared/lib/supabaseClient";
import DebounceProductSelect from "@/shared/ui/common/DebounceProductSelect";

const { Text, Title } = Typography;

// ----- TYPES -----
interface ProductRef {
  id: number;
  name: string;
  sku: string | null;
}

interface ProductUnitRef {
  id: number;
  unit_name: string;
}

interface ProductUnitOption {
  id: number;
  unit_name: string;
  conversion_rate: number | null;
  unit_type: string | null;
}

interface ProductUnitWithProductId {
  id: number;
  product_id: number | null;
  unit_name: string;
}

interface VendorMappingRow {
  id: number;
  vendor_tax_code: string;
  vendor_product_name: string;
  supplier_sku: string | null;
  vendor_unit: string | null;
  internal_product_id: number | null;
  internal_product_unit_id: number | null;
  internal_unit: string | null;
  pre_vat_price: number | null;
  vat_of_supplier: number | null;
  products?: ProductRef | null;
  product_units?: ProductUnitRef | null;
}

interface RpcItemPayload {
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_of_supplier: number;
}

interface RpcMappingResult {
  internal_product_id: number | null;
  internal_product_name: string | null;
  internal_product_unit_id: number | null;
  match_method: string | null;
}

interface ImportReviewItem {
  key: number;
  supplier_sku: string;
  vendor_product_name: string;
  vendor_unit: string;
  pre_vat_price: number;
  vat_of_supplier: number;
  internal_product_id: number | null;
  internal_product_name: string;
  internal_product_unit_id: number | null;
  match_method: string;
  product_units: ProductUnitWithProductId[];
}

interface ExcelImportRow {
  "Mã SKU NCC"?: string;
  supplier_sku?: string;
  "Tên sản phẩm NCC"?: string;
  vendor_product_name?: string;
  "Đơn vị tính NCC"?: string;
  vendor_unit?: string;
  "Giá trước VAT"?: number;
  pre_vat_price?: number;
  "Thuế VAT"?: number;
  vat_of_supplier?: number;
}

interface ProductSelectOption {
  product?: { name?: string };
}

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Lỗi không xác định";
};

interface SupplierProductMappingTabProps {
  vendorTaxCode: string;
  vendorId?: number;
  vendorName?: string;
}

const SupplierProductMappingTab: React.FC<SupplierProductMappingTabProps> = ({
  vendorTaxCode,
  vendorId,
  vendorName,
}) => {
  const { message } = AntApp.useApp();
  const [data, setData] = useState<VendorMappingRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Normal Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null
  );
  const [productUnits, setProductUnits] = useState<ProductUnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);

  // Import Review Mode State
  const [importReviewMode, setImportReviewMode] = useState(false);
  const [importedItems, setImportedItems] = useState<ImportReviewItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [savingImport, setSavingImport] = useState(false);

  // Race-condition guard: theo dõi request ID mới nhất cho mỗi row index khi fetch ĐVT
  const latestUnitsReqIdRef = useRef<Record<number, number>>({});

  useEffect(() => {
    if (vendorTaxCode) {
      fetchMappings();
    }
  }, [vendorTaxCode]);

  useEffect(() => {
    if (selectedProductId) {
      fetchProductUnits(selectedProductId);
    } else {
      setProductUnits([]);
    }
  }, [selectedProductId]);

  const fetchMappings = async () => {
    setLoading(true);
    try {
      const { data: mappings, error } = await supabase
        .from("vendor_product_mappings")
        .select(
          `
          *,
          products:internal_product_id(id, name, sku),
          product_units:internal_product_unit_id(id, unit_name)
        `
        )
        .eq("vendor_tax_code", vendorTaxCode)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setData((mappings as unknown as VendorMappingRow[]) ?? []);
    } catch (error: unknown) {
      message.error("Lỗi khi tải danh sách ánh xạ: " + getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchProductUnits = async (productId: number) => {
    setUnitsLoading(true);
    try {
      const { data: units, error } = await supabase
        .from("product_units")
        .select("id, unit_name, conversion_rate, unit_type")
        .eq("product_id", productId);

      if (error) throw error;
      setProductUnits((units as unknown as ProductUnitOption[]) ?? []);
    } catch (error: unknown) {
      message.error("Lỗi tải danh sách ĐVT: " + getErrorMessage(error));
    } finally {
      setUnitsLoading(false);
    }
  };

  // ----- EXPORT / IMPORT EXCEL -----
  const handleExportExcel = () => {
    if (!data || data.length === 0) {
      message.warning("Không có dữ liệu để xuất.");
      return;
    }
    const exportData = data.map((item) => ({
      "Tên Nhà Cung Cấp": vendorName || "NCC",
      "Mã số Thuế": item.vendor_tax_code,
      "Mã SKU NCC": item.supplier_sku || "",
      "Tên sản phẩm NCC": item.vendor_product_name || "",
      "Đơn vị tính NCC": item.vendor_unit || "",
      "Giá trước VAT": item.pre_vat_price || 0,
      "Thuế VAT": item.vat_of_supplier || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Anh_Xa_SP");
    XLSX.writeFile(wb, `Mapping_${vendorTaxCode}.xlsx`);
  };

  const handleImportExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      setIsImporting(true);
      try {
        const fileData = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(fileData, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonArray: ExcelImportRow[] =
          XLSX.utils.sheet_to_json<ExcelImportRow>(worksheet);

        const itemsForRpc: RpcItemPayload[] = jsonArray
          .map((row) => ({
            sku: row["Mã SKU NCC"] || row.supplier_sku || "",
            name: row["Tên sản phẩm NCC"] || row.vendor_product_name || "",
            unit: row["Đơn vị tính NCC"] || row.vendor_unit || "",
            quantity: 1,
            unit_price: Number(row["Giá trước VAT"] ?? row.pre_vat_price ?? 0),
            vat_of_supplier: Number(
              row["Thuế VAT"] ?? row.vat_of_supplier ?? 0
            ),
          }))
          .filter((item) => item.name); // Bỏ qua dòng trống tên

        if (itemsForRpc.length === 0) {
          message.warning("File Excel không có dữ liệu hợp lệ (Thiếu Tên SP).");
          setIsImporting(false);
          return;
        }

        if (!vendorId) {
          message.error(
            "Lỗi: Chưa có ID Nhà cung cấp (Vui lòng tải lại trang)."
          );
          setIsImporting(false);
          return;
        }

        message.loading({
          content: "AI đang phân tích và đối chiếu...",
          key: "ai_mapping",
        });

        // RPC chưa được khai báo trong generated types -> cast tạm thời qua unknown.
        // Sau khi `npm run typegen` được chạy, có thể đổi sang gọi trực tiếp.
        const rpcCall = supabase.rpc as unknown as (
          fn: string,
          args: { p_vendor_id: number; p_items: RpcItemPayload[] }
        ) => Promise<{
          data: RpcMappingResult[] | null;
          error: { message: string } | null;
        }>;
        const { data: rpcData, error } = await rpcCall(
          "map_scanned_invoice_products",
          {
            p_vendor_id: vendorId,
            p_items: itemsForRpc,
          }
        );

        if (error) throw error;

        const rpcArray: RpcMappingResult[] = rpcData ?? [];

        // Gom nhóm các ID SP để fetch ĐVT
        const matchedProductIds = Array.from(
          new Set(
            rpcArray
              .map((r) => r.internal_product_id)
              .filter((id): id is number => id != null)
          )
        );

        let unitsMap: Record<number, ProductUnitWithProductId[]> = {};
        if (matchedProductIds.length > 0) {
          const { data: unitsData } = await supabase
            .from("product_units")
            .select("id, product_id, unit_name")
            .in("product_id", matchedProductIds);

          if (unitsData) {
            unitsMap = (
              unitsData as unknown as ProductUnitWithProductId[]
            ).reduce<Record<number, ProductUnitWithProductId[]>>(
              (acc, curr) => {
                if (curr.product_id != null) {
                  if (!acc[curr.product_id]) acc[curr.product_id] = [];
                  acc[curr.product_id].push(curr);
                }
                return acc;
              },
              {}
            );
          }
        }

        // Tạo mảng hiển thị lên Review Table
        const mergedItems: ImportReviewItem[] = itemsForRpc.map(
          (orig, index) => {
            const mapped = rpcArray[index];
            const matchedId = mapped?.internal_product_id ?? null;
            return {
              key: index,
              supplier_sku: orig.sku,
              vendor_product_name: orig.name,
              vendor_unit: orig.unit,
              pre_vat_price: orig.unit_price,
              vat_of_supplier: orig.vat_of_supplier,
              internal_product_id: matchedId,
              internal_product_name: mapped?.internal_product_name ?? "",
              internal_product_unit_id:
                mapped?.internal_product_unit_id ?? null,
              match_method: mapped?.match_method ?? "Not Found",
              product_units:
                matchedId != null ? (unitsMap[matchedId] ?? []) : [],
            };
          }
        );

        message.success({
          content: "Đã phân tích xong!",
          key: "ai_mapping",
          duration: 2,
        });
        setImportedItems(mergedItems);
        setImportReviewMode(true);
      } catch (err: unknown) {
        message.error({
          content: "Lỗi xử lý file Excel: " + getErrorMessage(err),
          key: "ai_mapping",
        });
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // Chặn upload mặc định của Ant Design
  };

  const handleImportItemChange = <K extends keyof ImportReviewItem>(
    index: number,
    field: K,
    value: ImportReviewItem[K]
  ) => {
    setImportedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSaveImportedItems = async () => {
    // Validate
    const invalidItems = importedItems.filter(
      (i) => !i.internal_product_id || !i.internal_product_unit_id
    );
    if (invalidItems.length > 0) {
      message.error(
        `Còn ${invalidItems.length} sản phẩm chưa được chọn đúng Ánh xạ Nội bộ hoặc ĐVT!`
      );
      return;
    }

    setSavingImport(true);
    try {
      // Upsert: Dựa trên vendor_tax_code và (vendor_product_name hoặc supplier_sku)
      // Nhưng an toàn nhất là xóa mapping cũ và insert lại, HOẶC chỉ insert thông thường.
      // Vì hệ thống hiện tại vendor_product_mappings không có Unique constraint đặc thù,
      // dùng insert thẳng sẽ tạo bản ghi. Để tránh trùng lặp, ta có thể dùng bulk insert.

      const payload = importedItems.map((item) => ({
        vendor_tax_code: vendorTaxCode,
        vendor_product_name: item.vendor_product_name,
        supplier_sku: item.supplier_sku ?? null,
        vendor_unit: item.vendor_unit ?? null,
        internal_product_id: item.internal_product_id,
        internal_product_unit_id: item.internal_product_unit_id,
        pre_vat_price: item.pre_vat_price,
        vat_of_supplier: item.vat_of_supplier,
      }));

      // Generated types thiếu cột mở rộng (supplier_sku, internal_product_unit_id, ...)
      // → cast qua unknown để giữ type-safety phần còn lại. Khi chạy lại typegen,
      // có thể bỏ cast này.
      const { error } = await supabase
        .from("vendor_product_mappings")
        .insert(payload as unknown as never);
      if (error) throw error;

      message.success(`Đã lưu ${payload.length} ánh xạ thành công!`);
      setImportReviewMode(false);
      fetchMappings();
    } catch (err: unknown) {
      message.error("Lỗi khi lưu ánh xạ: " + getErrorMessage(err));
    } finally {
      setSavingImport(false);
    }
  };

  // ----- MODAL NORMAL MODE -----
  const handleOpenModal = (record?: VendorMappingRow) => {
    setIsModalVisible(true);
    if (record) {
      setEditingId(record.id);
      setSelectedProductId(record.internal_product_id ?? null);
      form.setFieldsValue({
        vendor_product_name: record.vendor_product_name,
        supplier_sku: record.supplier_sku,
        vendor_unit: record.vendor_unit,
        internal_product_id: record.internal_product_id,
        internal_product_unit_id: record.internal_product_unit_id,
        pre_vat_price: record.pre_vat_price,
        vat_of_supplier: record.vat_of_supplier,
      });
    } else {
      setEditingId(null);
      setSelectedProductId(null);
      form.resetFields();
    }
  };

  const handleCancelModal = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        vendor_tax_code: vendorTaxCode,
        vendor_product_name: values.vendor_product_name,
        supplier_sku: values.supplier_sku ?? null,
        vendor_unit: values.vendor_unit ?? null,
        internal_product_id: values.internal_product_id,
        internal_product_unit_id: values.internal_product_unit_id,
        pre_vat_price: values.pre_vat_price,
        vat_of_supplier: values.vat_of_supplier,
      };

      if (editingId) {
        const { error } = await supabase
          .from("vendor_product_mappings")
          .update(payload as unknown as never)
          .eq("id", editingId);
        if (error) throw error;
        message.success("Cập nhật ánh xạ thành công!");
      } else {
        const { error } = await supabase
          .from("vendor_product_mappings")
          .insert([payload] as unknown as never);
        if (error) throw error;
        message.success("Thêm mới ánh xạ thành công!");
      }

      setIsModalVisible(false);
      fetchMappings();
    } catch (error: unknown) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error("Lỗi khi lưu ánh xạ: " + getErrorMessage(error));
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const { error } = await supabase
        .from("vendor_product_mappings")
        .delete()
        .eq("id", id);
      if (error) throw error;
      message.success("Xóa ánh xạ thành công!");
      fetchMappings();
    } catch (error: unknown) {
      message.error("Lỗi khi xóa: " + getErrorMessage(error));
    }
  };

  // ----- COLUMNS -----
  const columns = [
    {
      title: "Mã SP (NCC)",
      dataIndex: "supplier_sku",
      key: "supplier_sku",
    },
    {
      title: "Tên Sản phẩm (NCC)",
      dataIndex: "vendor_product_name",
      key: "vendor_product_name",
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: "Giá chưa thuế",
      dataIndex: "pre_vat_price",
      key: "pre_vat_price",
      render: (val: number) =>
        val
          ? new Intl.NumberFormat("vi-VN", {
              style: "currency",
              currency: "VND",
            }).format(val)
          : "-",
    },
    {
      title: "% Thuế",
      dataIndex: "vat_of_supplier",
      key: "vat_of_supplier",
      render: (val: number) => (val ? `${val}%` : "-"),
    },
    {
      title: "Ánh xạ hệ thống",
      key: "internal_mapping",
      render: (_: unknown, record: VendorMappingRow) => (
        <div>
          <div>
            <Text type="secondary">SP:</Text> {record.products?.name}{" "}
            <Text type="secondary" style={{ fontSize: 12 }}>
              ({record.products?.sku})
            </Text>
          </div>
          <div>
            <Text type="secondary">ĐVT:</Text>{" "}
            {record.product_units?.unit_name || record.internal_unit || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      width: 120,
      render: (_: unknown, record: VendorMappingRow) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          />
          <Popconfirm
            title="Bạn có chắc muốn xóa ánh xạ này?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const importReviewColumns = [
    {
      title: "SP Nhà cung cấp",
      width: 250,
      render: (_: unknown, record: ImportReviewItem, index: number) => (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input
            placeholder="Mã SKU (tùy chọn)"
            value={record.supplier_sku}
            onChange={(e) =>
              handleImportItemChange(index, "supplier_sku", e.target.value)
            }
            style={{ width: "100%", fontSize: 12 }}
          />
          <Input
            placeholder="Tên Sản phẩm"
            value={record.vendor_product_name}
            onChange={(e) =>
              handleImportItemChange(
                index,
                "vendor_product_name",
                e.target.value
              )
            }
            style={{ width: "100%", fontWeight: "bold" }}
          />
        </Space>
      ),
    },
    {
      title: "ĐVT (NCC)",
      dataIndex: "vendor_unit",
      width: 100,
      render: (text: string, _record: ImportReviewItem, index: number) => (
        <Input
          value={text}
          onChange={(e) =>
            handleImportItemChange(index, "vendor_unit", e.target.value)
          }
        />
      ),
    },
    {
      title: "Giá / VAT (NCC)",
      width: 150,
      render: (_: unknown, record: ImportReviewItem, index: number) => (
        <Space direction="vertical" size="small" style={{ width: "100%" }}>
          <InputNumber
            placeholder="Giá gốc"
            value={record.pre_vat_price}
            onChange={(v) =>
              handleImportItemChange(index, "pre_vat_price", Number(v ?? 0))
            }
            formatter={(value) =>
              `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
            }
            style={{ width: "100%" }}
          />
          <InputNumber
            placeholder="% VAT"
            value={record.vat_of_supplier}
            onChange={(v) =>
              handleImportItemChange(index, "vat_of_supplier", Number(v ?? 0))
            }
            style={{ width: "100%" }}
          />
        </Space>
      ),
    },
    {
      title: "Chọn SP Nội bộ Nam Việt",
      dataIndex: "internal_product_id",
      width: 300,
      render: (
        productId: number | null,
        record: ImportReviewItem,
        index: number
      ) => (
        <DebounceProductSelect
          searchTypes={["product"]}
          value={productId}
          initialOptions={
            record.internal_product_id
              ? [
                  {
                    value: record.internal_product_id,
                    label: record.internal_product_name,
                  },
                ]
              : []
          }
          placeholder="Tìm theo tên/SKU..."
          style={{ width: "100%" }}
          onChange={async (
            val: number | null,
            opt: ProductSelectOption | null
          ) => {
            // Reset SP + ĐVT + units bằng functional setState (tránh stale closure khi
            // user gõ ô khác trong lúc await chạy).
            setImportedItems((prev) =>
              prev.map((it, i) =>
                i === index
                  ? {
                      ...it,
                      internal_product_id: val,
                      internal_product_name: opt?.product?.name ?? "",
                      internal_product_unit_id: null,
                      product_units: [],
                    }
                  : it
              )
            );
            if (!val) return;
            // Đánh dấu reqId mới nhất cho row này để bỏ qua response cũ (chống race
            // khi user đổi SP nhanh: response SP-A đến sau SP-B sẽ bị skip).
            const reqId = (latestUnitsReqIdRef.current[index] || 0) + 1;
            latestUnitsReqIdRef.current[index] = reqId;
            try {
              const { data: units, error } = await supabase
                .from("product_units")
                .select("id, product_id, unit_name")
                .eq("product_id", val);
              if (error) throw error;
              if (latestUnitsReqIdRef.current[index] !== reqId) return; // stale → bỏ qua
              setImportedItems((prev) =>
                prev.map((it, i) =>
                  i === index
                    ? {
                        ...it,
                        product_units:
                          (units as unknown as ProductUnitWithProductId[]) ??
                          [],
                      }
                    : it
                )
              );
            } catch (e: unknown) {
              if (latestUnitsReqIdRef.current[index] !== reqId) return;
              message.error("Lỗi tải ĐVT: " + getErrorMessage(e));
            }
          }}
        />
      ),
    },
    {
      title: "ĐVT Nội bộ",
      dataIndex: "internal_product_unit_id",
      width: 180,
      render: (
        unitId: number | null,
        record: ImportReviewItem,
        index: number
      ) => (
        <Select
          value={unitId}
          style={{ width: "100%" }}
          placeholder="Chọn ĐVT"
          disabled={!record.internal_product_id}
          onChange={(val) =>
            handleImportItemChange(index, "internal_product_unit_id", val)
          }
        >
          {record.product_units?.map((u: ProductUnitWithProductId) => (
            <Select.Option key={u.id} value={u.id}>
              {u.unit_name}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 100,
      render: (_: unknown, record: ImportReviewItem) => {
        if (record.internal_product_id && record.internal_product_unit_id) {
          return (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Đã khớp
            </Tag>
          );
        }
        if (record.internal_product_id && !record.internal_product_unit_id) {
          return <Tag color="warning">Thiếu ĐVT</Tag>;
        }
        return <Tag color="error">Chưa khớp</Tag>;
      },
    },
    {
      title: "",
      key: "action",
      width: 50,
      render: (_: unknown, _record: ImportReviewItem, index: number) => (
        <Button
          type="text"
          danger
          icon={<CloseCircleOutlined />}
          onClick={() => {
            const newItems = [...importedItems];
            newItems.splice(index, 1);
            setImportedItems(newItems);
          }}
        />
      ),
    },
  ];

  if (!vendorTaxCode) {
    return (
      <Text type="secondary">
        Vui lòng nhập Mã số thuế cho Nhà cung cấp này để có thể sử dụng tính
        năng Ánh xạ.
      </Text>
    );
  }

  return (
    <div>
      {!importReviewMode ? (
        // ----- CHẾ ĐỘ VIEW BÌNH THƯỜNG -----
        <>
          <div
            style={{
              marginBottom: 16,
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <Text type="secondary">
              Quản lý danh mục ánh xạ giúp hệ thống tự động điền Giá, Thuế và
              Đơn vị tính khi quét hóa đơn.
            </Text>
            <Space>
              <Upload
                accept=".xlsx, .xls"
                showUploadList={false}
                beforeUpload={handleImportExcel}
                disabled={isImporting}
              >
                <Button icon={<UploadOutlined />} loading={isImporting}>
                  Nhập Excel
                </Button>
              </Upload>
              <Button icon={<DownloadOutlined />} onClick={handleExportExcel}>
                Xuất Excel
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleOpenModal()}
              >
                Thêm Ánh xạ
              </Button>
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={data}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </>
      ) : (
        // ----- CHẾ ĐỘ REVIEW IMPORT EXCEL -----
        <div
          style={{
            background: "#fafafa",
            padding: 16,
            borderRadius: 8,
            border: "1px dashed #d9d9d9",
          }}
        >
          <Row
            justify="space-between"
            align="middle"
            style={{ marginBottom: 16 }}
          >
            <Col>
              <Title level={5} style={{ margin: 0, color: "#1890ff" }}>
                Đối chiếu Dữ liệu Import Excel
              </Title>
              <Text type="secondary">
                Vui lòng kiểm tra và đảm bảo tất cả sản phẩm đều đã được khớp
                nội bộ.
              </Text>
            </Col>
            <Col>
              <Space>
                <Button onClick={() => setImportReviewMode(false)}>
                  Hủy bỏ
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSaveImportedItems}
                  loading={savingImport}
                >
                  Lưu tất cả Ánh xạ (
                  {
                    importedItems.filter(
                      (i) => i.internal_product_id && i.internal_product_unit_id
                    ).length
                  }
                  /{importedItems.length})
                </Button>
              </Space>
            </Col>
          </Row>

          <Table
            columns={importReviewColumns}
            dataSource={importedItems}
            rowKey="key"
            pagination={false}
            size="small"
            scroll={{ x: 1100, y: 500 }}
          />
        </div>
      )}

      {/* ----- MODAL NẾU BẤM THÊM / SỬA LẺ ----- */}
      <Modal
        title={editingId ? "Cập nhật Ánh xạ" : "Thêm mới Ánh xạ"}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={handleCancelModal}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Typography.Title level={5}>
            1. Thông tin từ Nhà cung cấp
          </Typography.Title>
          <Space align="start" style={{ width: "100%" }}>
            <Form.Item name="supplier_sku" label="Mã SP (Supplier SKU)">
              <Input placeholder="Nhập mã SP..." />
            </Form.Item>
            <Form.Item
              name="vendor_product_name"
              label="Tên SP trên Hóa đơn"
              rules={[{ required: true, message: "Vui lòng nhập tên SP" }]}
              style={{ width: 300 }}
            >
              <Input placeholder="Tên SP in trên hóa đơn của NCC..." />
            </Form.Item>
            <Form.Item name="vendor_unit" label="ĐVT (NCC)">
              <Input placeholder="VD: Tube, Viên..." />
            </Form.Item>
          </Space>

          <Space align="start" style={{ width: "100%" }}>
            <Form.Item name="pre_vat_price" label="Giá chưa Thuế (Giá gốc)">
              <InputNumber
                style={{ width: 200 }}
                formatter={(value) =>
                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                }
                addonAfter="₫"
              />
            </Form.Item>
            <Form.Item name="vat_of_supplier" label="% Thuế VAT">
              <InputNumber style={{ width: 150 }} addonAfter="%" />
            </Form.Item>
          </Space>

          <Typography.Title level={5} style={{ marginTop: 16 }}>
            2. Ánh xạ vào Hệ thống nội bộ
          </Typography.Title>
          <Form.Item
            name="internal_product_id"
            label="Sản phẩm Nam Việt"
            rules={[
              { required: true, message: "Vui lòng chọn sản phẩm nội bộ" },
            ]}
          >
            <DebounceProductSelect
              placeholder="Tìm theo tên hoặc SKU..."
              searchTypes={["product"]}
              onChange={(val: number | null) => {
                setSelectedProductId(val);
                form.setFieldsValue({ internal_product_unit_id: null });
              }}
            />
          </Form.Item>

          <Form.Item
            name="internal_product_unit_id"
            label="Đơn vị tính quy đổi"
            rules={[{ required: true, message: "Vui lòng chọn ĐVT" }]}
          >
            <Select
              placeholder="Chọn đơn vị tính tương ứng"
              loading={unitsLoading}
              disabled={!selectedProductId}
            >
              {productUnits.map((u) => (
                <Select.Option key={u.id} value={u.id}>
                  {u.unit_name} (Quy đổi: {u.conversion_rate})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SupplierProductMappingTab;
