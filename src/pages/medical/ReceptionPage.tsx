// src/pages/medical/ReceptionPage.tsx
import { useEffect, useState } from 'react';
import { 
  Search, Plus, Calendar, 
  MapPin, Printer, CheckCircle, Edit3, Trash2, 
  X, ChevronDown, PhoneCall,
  Stethoscope, Syringe, Activity, FileText, AlertCircle, Phone
} from 'lucide-react';
import { receptionService } from '@/features/medical/api/receptionService';
import { ReceptionAppointment } from '@/features/medical/types/reception.types';
import dayjs from 'dayjs';
import { message, Select } from 'antd'; // [NEW] Select Only
import { CustomerSearchSelect } from '@/features/medical/components/CustomerSearchSelect'; // [NEW]

// --- COMPONENTS CON ---
const ServiceTag = ({ type }: { type: string }) => {
  // Map service names/codes to styling
  // Note: type here is likely the name from DB or a code if we map it. 
  // Assuming simplified mapping for now based on text detection or passed codes.
  let conf = { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Stethoscope, label: type };
  
  const lowerType = type.toLowerCase();
  
  if (lowerType.includes('tiêm') || lowerType.includes('vaccine')) {
     conf = { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Syringe, label: type };
  } else if (lowerType.includes('siêu âm') || lowerType.includes('chụp')) {
     conf = { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Activity, label: type };
  } else if (lowerType.includes('xét nghiệm')) {
     conf = { color: 'bg-teal-100 text-teal-700 border-teal-200', icon: FileText, label: type };
  }

  const Icon = conf.icon;
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${conf.color} whitespace-nowrap`}>
      <Icon size={10} /> {conf.label}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const map: any = {
    pending: { color: 'bg-gray-100 text-gray-600', text: 'Mới đặt' },
    confirmed: { color: 'bg-blue-50 text-blue-600 border border-blue-100', text: 'Đã xác nhận' },
    waiting: { color: 'bg-green-50 text-green-600 border border-green-100', text: 'Đã đến (Waiting)' },
    cancelled: { color: 'bg-red-50 text-red-500 line-through decoration-red-500', text: 'Đã hủy' },
    completed: { color: 'bg-slate-200 text-slate-700', text: 'Hoàn thành' }
  };
  const conf = map[status] || { color: 'bg-gray-100 text-gray-600', text: status };
  return <span className={`px-2 py-1 rounded text-xs font-bold ${conf.color}`}>{conf.text}</span>;
};

const ContactStatus = ({ status }: { status: string }) => {
  if (status === 'confirmed') return <div title="Đã gọi nhắc" className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center cursor-pointer"><PhoneCall size={12}/></div>;
  if (status === 'failed') return <div title="Thuê bao/KLL" className="w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center cursor-pointer"><PhoneCall size={12}/></div>;
  return <div title="Chưa gọi" className="w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center cursor-pointer hover:bg-blue-100 hover:text-blue-600"><PhoneCall size={12}/></div>;
};

// --- MAIN PAGE ---
export default function ReceptionPage() {
  const [appointments, setAppointments] = useState<ReceptionAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data cho Modal form
  const [rooms, setRooms] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
     customerId: null as number | null, // [CRITICAL FIX] Track ID specifically
     customerName: '',
     customerPhone: '',
     appointmentTime: dayjs().format('YYYY-MM-DDTHH:mm'),
     roomId: '',
     note: '',
     priority: 'normal' as 'normal' | 'emergency' | 'vip'
  });

  // Load Data
  const fetchData = async () => {
      setLoading(true);
      try {
          // Lấy ngày hiện tại hoặc filter
          const date = dayjs().format('YYYY-MM-DD'); 
          const data = await receptionService.getQueue(date, searchTerm);
          // @ts-ignore
          setAppointments(data);
      } catch (err) {
          console.error(err);
          message.error('Không thể tải danh sách lịch hẹn');
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchData();
  }, [searchTerm]);

  const handleOpenModal = async () => {
      setIsModalOpen(true);
      // Reset form on open if needed
      if (!formData.customerId) {
          setFormData(prev => ({ ...prev, appointmentTime: dayjs().format('YYYY-MM-DDTHH:mm') }));
      }
      try {
          const [roomData, serviceData] = await Promise.all([
             receptionService.getRooms(),
             receptionService.getServices()
          ]);
          setRooms(roomData || []);
          setServices(serviceData || []);
      } catch (err) {
          console.error(err);
      }
  };

  const handleCreate = async (print: boolean) => {
      // Validate sơ bộ
      // [CRITICAL FIX] Check ID
      if (!formData.customerId && !formData.customerName) {
           message.warning('Vui lòng chọn khách hàng!');
           return;
      }
      
      // Fallback: Nếu user nhập tay tên mà chưa có ID (chưa implement quick create), báo lỗi
      if (!formData.customerId) {
          message.error("Vui lòng chọn khách hàng từ danh sách (Tạo mới nhanh chưa khả dụng)!");
          return;
      }

      try {
          await receptionService.createAppointment({
              customer_id: formData.customerId,
              appointment_time: formData.appointmentTime,
              room_id: formData.roomId ? Number(formData.roomId) : null,
              service_ids: selectedServices,
              priority: formData.priority,
              note: formData.note, 
              doctor_id: null
          });
          
          message.success('Đã tạo lịch hẹn thành công!');
          setIsModalOpen(false);
          // Reset form basics
          setFormData({
              ...formData,
              customerId: null,
              customerName: '',
              customerPhone: '',
              note: ''
          });
          setSelectedServices([]);
          
          fetchData();
          
          if (print) {
              window.print();
          }
      } catch (err) {
          console.error(err);
          message.error('Lỗi khi tạo lịch hẹn: ' + (err as Error).message);
      }
  };

  return (
    <div className="flex flex-col h-screen bg-white text-slate-800 font-sans overflow-hidden">
      
      {/* HEADER & FILTER */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 flex flex-col gap-4 shadow-sm z-20">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-blue-700 rounded-lg flex items-center justify-center text-white font-bold shadow-blue-200 shadow-md">R</div>
             <div>
               <h1 className="text-xl font-bold text-gray-900 leading-none">Tiếp Đón & Lịch Hẹn</h1>
               <p className="text-xs text-gray-500 mt-1">
                   {dayjs().format('dddd, DD/MM/YYYY')} • Tổng: {appointments.length} lịch
               </p>
             </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={handleOpenModal}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 transition transform hover:-translate-y-0.5"
            >
               <Plus size={18} strokeWidth={3}/> Đặt Lịch Mới
            </button>
          </div>
        </div>
        
        {/* Filter Bar */}
        <div className="flex gap-3">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition" 
                  placeholder="Tìm tên KH, SĐT, Mã hồ sơ..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
              />
           </div>
           <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white cursor-pointer hover:border-blue-400 transition">
              <Calendar size={16} className="text-gray-500"/> <span className="text-sm font-medium">Hôm nay</span> <ChevronDown size={14} className="text-gray-400"/>
           </div>
           <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white cursor-pointer hover:border-blue-400 transition">
              <MapPin size={16} className="text-gray-500"/> <span className="text-sm font-medium">Tất cả Phòng</span> <ChevronDown size={14} className="text-gray-400"/>
           </div>
        </div>
      </div>

      {/* --- DATA TABLE --- */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
           {loading ? (
             <div className="p-10 text-center text-gray-500">Đang tải dữ liệu...</div>
           ) : (
           <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase font-bold sticky top-0 z-10">
                 <tr>
                    <th className="px-6 py-4 w-24">Giờ hẹn</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Dịch vụ</th>
                    <th className="px-6 py-4 w-40">Phòng</th> 
                    {/* <th className="px-6 py-4 w-40">Bác sĩ</th> */}
                    <th className="px-6 py-4 w-32 text-center">Liên hệ</th>
                    <th className="px-6 py-4 w-40">Trạng thái</th>
                    <th className="px-6 py-4 w-32"></th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                 {appointments.map((row) => (
                    <tr key={row.id} className="group hover:bg-blue-50/50 transition duration-150 relative">
                       <td className="px-6 py-4">
                          <div className={`text-lg font-black font-mono ${row.status !== 'waiting' ? 'text-gray-800' : 'text-green-600'}`}>
                              {dayjs(row.appointment_time).format('HH:mm')}
                          </div>
                          {row.priority === 'emergency' && (
                             <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase mt-1 animate-pulse border border-red-200">
                                <AlertCircle size={10}/> Cấp cứu
                             </span>
                          )}
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                             <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ${row.customer_name?.includes('A') ? 'bg-blue-600' : 'bg-gray-400'}`}>
                                {row.customer_name?.charAt(0) || 'K'}
                             </div>
                             <div>
                                <div className="font-bold text-gray-900 group-hover:text-blue-700 cursor-pointer">{row.customer_name}</div>
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                    {row.customer_gender === 'male' ? 'Nam' : 'Nữ'} • {row.customer_yob} • <Phone size={10}/> {row.customer_phone}
                                </div>
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                             {row.service_names?.map((s, idx) => <ServiceTag key={idx} type={s} />)}
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          {row.room_name && (
                            <div className="flex items-center gap-1 text-sm font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded w-fit">
                                <MapPin size={12} className="text-gray-500"/> {row.room_name}
                            </div>
                          )}
                       </td>
                       <td className="px-6 py-4 text-center">
                          <div className="flex justify-center"><ContactStatus status={row.contact_status} /></div>
                       </td>
                       <td className="px-6 py-4">
                          <StatusBadge status={row.status} />
                       </td>
                       <td className="px-6 py-4 text-right relative">
                          <div className="text-gray-300 group-hover:opacity-0 transition-opacity"><Edit3 size={18}/></div> 
                          
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white shadow-lg border border-gray-100 rounded-lg p-1 z-20">
                             {/* Nút In Nhanh */}
                             <button onClick={() => window.print()} title="In Phiếu Khám" className="p-2 hover:bg-gray-100 text-gray-600 rounded transition border-r border-gray-100">
                                <Printer size={18}/>
                             </button>

                             <button title="Check-in Khách" className="p-2 hover:bg-green-50 text-green-600 rounded transition"><CheckCircle size={18}/></button>
                             <button title="Hủy lịch" className="p-2 hover:bg-red-50 text-red-500 rounded transition"><Trash2 size={18}/></button>
                          </div>
                       </td>
                    </tr>
                 ))}
                 {appointments.length === 0 && (
                     <tr>
                         <td colSpan={7} className="text-center py-10 text-gray-400">Chưa có lịch hẹn nào hôm nay</td>
                     </tr>
                 )}
              </tbody>
           </table>
           )}
        </div>
      </div>

      {/* --- 3. MODAL: QUICK BOOKING --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                 <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Plus className="bg-blue-600 text-white p-0.5 rounded-full" size={20}/> Tạo Lịch Hẹn Mới
                 </h2>
                 <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5">
                 
                 {/* 1. Customer [UPDATED] */}
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Khách hàng <span className="text-red-500">*</span></label>
                    <CustomerSearchSelect 
                        value={formData.customerId as number}
                        onChange={(val, customer) => {
                             setFormData({
                                 ...formData, 
                                 customerId: val,
                                 customerName: customer?.name || '',
                                 customerPhone: customer?.phone || ''
                             });
                        }}
                    />
                 </div>

                 {/* 2. Dịch vụ (Select Multiple) [UPDATED] */}
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Dịch vụ (Chọn nhiều)</label>
                    <Select
                        mode="multiple"
                        style={{ width: '100%' }}
                        placeholder="Chọn dịch vụ (Khám, Tiêm, Siêu âm)..."
                        size="large"
                        value={selectedServices}
                        onChange={(vals) => setSelectedServices(vals)}
                        options={services.map(s => ({ 
                             label: `${s.name} - ${parseInt(s.price).toLocaleString()}đ`, 
                             value: s.id 
                        }))}
                        maxTagCount="responsive"
                    />
                 </div>

                 {/* 3. Time, Room */}
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Thời gian hẹn</label>
                       <input 
                           type="datetime-local" 
                           className="w-full p-2 border border-gray-300 rounded-lg text-sm" 
                           value={formData.appointmentTime}
                           onChange={e => setFormData({...formData, appointmentTime: e.target.value})}
                        />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Phòng / Khu vực</label>
                       <select 
                           className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                           value={formData.roomId}
                           onChange={e => setFormData({...formData, roomId: e.target.value})}
                       >
                          <option value="">-- Tự động xếp --</option>
                          {rooms.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                       </select>
                    </div>
                 </div>

                 {/* 4. Notes & Priority */}
                 <div className="grid grid-cols-1 gap-4">
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Mức độ ưu tiên</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="priority" 
                                    value="normal"
                                    checked={formData.priority === 'normal'}
                                    onChange={() => setFormData({...formData, priority: 'normal'})}
                                /> 
                                Thường
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="priority" 
                                    value="emergency"
                                    checked={formData.priority === 'emergency'}
                                    onChange={() => setFormData({...formData, priority: 'emergency'})}
                                /> 
                                <span className="text-red-600 font-bold">Cấp cứu</span>
                            </label>
                             <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="priority" 
                                    value="vip"
                                    checked={formData.priority === 'vip'}
                                    onChange={() => setFormData({...formData, priority: 'vip'})}
                                /> 
                                <span className="text-purple-600 font-bold">VIP</span>
                            </label>
                        </div>
                     </div>
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú</label>
                        <textarea 
                            className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20" 
                            placeholder="Triệu chứng, lý do khám..."
                            value={formData.note}
                            onChange={e => setFormData({...formData, note: e.target.value})}
                        ></textarea>
                     </div>
                 </div>

              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex justify-end gap-3">
                 <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-lg transition">Hủy bỏ</button>
                 
                 <button onClick={() => handleCreate(false)} className="px-5 py-2.5 border border-blue-600 text-blue-600 font-bold text-sm rounded-lg hover:bg-blue-50 transition">
                    Lưu Lịch Hẹn
                 </button>

                 <button onClick={() => handleCreate(true)} className="px-6 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-lg shadow-lg hover:bg-blue-700 transition flex items-center gap-2">
                    <Printer size={18}/> Lưu & In Phiếu
                 </button>
              </div>

           </div>
        </div>
      )}

    </div>
  );
}
