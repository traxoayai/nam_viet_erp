import { OutboundOrderInfo, OutboundPickItem } from "@/features/inventory/types/outbound";

interface PickingListTemplateProps {
  orderInfo: OutboundOrderInfo | null;
  items: OutboundPickItem[];
}

export const PickingListTemplate = ({ orderInfo, items }: PickingListTemplateProps) => {
  if (!orderInfo) return null;

  const sortedItems = [...items].sort((a, b) => 
     (a.shelf_location || "").localeCompare(b.shelf_location || "")
  );

  return (
    <div className="print-source" style={{ fontFamily: 'Arial, sans-serif', color: '#000', lineHeight: 1.4 }}>
      {/* CSS cho in ấn */}
      <style>{`
        .print-source { display: none; }
        @media print {
          body * { visibility: hidden; }
          .print-source, .print-source * { visibility: visible; }
          .print-source {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
            padding: 20px; background: white;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f0f0f0; font-weight: bold; text-align: center; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, textTransform: "uppercase" }}>PHIẾU NHẶT HÀNG</h2>
        <div style={{ fontStyle: "italic", fontSize: 12 }}>(Picking List)</div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15, fontSize: 13 }}>
        <div>
           <div>Mã đơn: <b>{orderInfo.code}</b></div>
           <div>Khách hàng: <b>{orderInfo.customer_name}</b></div>
           <div>Ngày tạo: {new Date().toLocaleDateString("vi-VN")}</div>
        </div>
        <div style={{ textAlign: "right" }}>
           <div>Vận chuyển: <b>{orderInfo.shipping_partner}</b></div>
           <div>SĐT: {orderInfo.shipping_phone || "-"}</div>
           <div>Giờ Cut-off: {orderInfo.cutoff_time}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 40 }}>STT</th>
            <th style={{ width: 80 }}>Vị trí</th>
            <th style={{ width: 100 }}>SKU</th>
            <th>Tên Sản Phẩm</th>
            <th style={{ width: 60 }}>ĐVT</th>
            <th style={{ width: 60 }}>SL Yêu cầu</th>
            <th style={{ width: 80 }}>Thực nhặt</th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item, idx) => (
            <tr key={item.product_id}>
              <td className="text-center">{idx + 1}</td>
              <td className="text-center">
                {item.shelf_location || "-"}
                {item.fefo_suggestion && (
                    <div style={{fontSize: 10, fontStyle: 'italic'}}>(Lô: {item.fefo_suggestion.batch_code})</div>
                )}
              </td>
              <td>{item.sku}</td>
              <td>{item.product_name}</td>
              <td className="text-center">{item.unit}</td>
              <td className="text-center"><b>{item.quantity_ordered}</b></td>
              <td></td> {/* Ô trống để tích */}
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 40, display: "flex", justifyContent: "space-between", textAlign: "center" }}>
        <div style={{ width: "40%" }}>
            <b>Người lập phiếu</b>
            <br /><br /><br /><br />
            <span>.......................................</span>
        </div>
        <div style={{ width: "40%" }}>
            <b>Nhân viên nhặt hàng</b>
            <br /><br /><br /><br />
            <span>.......................................</span>
        </div>
      </div>
    </div>
  );
};