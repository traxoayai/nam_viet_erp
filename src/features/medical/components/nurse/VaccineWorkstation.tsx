import { Alert, Button, Checkbox, Tag, Empty } from "antd";
import { CheckCircle, XCircle } from "lucide-react";
import React, { useState, useEffect } from "react";

import { ScannerListener } from "@/shared/ui/warehouse-tools/ScannerListener";

interface Vaccine {
  record_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  barcode: string;
  dose_number: number;
  status: string;
}

interface VaccineWorkstationProps {
  vaccines: Vaccine[];
  onConfirm: (scannedProductIds: number[]) => void;
  isConfirming: boolean;
}

export const VaccineWorkstation: React.FC<VaccineWorkstationProps> = ({
  vaccines,
  onConfirm,
  isConfirming,
}) => {
  const [scannedProductIds, setScannedProductIds] = useState<number[]>([]);
  const [agreedMatch, setAgreedMatch] = useState(false);
  const [agreedRoute, setAgreedRoute] = useState(false);
  
  const [scanErrorStr, setScanErrorStr] = useState<string | null>(null);

  // Clear state when receiving new vaccines array
  useEffect(() => {
    setScannedProductIds([]);
    setAgreedMatch(false);
    setAgreedRoute(false);
    setScanErrorStr(null);
  }, [vaccines]);

  const handleScan = (code: string) => {
    setScanErrorStr(null);
    const codeLower = code.toLowerCase().trim();
    // Compare code with barcodes or skus
    const matchedVaccine = vaccines.find(
      (v) =>
        (v.barcode && v.barcode.toLowerCase() === codeLower) ||
        (v.sku && v.sku.toLowerCase() === codeLower)
    );

    if (matchedVaccine) {
      if (!scannedProductIds.includes(matchedVaccine.product_id)) {
        setScannedProductIds((prev) => [...prev, matchedVaccine.product_id]);
        
        // Phát tiếng bíp thành công (beep âm thanh nhẹ)
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // high pitch
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      }
    } else {
      setScanErrorStr(`Mã vạch ${code} không khớp với bất kỳ thuốc nào trong chỉ định!`);
      // Phát tiếng bíp cảnh báo (sai thuốc)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(200, audioCtx.currentTime); // low pitch
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    }
  };

  const isAllScanned =
    vaccines.length > 0 && scannedProductIds.length === vaccines.length;
  const canConfirm = isAllScanned && agreedMatch && agreedRoute;

  if (vaccines.length === 0) {
    return <Empty description="Không có mũi tiêm nào chờ thực hiện" />;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-6">
      <ScannerListener onScan={handleScan} enabled={true} />

      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          DANH SÁCH THUỐC CẦN TIÊM 
        </h3>
        
        {scanErrorStr && (
          <Alert message="SAI THUỐC CRITICAL ALERT" description={scanErrorStr} type="error" showIcon className="mb-4 font-bold border-red-500 animate-pulse" />
        )}

        <div className="flex flex-col gap-3">
          {vaccines.map((v) => {
            const isScanned = scannedProductIds.includes(v.product_id);
            return (
              <div
                key={v.record_id}
                className={`flex justify-between items-center p-3 rounded-lg border ${
                  isScanned
                    ? "border-green-300 bg-green-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div>
                  <div className="font-bold text-gray-900">{v.product_name}</div>
                  <div className="text-xs text-gray-500">
                    Mã: {v.sku} | Barcode: {v.barcode || "N/A"} | Mũi số:{" "}
                    {v.dose_number}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isScanned ? (
                    <Tag color="success" icon={<CheckCircle size={14} className="mr-1 inline" />}>ĐÃ XÉT DUYỆT</Tag>
                  ) : (
                    <Tag color="error" icon={<XCircle size={14} className="mr-1 inline" />}>CHƯA QUÉT MÃ</Tag>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 flex flex-col gap-3">
        <h4 className="font-bold text-orange-800 mb-1">
          LÁ CHẮN PHÁP LÝ (BẮT BUỘC CHECK)
        </h4>
        <Checkbox
          checked={agreedMatch}
          onChange={(e) => setAgreedMatch(e.target.checked)}
          className="font-medium text-gray-800"
        >
          Tôi đã đối chiếu Tên thuốc, Số Lô, Hạn Sử Dụng với Phụ huynh / Khách hàng.
        </Checkbox>
        <Checkbox
          checked={agreedRoute}
          onChange={(e) => setAgreedRoute(e.target.checked)}
          className="font-medium text-gray-800"
        >
          Tôi đã kiểm tra đúng đường tiêm/uống cho từng loại thuốc trên.
        </Checkbox>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <Button
          type="primary"
          size="large"
          className="font-bold"
          style={{
            backgroundColor: canConfirm ? "#52c41a" : undefined,
            width: "100%",
            height: "50px",
            fontSize: "16px"
          }}
          disabled={!canConfirm}
          loading={isConfirming}
          onClick={() => onConfirm(scannedProductIds)}
        >
          {canConfirm ? "XÁC NHẬN ĐÃ TIÊM & TRỪ KHO" : "HÃY QUÉT TẤT CẢ VẮC-XIN VÀ CHECK PHÁP LÝ"}
        </Button>
      </div>
    </div>
  );
};
