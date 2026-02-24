import { OutboundOrderInfo } from "@/features/inventory/types/outbound";

interface ShippingLabelProps {
  orderInfo: OutboundOrderInfo | null;
  packageCount: number; // Tổng số kiện (ví dụ 3)
}

export const ShippingLabelTemplate = ({
  orderInfo,
  packageCount,
}: ShippingLabelProps) => {
  if (!orderInfo) return null;

  // Tạo mảng số kiện: [1, 2, 3]
  const packages = Array.from({ length: packageCount }, (_, i) => i + 1);

  return (
    <div className="shipping-label-source">
      <style>{`
        .shipping-label-source { display: none; }
        @media print {
          body * { visibility: hidden; }
          .shipping-label-source, .shipping-label-source * { visibility: visible; }
          .shipping-label-source {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
          }
          .label-page {
            width: 100mm; /* Khổ A6 hoặc giấy in nhiệt */
            height: 150mm;
            border: 1px dashed #000;
            padding: 10px;
            margin-bottom: 10px;
            page-break-after: always;
            box-sizing: border-box;
            font-family: Arial, sans-serif;
            position: relative;
          }
          .label-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
          .big-code { font-size: 24px; font-weight: bold; }
          .row { display: flex; margin-bottom: 8px; }
          .label { width: 80px; font-weight: bold; }
          .value { flex: 1; }
          .package-badge {
             position: absolute; bottom: 20px; right: 20px;
             border: 2px solid #000; padding: 5px 15px;
             font-size: 20px; font-weight: bold;
             border-radius: 4px;
          }
        }
      `}</style>

      {packages.map((pkgNum) => (
        <div key={pkgNum} className="label-page">
          <div className="label-header">
            <div style={{ fontSize: 14 }}>PHIẾU GIAO HÀNG</div>
            <div className="big-code">{orderInfo.code}</div>
            <div>{new Date().toLocaleDateString("vi-VN")}</div>
          </div>

          <div className="row">
            <div className="label">ĐVVC:</div>
            <div className="value" style={{ fontWeight: "bold", fontSize: 16 }}>
              {orderInfo.shipping_partner}
            </div>
          </div>

          <div
            className="row"
            style={{
              marginTop: 10,
              borderTop: "1px solid #ccc",
              paddingTop: 10,
            }}
          >
            <div className="label">Người nhận:</div>
            <div className="value">
              <b>{orderInfo.customer_name}</b>
              <div style={{ fontSize: 12 }}>{orderInfo.delivery_address}</div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <div className="label">Ghi chú:</div>
            <div className="value">{orderInfo.note || "Cho xem hàng"}</div>
          </div>

          <div className="package-badge">
            Kiện {pkgNum}/{packageCount}
          </div>

          <div
            style={{ position: "absolute", bottom: 10, left: 10, fontSize: 10 }}
          >
            Powered by Nam Viet ERP
          </div>
        </div>
      ))}
    </div>
  );
};
