// src/pages/medical/NurseExecutionPage.tsx
import { message, Tabs, Select, DatePicker, Tag, Empty, Button, Statistic, Spin } from "antd";
import dayjs from "dayjs";
import { Syringe, User, Stethoscope, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import { useEffect, useState } from "react";

import { nurseService } from "@/features/medical/api/nurseService";
import { VaccineWorkstation } from "@/features/medical/components/nurse/VaccineWorkstation";
import { supabase } from "@/shared/lib/supabaseClient";

// Simple Countdown Component for Observing
const ObservingCountdown = ({ startTime }: { startTime?: string }) => {
  // Assuming observation is 30 mins
  const obsTime = startTime ? dayjs(startTime).add(30, 'minute').valueOf() : dayjs().add(30, 'minute').valueOf();
  const [complete, setComplete] = useState(Date.now() >= obsTime);

  return (
    <div className={`mt-2 p-2 rounded text-center font-bold ${complete ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-blue-50 text-blue-600'}`}>
      {complete ? (
        <span className="flex items-center justify-center gap-1"><CheckCircle size={16} /> ĐÃ ĐẾN GIỜ RA VỀ</span>
      ) : (
        <Statistic.Countdown value={obsTime} format="mm:ss" onFinish={() => setComplete(true)} valueStyle={{ fontSize: 14, color: '#2563eb', fontWeight: 'bold' }} />
      )}
    </div>
  );
};

export default function NurseExecutionPage() {
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  // Filters
  const [filterDate, setFilterDate] = useState(dayjs());
  const [activeTab, setActiveTab] = useState("waiting"); // 'waiting' or 'observing'
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all"); // 'all', 'vaccination', 'examination'
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number>(2); // Tạm fix 2 (Kho/Tủ lạnh phòng tiêm)

  useEffect(() => {
    fetchData();

    // Lắng nghe realtime từ bảng appointments và clinical_queues
    const channel = supabase
      .channel("nurse_live_queue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments" },
        () => fetchData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clinical_queues" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filterDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const dateStr = filterDate.format("YYYY-MM-DD");
      const data = await nurseService.getNurseExecutionQueue(dateStr);
      setQueue(data);
      
      // Auto-select first if none selected
      if (!selectedPatientId && data.length > 0) {
        // setSelectedPatientId(data[0].customer_id);
      }
    } catch (err: any) {
      console.error(err);
      message.error("Lỗi lấy danh sách hàng đợi Y tá: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmVaccination = async (scannedProductIds: number[], patient: any) => {
    if (!selectedWarehouseId) {
      return message.error("Vui lòng chọn Tủ lạnh / Kho thuốc trước khi tiêm!");
    }
    
    try {
      await nurseService.executeVaccinationCombo(
        patient.appointment_id,
        patient.customer_id,
        scannedProductIds,
        selectedWarehouseId,
        undefined
      );
      
      message.success("Đã xác nhận tiêm và trừ kho thành công!");
      setSelectedPatientId(null);
      fetchData(); // Reload queue
      
    } catch (e: any) {
      message.error("Lỗi xác nhận tiêm: " + e.message);
    }
  };

  // Lọc dữ liệu hiển thị trên cột trái
  const displayedQueue = queue.filter(item => {
    // Lọc theo Tab Cột trái
    const isObserving = item.status === 'observing';
    if (activeTab === 'waiting' && isObserving) return false;
    if (activeTab === 'observing' && !isObserving) return false;
    
    // Lọc theo Loại Dịch Vụ
    if (serviceTypeFilter === 'vaccination' && item.service_type !== 'vaccination') return false;
    if (serviceTypeFilter === 'examination' && item.service_type === 'vaccination') return false; // Thử thuật thường là mảng khác vaccination
    
    return true;
  });

  const selectedPatient = queue.find(q => q.customer_id === selectedPatientId);

  return (
    <div className="flex flex-col h-screen bg-white text-slate-800 font-sans overflow-hidden">
      {/* HEADER TÁC CHIẾN ĐIỀU DƯỠNG */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 flex flex-col gap-4 shadow-sm z-20">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold shadow-green-200 shadow-md">
              <Activity size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-none">
                Trạm Điều Dưỡng (Tiêm Chủng & Thủ Thuật)
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                {filterDate.format("dddd, DD/MM/YYYY")} • Cần thực hiện: {queue.filter(q => q.status !== 'observing').length} | Đang theo dõi: {queue.filter(q => q.status === 'observing').length}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-600">Kho/Tủ lạnh chỉ định:</span>
                <Select
                  value={selectedWarehouseId}
                  onChange={setSelectedWarehouseId}
                  style={{ width: 180 }}
                  options={[
                    { value: 1, label: 'Kho Tổng' },
                    { value: 2, label: 'Tủ Lạnh Tiêm Chủng T1' },
                    { value: 3, label: 'Tủ Lạnh Tiêm Chủng T2' },
                  ]}
                />
             </div>
             <DatePicker 
                value={filterDate} 
                onChange={d => d && setFilterDate(d)} 
                format="DD/MM/YYYY" 
                allowClear={false}
             />
          </div>
        </div>
      </div>

      {/* BODY SPLIT VIEW */}
      <div className="flex flex-1 overflow-hidden bg-gray-50">
        
        {/* CỘT TRÁI (30%): DANH SÁCH HÀNG ĐỢI */}
        <div className="w-[30%] bg-white border-r border-gray-200 flex flex-col">
          
          {/* Nút lọc (Filter Tabs cho Cột trái) */}
          <div className="p-3 border-b flex gap-2">
            <button 
              onClick={() => setServiceTypeFilter('all')}
              className={`flex-1 py-1.5 rounded text-xs font-bold transition ${serviceTypeFilter === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Tất cả
            </button>
            <button 
              onClick={() => setServiceTypeFilter('vaccination')}
              className={`flex-1 flex justify-center items-center gap-1 py-1.5 rounded text-xs font-bold transition ${serviceTypeFilter === 'vaccination' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'}`}
            >
              <Syringe size={12} /> Tiêm
            </button>
            <button 
              onClick={() => setServiceTypeFilter('examination')}
              className={`flex-1 flex justify-center items-center gap-1 py-1.5 rounded text-xs font-bold transition ${serviceTypeFilter === 'examination' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
            >
              <Stethoscope size={12} /> T.Thuật
            </button>
          </div>

          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab} 
            centered 
            className="w-full"
            items={[
              { label: <span className="font-bold">Chờ Thực Hiện</span>, key: 'waiting' },
              { label: <span className="font-bold">Theo Dõi 30P</span>, key: 'observing' }
            ]}
          />

          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {loading ? (
              <div className="text-center py-10"><Spin /></div>
            ) : displayedQueue.length === 0 ? (
              <Empty description="Không có lượt nào" className="mt-10" />
            ) : (
              displayedQueue.map((item) => {
                const isSelected = selectedPatientId === item.customer_id;
                const isVaccination = item.service_type === 'vaccination';
                // Đỏ nhấp nháy ngay cột trái nếu có red_flags
                const hasRedFlags = item.red_flags && Array.isArray(item.red_flags) && item.red_flags.length > 0;
                
                return (
                  <div 
                    key={item.appointment_id}
                    onClick={() => setSelectedPatientId(item.customer_id)}
                    className={`relative p-3 rounded-lg border-2 cursor-pointer transition ${
                      isSelected 
                        ? (isVaccination ? "border-purple-500 bg-purple-50" : "border-blue-500 bg-blue-50")
                        : (hasRedFlags ? "border-red-400 bg-red-50 hover:bg-red-100 animate-pulse" : "border-gray-200 bg-white hover:border-blue-300")
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center font-bold text-white ${isVaccination ? 'bg-purple-500' : 'bg-blue-500'}`}>
                            STT {item.queue_number}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 leading-tight">{item.customer_name}</div>
                            <div className="text-xs text-gray-500">{item.gender === 'male' ? 'Nam' : 'Nữ'} • {dayjs().year() - item.yob} tuổi</div>
                          </div>
                       </div>
                    </div>
                    
                    {hasRedFlags && (
                      <div className="mt-2 text-[10px] bg-red-100 text-red-600 font-bold px-2 py-1 rounded flex items-center gap-1">
                         <AlertTriangle size={10} /> CÓ CẢNH BÁO DỊ ỨNG!
                      </div>
                    )}

                    {activeTab === 'observing' && (
                       <ObservingCountdown startTime={item.updated_at} />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* CỘT PHẢI (70%): RUỘT ĐỘNG (DYNAMIC WORKSPACE) */}
        <div className="w-[70%] bg-slate-50 p-6 flex flex-col h-full overflow-y-auto">
          {!selectedPatient ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <User size={64} className="mb-4 text-gray-200" />
              <h3 className="text-xl font-bold">Chưa chọn Bệnh nhân</h3>
              <p>Vui lòng chọn 1 Bệnh nhân ở danh sách bên trái để bắt đầu</p>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-200">
              
              {/* TỐI QUAN TRỌNG: RED FLAGS ALERT */}
              {selectedPatient.red_flags && selectedPatient.red_flags.length > 0 && (
                <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 mb-6 shadow-sm shadow-red-200 animate-pulse ring-4 ring-red-500/30">
                  <div className="flex items-center gap-3 text-red-700 font-extrabold text-lg mb-2">
                    <AlertTriangle size={24} />
                    CHÚ Ý: BỆNH NHÂN CÓ CẢNH BÁO / DỊ ỨNG!
                  </div>
                  <div className="pl-9 font-bold text-red-600 text-base">
                    {selectedPatient.red_flags.map((rf: string, idx: number) => (
                      <div key={idx}>• {rf}</div>
                    ))}
                  </div>
                  {selectedPatient.doctor_notes && (
                    <div className="pl-9 mt-2 text-sm text-red-500 italic">
                      Lưu ý từ BS: {selectedPatient.doctor_notes}
                    </div>
                  )}
                </div>
              )}

              {/* Thông tin Panel */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6 flex items-start gap-4">
                 <div className="w-16 h-16 bg-blue-100 text-blue-600 flex items-center justify-center rounded-full text-2xl font-bold">
                    {selectedPatient.customer_name?.charAt(0) || "P"}
                 </div>
                 <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-900 mb-1">{selectedPatient.customer_name}</h2>
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>Giới tính: <b>{selectedPatient.gender === 'male' ? 'Nam' : 'Nữ'}</b></span>
                      <span>Tuổi: <b>{dayjs().year() - selectedPatient.yob}</b></span>
                      <span>SĐT: <b>{selectedPatient.customer_phone}</b></span>
                    </div>
                 </div>
                 <div className="text-right">
                    <div className="text-xs text-gray-400 font-bold uppercase mb-1">Loại Dịch Vụ</div>
                    {selectedPatient.service_type === 'vaccination' ? (
                      <Tag color="purple" className="m-0 text-sm py-1 px-3 font-bold border-purple-300">💉 TIÊM CHỦNG</Tag>
                    ) : (
                      <Tag color="blue" className="m-0 text-sm py-1 px-3 font-bold border-blue-300">✂️ THỦ THUẬT</Tag>
                    )}
                 </div>
              </div>

              {/* Ruột Động (Workstation) */}
              {selectedPatient.status === 'observing' ? (
                <div className="bg-green-50 rounded-xl border border-green-200 p-10 flex flex-col items-center justify-center h-64 text-center">
                  <CheckCircle size={64} className="text-green-500 mb-4" />
                  <h3 className="text-2xl font-bold text-green-800">Đã Ký Bằng Thao Tác - Đang Theo Dõi 30P</h3>
                  <p className="text-green-600 mt-2 text-lg">Vui lòng hướng dẫn bệnh nhân ngồi tại khu vực chờ quy định.</p>
                </div>
              ) : selectedPatient.service_type === 'vaccination' ? (
                <VaccineWorkstation 
                  vaccines={selectedPatient.vaccines || []} 
                  isConfirming={loading}
                  onConfirm={(scannedIds) => handleConfirmVaccination(scannedIds, selectedPatient)} 
                />
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col h-full">
                   <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">DANH SÁCH THỦ THUẬT CẦN THỰC HIỆN</h3>
                   
                   {selectedPatient.procedures?.length > 0 ? (
                     <div className="flex flex-col gap-3">
                       {selectedPatient.procedures.map((proc: any, idx: number) => (
                         <div key={idx} className="p-4 border border-blue-200 bg-blue-50 rounded-lg flex justify-between items-center">
                           <span className="font-bold text-blue-900 text-lg">{proc.service_name}</span>
                           <Button type="primary">Hoàn Thành</Button>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <Empty description="Không có thủ thuật nào được chỉ định" />
                   )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
