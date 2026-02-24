import { InboundDetailItem } from "@/features/inventory/types/inbound";

interface PutawayListTemplateProps {
  items: InboundDetailItem[];
  poCode?: string;
}

export const PutawayListTemplate = ({
  items,
  poCode,
}: PutawayListTemplateProps) => {
  return (
    <div className="print-putaway-source">
      {/* Styles for print only */}
      <style>{`
        .print-putaway-source { display: none; }
        @media print {
          body * { visibility: hidden; }
          .print-putaway-source, .print-putaway-source * { visibility: visible; }
          .print-putaway-source {
            display: block !important;
            position: absolute; left: 0; top: 0; width: 100%;
            background: white;
            padding: 20px;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f0f0f0; text-align: center; font-weight: bold; }
          .text-center { text-align: center; }
        }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>PHIẾU XẾP KỆ (PUTAWAY LIST)</h2>
        <p>
          Mã Phiếu: <b>{poCode || "Unknown"}</b> - Ngày in:{" "}
          {new Date().toLocaleString("vi-VN")}
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: 40 }}>STT</th>
            <th style={{ width: 120 }}>Mã SKU</th>
            <th>Tên Sản Phẩm</th>
            <th style={{ width: 60 }}>ĐVT</th>
            <th style={{ width: 80 }}>SL Nhập</th>
            <th style={{ width: 120 }}>Vị Trí Mục Tiêu</th>
            <th style={{ width: 150 }}>Lô / Hạn dùng</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td className="text-center">{index + 1}</td>
              <td>{item.sku}</td>
              <td>{item.product_name}</td>
              <td className="text-center">{item.unit}</td>
              <td className="text-center">
                <b>{item.input_quantity || item.quantity_remaining}</b>
              </td>
              <td></td> {/* Empty box for writing location */}
              <td>
                {item.stock_management_type === "lot_date" ? (
                  <div>
                    Lô: {item.input_lot || ".........."}
                    <br />
                    Hạn:{" "}
                    {item.input_expiry
                      ? new Date(item.input_expiry).toLocaleDateString()
                      : ".........."}
                  </div>
                ) : (
                  "-"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 40,
          display: "flex",
          justifyContent: "space-between",
          padding: "0 50px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <b>Người lập phiếu</b>
          <br />
          <br />
          <br />
        </div>
        <div style={{ textAlign: "center" }}>
          <b>Nhân viên kho</b>
          <br />
          <br />
          <br />
        </div>
      </div>
    </div>
  );
};
