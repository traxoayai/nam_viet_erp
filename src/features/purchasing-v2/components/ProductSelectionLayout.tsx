import { DeleteOutlined } from "@ant-design/icons";
import {
  Row,
  Col,
  Card,
  Table,
  Typography,
  Select,
  InputNumber,
  Button,
  Space,
  message,
  Spin,
  Image,
} from "antd";
import React, { useState, useRef } from "react";

import { supabase } from "@/shared/lib/supabaseClient";

const { Text } = Typography;

interface ProductSelectionLayoutProps {
  onTotalChange: (amount: number) => void;
}

export const ProductSelectionLayout: React.FC<ProductSelectionLayoutProps> = ({
  onTotalChange,
}) => {
  const [mainProducts, setMainProducts] = useState<any[]>([]);
  const [giftProducts, setGiftProducts] = useState<any[]>([]);

  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const timeoutRef = useRef<any>(null);

  const fetchProducts = async (value: string) => {
    if (!value) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "search-products-po",
        {
          body: { searchTerm: value },
        }
      );
      if (error) throw error;
      setSearchResults(data?.data || []);
    } catch (err: any) {
      message.error("Lỗi tìm kiếm sản phẩm: " + err.message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearch = (newValue: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      fetchProducts(newValue);
    }, 500);
  };

  const handleAddMainProduct = (productId: number) => {
    const product = searchResults.find((p) => p.id === productId);
    if (!product) return;

    if (mainProducts.find((p) => p.id === productId)) {
      message.warning("Sản phẩm này đã được thêm vào danh sách mua!");
      return;
    }

    const defaultQty = Math.max(
      0,
      (product.max_stock || 0) - (product.stock_quantity || 0)
    );
    const price = product.wholesale_unit?.price_cost || 0;

    const newProduct = {
      ...product,
      quantity: defaultQty || 1, // Đề xuất tối thiểu 1 nếu kho đã đầy
      price: price,
      total: (defaultQty || 1) * price,
    };

    const newProducts = [...mainProducts, newProduct];
    setMainProducts(newProducts);
    calculateTotal(newProducts);
  };

  const handleAddGiftProduct = (productId: number) => {
    const product = searchResults.find((p) => p.id === productId);
    if (!product) return;

    if (giftProducts.find((p) => p.id === productId)) {
      message.warning("Sản phẩm này đã có trong danh sách quà tặng!");
      return;
    }

    const newProduct = {
      ...product,
      quantity: 1,
      price: 0,
      total: 0,
    };

    setGiftProducts([...giftProducts, newProduct]);
  };

  const calculateTotal = (products: any[]) => {
    const total = products.reduce((sum, item) => sum + (item.total || 0), 0);
    onTotalChange(total);
  };

  const updateMainProduct = (id: number, field: string, value: number) => {
    const newProducts = mainProducts.map((p) => {
      if (p.id === id) {
        const updated = { ...p, [field]: value };
        updated.total = updated.quantity * updated.price;
        return updated;
      }
      return p;
    });
    setMainProducts(newProducts);
    calculateTotal(newProducts);
  };

  const removeMainProduct = (id: number) => {
    const newProducts = mainProducts.filter((p) => p.id !== id);
    setMainProducts(newProducts);
    calculateTotal(newProducts);
  };

  const updateGiftProduct = (id: number, value: number) => {
    const newProducts = giftProducts.map((p) => {
      if (p.id === id) {
        return { ...p, quantity: value };
      }
      return p;
    });
    setGiftProducts(newProducts);
  };

  const removeGiftProduct = (id: number) => {
    setGiftProducts(giftProducts.filter((p) => p.id !== id));
  };

  const mainColumns = [
    {
      title: "Sản phẩm",
      key: "product",
      width: "40%",
      render: (_: any, record: any) => (
        <Space>
          {record.image_url ? (
            <Image
              src={record.image_url}
              width={80}
              height={80}
              style={{ objectFit: "contain" }}
            />
          ) : null}
          <div>
            <Text strong>{record.name}</Text>
            <div style={{ fontSize: "12px", color: "#888" }}>
              SKU: {record.sku || "N/A"}
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: "Tồn / Bán TB",
      key: "stock",
      render: (_: any, record: any) => (
        <div>
          <div>
            Tồn:{" "}
            <Text
              strong
              color={
                record.stock_quantity < record.max_stock / 2 ? "red" : "green"
              }
            >
              {record.stock_quantity}
            </Text>{" "}
            / {record.max_stock}
          </div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            Bán TB: {record.formatted_monthly_sales_qty ? record.formatted_monthly_sales_qty : record.monthly_sales_qty}/tháng
          </div>
        </div>
      ),
    },
    {
      title: "SL Cần Mua",
      key: "quantity",
      render: (_: any, record: any) => (
        <Space direction="vertical" size={2}>
          <InputNumber
            min={1}
            value={record.quantity}
            onChange={(val) =>
              updateMainProduct(record.id, "quantity", val || 0)
            }
            style={{ width: 60 }}
          />
          <Text type="secondary" style={{ fontSize: "11px" }}>
            {record.wholesale_unit?.unit_name || "Cái"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Đơn giá",
      key: "price",
      render: (_: any, record: any) => (
        <InputNumber
          min={0}
          value={record.price}
          onChange={(val) => updateMainProduct(record.id, "price", val || 0)}
          style={{ width: 90 }}
          formatter={(value) =>
            `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
          }
        />
      ),
    },
    {
      title: "Thành Tiền",
      key: "total",
      render: (_: any, record: any) => (
        <Text strong style={{ color: "#1890ff" }}>
          {new Intl.NumberFormat("vi-VN").format(record.total)} đ
        </Text>
      ),
    },
    {
      title: "",
      key: "action",
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeMainProduct(record.id)}
        />
      ),
    },
  ];

  const giftColumns = [
    {
      title: "Sản phẩm",
      key: "product",
      width: "60%",
      render: (_: any, record: any) => (
        <div>
          <Text strong>{record.name}</Text>
          <div style={{ fontSize: "12px", color: "#888" }}>
            {record.wholesale_unit?.unit_name || "Cái"}
          </div>
        </div>
      ),
    },
    {
      title: "SL",
      key: "quantity",
      render: (_: any, record: any) => (
        <InputNumber
          min={1}
          value={record.quantity}
          onChange={(val) => updateGiftProduct(record.id, val || 0)}
          style={{ width: 70 }}
        />
      ),
    },
    {
      title: "Giá trị",
      key: "price",
      render: () => <Text type="secondary">0 đ</Text>,
    },
    {
      title: "",
      key: "action",
      render: (_: any, record: any) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeGiftProduct(record.id)}
        />
      ),
    },
  ];

  return (
    <Row gutter={16} style={{ marginTop: 16, flex: 1 }}>
      <Col span={15}>
        <Card title="Sản phẩm Nhập Mua" size="small" style={{ height: "100%" }}>
          <Select
            showSearch
            placeholder="Tìm kiếm và chọn sản phẩm..."
            style={{ width: "100%", marginBottom: 16 }}
            defaultActiveFirstOption={false}
            filterOption={false}
            onSearch={handleSearch}
            onChange={handleAddMainProduct}
            notFoundContent={searchLoading ? <Spin size="small" /> : null}
            value={null} // auto clear after selection
          >
            {searchResults.map((d) => (
              <Select.Option key={d.id} value={d.id}>
                {d.name} {d.sku ? `(${d.sku})` : ""} - Tồn: {d.stock_quantity}/
                {d.max_stock}
              </Select.Option>
            ))}
          </Select>

          <Table
            columns={mainColumns}
            dataSource={mainProducts}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ y: 400 }}
          />
        </Card>
      </Col>

      <Col span={9}>
        <Card
          title="Sản phẩm Tặng Kèm / Quà"
          size="small"
          style={{ height: "100%" }}
        >
          <Select
            showSearch
            placeholder="Tìm kiếm quà tặng..."
            style={{ width: "100%", marginBottom: 16 }}
            defaultActiveFirstOption={false}
            filterOption={false}
            onSearch={handleSearch}
            onChange={handleAddGiftProduct}
            notFoundContent={searchLoading ? <Spin size="small" /> : null}
            value={null}
          >
            {searchResults.map((d) => (
              <Select.Option key={d.id} value={d.id}>
                {d.name} {d.sku ? `(${d.sku})` : ""}
              </Select.Option>
            ))}
          </Select>

          <Table
            columns={giftColumns}
            dataSource={giftProducts}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ y: 400 }}
          />
        </Card>
      </Col>
    </Row>
  );
};
