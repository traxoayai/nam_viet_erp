import { useState } from "react";
import { Grid, Card, Space, Button } from "antd";
import { ScanBarcode } from "lucide-react";

import { ScannerListener } from "./ScannerListener";
import { VoiceCommander } from "./VoiceCommander";
import { AIVisionCamera } from "./AIVisionCamera";

const { useBreakpoint } = Grid;

interface WarehouseToolBarProps {
  onScan: (code: string) => void;
  onVoice?: (text: string) => void;
  onAICamResult?: (data: any) => void;
  
  // Tuỳ chọn
  enableScanner?: boolean;
  enableVoice?: boolean;
  enableAICam?: boolean;
}

export const WarehouseToolBar = ({
  onScan,
  onVoice,
  onAICamResult,
  enableScanner = true,
  enableVoice = true,
  enableAICam = true,
}: WarehouseToolBarProps) => {
  const screens = useBreakpoint();
  const [camVisible, setCamVisible] = useState(false);

  // 1. Wrapper Styles (Mobile vs Desktop)
  const containerStyle: React.CSSProperties = screens.md
    ? {
        // Desktop: Static block
        marginBottom: 16,
      }
    : {
        // Mobile: Fixed Bottom
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "12px 16px",
        background: "#fff",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      };

  return (
    <>
      {/* 2. Headless Scanner Listener (Luôn active nếu enabled) */}
      <ScannerListener onScan={onScan} enabled={enableScanner} />

      {/* 3. AI Camera Modal (Chỉ render nếu cần) */}
      {enableAICam && onAICamResult && (
        <AIVisionCamera
          visible={camVisible}
          onClose={() => setCamVisible(false)}
          onResult={onAICamResult}
        />
      )}

      {/* 4. Toolbar UI */}
      {screens.md ? (
        // DESKTOP: Render như một Card nhỏ gọn
        <Card size="small" bodyStyle={{ padding: "8px 16px" }} style={containerStyle}>
           <Space size="large">
              {enableVoice && onVoice && (
                 <Space>
                    <VoiceCommander onCommand={onVoice} />
                    <span>Ra lệnh giọng nói</span>
                 </Space>
              )}
              
              {enableAICam && (
                 <Button 
                    icon={<ScanBarcode size={18} />} 
                    onClick={() => setCamVisible(true)}
                 >
                    Mở AI Camera
                 </Button>
              )}
           </Space>
        </Card>
      ) : (
        // MOBILE: Render Fixed Footer
        <div style={containerStyle}>
           <div style={{ fontWeight: 500, color: "#666" }}>Smart Tools:</div>
           
           <Space size="middle">
              {enableVoice && onVoice && <VoiceCommander onCommand={onVoice} />}
              
              {enableAICam && (
                 <Button 
                    type="primary"
                    shape="circle"
                    size="large"
                    icon={<ScanBarcode size={24} />}
                    onClick={() => setCamVisible(true)}
                 />
              )}
           </Space>
        </div>
      )}
    </>
  );
};
