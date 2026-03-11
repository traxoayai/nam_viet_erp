// src/features/inventory/components/print/ShippingLabelTemplate.tsx
import { OutboundOrderInfo } from "@/features/inventory/types/outbound";

interface ShippingLabelProps {
  orderInfo: OutboundOrderInfo | null;
  packageCount: number;
}

// Hàm hỗ trợ format SĐT (VD: 0366869198 -> 0366.869.198)
const formatPhone = (phone?: string) => {
  if (!phone) return "Không có SĐT";
  const cleaned = ("" + phone).replace(/\D/g, "");
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `${cleaned.slice(0, 4)}.${cleaned.slice(4, 7)}.${cleaned.slice(7)}`;
  }
  return phone; // Trả về nguyên gốc nếu không chuẩn pattern
};

export const ShippingLabelTemplate = ({
  orderInfo,
  packageCount,
}: ShippingLabelProps) => {
  if (!orderInfo) return null;

  const packages = Array.from({ length: packageCount || 1 }, (_, i) => i + 1);
  
  // Tính tiền COD (Tiền cần thu)
  const finalAmount = orderInfo.final_amount || 0;
  const paidAmount = orderInfo.paid_amount || 0;
  const codAmount = finalAmount - paidAmount;
  const displayPhone = formatPhone(orderInfo.shipping_phone || orderInfo.customer_phone);

  return (
    <div className="shipping-label-source">
      <style>{`
        .shipping-label-source { display: none; }
        @media print {
          /* QUAN TRỌNG: Phá vỡ tối đa giới hạn của thẻ bọc chứa để trị lỗi trắng trang 2 của Ant Design */
          html, body, #root, .ant-layout, .ant-layout-content, .ant-app { 
            height: auto !important; 
            min-height: auto !important;
            overflow: visible !important; 
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * { visibility: hidden; }
          .shipping-label-source, .shipping-label-source * { visibility: visible; }
          
          .shipping-label-source {
            display: block !important;
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
          }
          
          .label-page {
            width: 100mm; 
            height: 150mm;
            border: 2px dashed #000;
            padding: 15px;
            margin-bottom: 20px;
            page-break-after: always;
            break-after: page;
            box-sizing: border-box;
            font-family: Arial, sans-serif;
            position: relative;
            background: white;
          }
          .label-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
          .big-code { font-size: 26px; font-weight: 900; margin: 5px 0; }
          .row { display: flex; margin-bottom: 10px; font-size: 14px; }
          .label { width: 85px; font-weight: bold; }
          .value { flex: 1; }
          
          .cod-box {
             margin-top: 15px;
             padding: 10px;
             border: 2px solid #000;
             text-align: center;
             background-color: #f0f0f0 !important;
             -webkit-print-color-adjust: exact;
          }
          .cod-title { font-weight: bold; font-size: 14px; }
          .cod-amount { font-size: 24px; font-weight: 900; margin-top: 5px; }

          .package-badge {
             position: absolute; bottom: 15px; right: 15px;
             border: 2px solid #000; padding: 5px 15px;
             font-size: 20px; font-weight: bold;
             border-radius: 4px;
          }
        }
      `}</style>

      {packages.map((pkgNum) => (
        <div key={pkgNum} className="label-page">
          <div className="label-header">
            <div style={{ fontSize: 16, fontWeight: "bold" }}>PHIẾU GIAO HÀNG</div>
            <div className="big-code">{orderInfo.code}</div>
            <div style={{ fontSize: 12 }}>Ngày in: {new Date().toLocaleDateString("vi-VN")}</div>
          </div>

          <div className="row">
            <div className="label">ĐVVC:</div>
            <div className="value" style={{ fontWeight: "bold", fontSize: 16, textTransform: "uppercase" }}>
              {orderInfo.shipping_partner || "Tự vận chuyển"}
            </div>
          </div>

          <div className="row" style={{ marginTop: 15, borderTop: "1px solid #ccc", paddingTop: 15 }}>
            <div className="label">Người nhận: </div>
            <div className="value">
              <b style={{ fontSize: 16 }}>{orderInfo.customer_name}</b>
              <div style={{ fontSize: 14, fontWeight: "bold", marginTop: 4 }}>SĐT: {displayPhone}</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{orderInfo.delivery_address}</div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 15 }}>
            <div className="label">Ghi chú:</div>
            <div className="value" style={{ fontStyle: "italic" }}>
              {orderInfo.note || "Cho xem hàng, không đồng kiểm"}
            </div>
          </div>

          <div className="cod-box">
             <div className="cod-title">TIỀN THU HỘ (COD)</div>
             <div className="cod-amount">
                {codAmount > 0 ? codAmount.toLocaleString("vi-VN") + " ₫" : "0 ₫ (Đã thanh toán)"}
             </div>
          </div>

          <div className="package-badge">
            Kiện {pkgNum}/{packageCount || 1}
          </div>

          <div style={{ position: "absolute", bottom: 15, left: 15, fontSize: 11, color: "#666" }}>
            Powered by Nam Viet ERP
          </div>
        </div>
      ))}
    </div>
  );
};
