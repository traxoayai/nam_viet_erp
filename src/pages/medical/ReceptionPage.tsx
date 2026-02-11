// src/pages/medical/ReceptionPage.tsx
import { useEffect, useState } from 'react';
import { 
  Search, Plus, MapPin, Printer, CheckCircle, 
  Edit3, Trash2, X, PhoneCall,
  Stethoscope, Syringe, Activity, AlertCircle, Phone, User, XCircle
} from 'lucide-react';
import { receptionService } from '@/features/medical/api/receptionService';
import { ReceptionAppointment } from '@/features/medical/types/reception.types';
import dayjs from 'dayjs';
import { message, Select, DatePicker, Tag, Tooltip, Avatar, Modal } from 'antd';
import { CustomerSearchSelect } from '@/features/medical/components/CustomerSearchSelect';
import { printAppointmentSlip } from '@/shared/utils/printTemplates'; // Import hàm in mới

// --- HELPERS ---
const calculateAge = (yob: number) => {
    if (!yob) return '';
    const age = dayjs().year() - yob;
    return `${age} tuổi`;
};

// Component Badge Dịch vụ
const ServiceTag = ({ type }: { type: string }) => {
  let conf = { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Stethoscope, label: type };
  const lowerType = (type || '').toLowerCase();
  
  if (lowerType.includes('tiêm') || lowerType.includes('vaccine')) {
     conf = { color: 'bg-purple-100 text-purple-700 border-purple-200', icon: Syringe, label: type };
  } else if (lowerType.includes('siêu âm') || lowerType.includes('chụp')) {
     conf = { color: 'bg-orange-100 text-orange-700 border-orange-200', icon: Activity, label: type };
  }
  const Icon = conf.icon;
  return (
    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${conf.color} whitespace-nowrap`}>
      <Icon size={10} /> {conf.label}
    </span>
  );
};

// [POLISH] Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
    const map: any = {
        pending: { color: 'bg-gray-100 text-gray-600', text: 'Mới đặt' },
        confirmed: { color: 'bg-blue-50 text-blue-600 border border-blue-100', text: 'Đã xác nhận' },
        waiting: { color: 'bg-green-50 text-green-600 border border-green-100', text: 'Đã đến' },
        // [FIX] Làm nổi bật trạng thái Hủy
        cancelled: { 
            color: 'bg-red-50 text-red-600 border border-red-200 decoration-slate-400', 
            text: 'Đã hủy',
            icon: <XCircle size={12} className="mr-1"/> 
        },
        completed: { color: 'bg-slate-200 text-slate-700', text: 'Hoàn thành' }
    };

    const conf = map[status] || { color: 'bg-gray-100 text-gray-600', text: status };

    return (
        <span className={`flex items-center w-fit px-2 py-1 rounded text-xs font-bold ${conf.color}`}>
            {conf.icon} {conf.text}
        </span>
    );
};

// Component Trạng thái Liên hệ [UPDATED]
const ContactStatus = ({ status, staffName }: { status: string, staffName?: string }) => {
    let icon = <PhoneCall size={14}/>;
    let colorClass = "bg-gray-100 text-gray-400";
    let title = "Chưa liên hệ";

    if (status === 'confirmed' || status === 'called') {
        colorClass = "bg-green-100 text-green-600";
        title = `Đã liên hệ bởi ${staffName || 'N/A'}`;
    } else if (status === 'failed') {
        colorClass = "bg-red-100 text-red-500";
        title = `Không nghe máy (${staffName || 'N/A'})`;
    }

    return (
        <div className="flex flex-col items-center gap-1">
            <Tooltip title={title}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition hover:scale-110 ${colorClass}`}>
                    {icon}
                </div>
            </Tooltip>
            {staffName && <span className="text-[10px] text-gray-500">{staffName}</span>}
        </div>
    );
};

// --- MAIN PAGE ---
export default function ReceptionPage() {
  // Data State
  const [appointments, setAppointments] = useState<ReceptionAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // [HOTFIX] Cancel Modal State
  const [cancelModal, setCancelModal] = useState<{ open: boolean, id: string | null }>({ open: false, id: null });
  const [cancelReason, setCancelReason] = useState('');
  
  // Filter State [FIXED]
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState(dayjs()); // Mặc định hôm nay
  const [filterRoom, setFilterRoom] = useState<number | null>(null);

  // Modal Data
  const [rooms, setRooms] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  
  // Form State
  const [selectedServices, setSelectedServices] = useState<number[]>([]);
  const [formData, setFormData] = useState({
     customerId: null as number | null,
     customerData: null as any, // Lưu full info khách để hiển thị Card
     appointmentTime: dayjs().format('YYYY-MM-DDTHH:mm'),
     roomId: '',
     note: '',
     priority: 'normal' as 'normal' | 'emergency' | 'vip'
  });

  // Load Data [UPDATED with Filters]
  const fetchData = async () => {
      setLoading(true);
      try {
          const dateStr = filterDate.format('YYYY-MM-DD');
          const data = await receptionService.getQueue(dateStr, searchTerm);
          
          // Client-side filtering cho Room (nếu API chưa hỗ trợ filter room)
          let filtered = data;
          if (filterRoom) {
              // @ts-ignore
              filtered = data.filter(i => i.room_id === filterRoom);
          }
          
          // @ts-ignore
          setAppointments(filtered);
      } catch (err) {
          console.error(err);
          message.error('Không thể tải danh sách');
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      fetchData();
  }, [searchTerm, filterDate, filterRoom]);

  // Load resources for Modal & Filter
  useEffect(() => {
      const loadResources = async () => {
          const [roomData, serviceData] = await Promise.all([
              receptionService.getRooms(),
              receptionService.getServices()
          ]);
          setRooms(roomData || []);
          setServices(serviceData || []);
      };
      loadResources();
  }, []);

  // --- ACTIONS ---
  const handleCheckIn = async (id: string) => {
    try {
        await receptionService.updateStatus(id, 'waiting');
        message.success("Đã check-in khách hàng!");
        
        // [FIX] Update UI ngay
        setAppointments(prev => prev.map(item => 
            item.id === id ? { ...item, status: 'waiting' } : item
        ));
    } catch (e: any) { message.error("Lỗi: " + e.message); }
  };

  // [HOTFIX] Cancel Logic Replacement
  const handleCancelClick = (id: string) => {
      setCancelReason('');
      setCancelModal({ open: true, id });
  };

  const submitCancel = async () => {
      if (!cancelReason.trim()) return message.warning("Vui lòng nhập lý do hủy!");
      try {
          // 1. Gọi API
          await receptionService.updateStatus(cancelModal.id!, 'cancelled', cancelReason);
          message.success("Đã hủy lịch hẹn");
          
          // 2. [FIX] OPTIMISTIC UPDATE: Cập nhật UI ngay lập tức (Không chờ fetchData)
          setAppointments(prev => prev.map(item => 
              item.id === cancelModal.id 
                  ? { ...item, status: 'cancelled' } // Ép trạng thái thành cancelled
                  : item
          ));
          
          // 3. Đóng modal & Reset
          setCancelModal({ open: false, id: null });
          
          // [POLISH] REMOVED timeout re-fetch to prevent flickering
          // setTimeout(() => fetchData(), 500); 
      } catch (e: any) { message.error(e.message); }
  };

  const handleCreate = async (print: boolean) => {
      if (!formData.customerId) return message.warning('Vui lòng chọn khách hàng!');

      try {
          // Fake object để in ngay lập tức (cho trải nghiệm nhanh)
          // Logic Map tên dịch vụ
          const serviceNames = selectedServices.map(id => {
              const s = services.find(item => item.id === id);
              return s ? s.name : `Dịch vụ #${id}`;
          });

          const tempApptForPrint = {
              customer_name: formData.customerData?.name,
              customer_yob: dayjs(formData.customerData?.dob).year(),
              customer_gender: formData.customerData?.gender,
              customer_phone: formData.customerData?.phone,
              appointment_time: formData.appointmentTime,
              service_ids: selectedServices,
              // Note: room_name cần tìm từ rooms array
              room_name: rooms.find(r => r.id == formData.roomId)?.name,
              service_names_mapped: serviceNames // Gửi mảng tên sang
          };

          await receptionService.createAppointment({
              customer_id: formData.customerId,
              appointment_time: formData.appointmentTime,
              room_id: formData.roomId ? Number(formData.roomId) : null,
              service_ids: selectedServices,
              priority: formData.priority,
              note: formData.note, 
              doctor_id: null
          });
          
          message.success('Đã tạo lịch hẹn!');
          setIsModalOpen(false);
          resetForm();
          fetchData();
          
          if (print) {
              printAppointmentSlip(tempApptForPrint);
          }
      } catch (err: any) {
          message.error('Lỗi: ' + err.message);
      }
  };

  const resetForm = () => {
      setFormData({
          customerId: null,
          customerData: null,
          appointmentTime: dayjs().format('YYYY-MM-DDTHH:mm'),
          roomId: '',
          note: '',
          priority: 'normal'
      });
      setSelectedServices([]);
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
                   {filterDate.format('dddd, DD/MM/YYYY')} • Tổng: {appointments.length} khách
               </p>
             </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-200 transition transform hover:-translate-y-0.5"
            >
               <Plus size={18} strokeWidth={3}/> Đặt Lịch Mới
            </button>
          </div>
        </div>
        
        {/* Filter Bar [FIXED] */}
        <div className="flex gap-3">
           <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
              <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none" 
                  placeholder="Tìm tên KH, SĐT, Mã hồ sơ..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
              />
           </div>
           
           {/* Date Picker Filter */}
           <div className="flex items-center">
              <DatePicker 
                  value={filterDate} 
                  onChange={(date) => setFilterDate(date || dayjs())}
                  format="DD/MM/YYYY"
                  allowClear={false}
                  className="border-gray-200 rounded-lg h-[38px]"
              />
           </div>

           {/* Room Filter */}
           <Select
               placeholder="Tất cả Phòng"
               style={{ width: 200 }}
               allowClear
               className="h-[38px]"
               value={filterRoom}
               onChange={setFilterRoom}
               options={rooms.map(r => ({ label: r.name, value: r.id }))}
           />
        </div>
      </div>

      {/* --- DATA TABLE --- */}
      <div className="flex-1 overflow-auto bg-gray-50 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
           <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase font-bold sticky top-0 z-10">
                 <tr>
                    <th className="px-6 py-4 w-24">Giờ hẹn</th>
                    <th className="px-6 py-4">Khách hàng</th>
                    <th className="px-6 py-4">Dịch vụ</th>
                    <th className="px-6 py-4 w-40">Phòng</th> 
                    <th className="px-6 py-4 w-40 text-center">Liên hệ</th>
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
                                   {row.customer_gender === 'male' ? 'Nam' : 'Nữ'} • {calculateAge(row.customer_yob)} • <Phone size={10}/> {row.customer_phone}
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
                            <div className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded w-fit border border-gray-200">
                                <MapPin size={10}/> {row.room_name}
                            </div>
                          )}
                       </td>
                       <td className="px-6 py-4 text-center">
                          {/* [FIXED] Hiển thị Staff Name nếu có (cần RPC trả về staff_name hoặc creator_name) */}
                          <ContactStatus status={row.contact_status} staffName={row.creator_name} /> 
                       </td>
                       <td className="px-6 py-4">
                          <StatusBadge status={row.status} />
                          {/* [HOTFIX] Payment Status */}
                          {row.payment_status === 'paid' && <Tag color="green" className="ml-1">Đã TT</Tag>}
                       </td>
                       
                       {/* [FIXED] Hover Actions che mất nút Sửa -> Đưa nút Sửa vào trong Group luôn */}
                       <td className="px-6 py-4 text-right relative">
                          {/* Default: Icon Edit mờ */}
                          <div className="text-gray-300 group-hover:opacity-0 transition-opacity"><Edit3 size={18}/></div> 
                          
                          {/* Hover: Group Button hiện lên (Đã bao gồm nút Sửa) */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center bg-white shadow-xl border border-gray-200 rounded-lg p-1 z-20 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 origin-right">
                              <Tooltip title="In Phiếu">
                                 <button onClick={() => {
                                     // Use service_names from row directly
                                     const printData = { 
                                         ...row, 
                                         service_names_mapped: row.service_names || [] 
                                     };
                                     printAppointmentSlip(printData);
                                 }} className="p-2 hover:bg-gray-100 text-gray-600 rounded transition"><Printer size={16}/></button>
                              </Tooltip>
                              <div className="w-px h-4 bg-gray-200 mx-1"></div>
                              
                              <Tooltip title="Sửa thông tin">
                                 <button 
                                     onClick={() => {
                                         // Logic: Fill data vào form & Mở modal
                                         setFormData({
                                             customerId: row.customer_id,
                                             customerData: {
                                                 name: row.customer_name,
                                                 phone: row.customer_phone,
                                                 // Các trường khác như dob, definitions cần lấy từ đâu đó nếu row không có đủ
                                                 // Tạm thời chỉ map các field cơ bản
                                             },
                                             appointmentTime: dayjs(row.appointment_time).format('YYYY-MM-DDTHH:mm'),
                                             roomId: row.room_id ? String(row.room_id) : '',
                                             note: '', // Cần fetch chi tiết nếu muốn lấy note
                                             priority: row.priority as any
                                         });
                                         setSelectedServices(row.service_ids || []);
                                         setIsModalOpen(true);
                                     }}
                                     className="p-2 hover:bg-blue-50 text-blue-600 rounded transition"
                                 >
                                    <Edit3 size={16}/>
                                 </button>
                              </Tooltip>
                              
                              <Tooltip title="Check-in (Đã đến)">
                                 <button onClick={() => handleCheckIn(row.id)} className="p-2 hover:bg-green-50 text-green-600 rounded transition"><CheckCircle size={16}/></button>
                              </Tooltip>
                              
                              <Tooltip title="Hủy hẹn">
                                 <button onClick={() => handleCancelClick(row.id)} className="p-2 hover:bg-red-50 text-red-500 rounded transition"><Trash2 size={16}/></button>
                              </Tooltip>
                          </div>
                       </td>
                    </tr>
                 ))}
                 {appointments.length === 0 && !loading && (
                     <tr><td colSpan={7} className="text-center py-10 text-gray-400">Không có lịch hẹn nào</td></tr>
                 )}
              </tbody>
           </table>
        </div>
      </div>

      {/* --- 3. MODAL: QUICK BOOKING [UPDATED] --- */}
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
                 
                 {/* 1. Customer Selection Area */}
                 <div>
                    <div className="flex justify-between mb-1">
                        <label className="block text-sm font-bold text-gray-700">Khách hàng <span className="text-red-500">*</span></label>
                        {formData.customerId && (
                            <button 
                                onClick={() => setFormData(p => ({...p, customerId: null, customerData: null}))}
                                className="text-xs text-blue-600 hover:underline"
                            >
                                Thay đổi / Chọn lại
                            </button>
                        )}
                    </div>

                    {!formData.customerId ? (
                        <CustomerSearchSelect 
                            value={formData.customerId as number}
                            onChange={(val, customer) => {
                                 setFormData({
                                     ...formData, 
                                     customerId: val,
                                     customerData: customer // Save full data for Card
                                 });
                            }}
                        />
                    ) : (
                        // [NEW] CUSTOMER INFO CARD (POS STYLE)
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-4 items-start relative">
                            <Avatar size={48} style={{ backgroundColor: '#1890ff' }} icon={<User />} />
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-gray-800 text-lg leading-none">{formData.customerData?.name}</h3>
                                        <div className="text-sm text-gray-500 mt-1 flex gap-2">
                                            <span>{formData.customerData?.code}</span>
                                            <span>•</span>
                                            <span>{formData.customerData?.phone}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <Tag color="blue">{calculateAge(dayjs(formData.customerData?.dob).year())}</Tag>
                                    </div>
                                </div>
                                
                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white px-2 py-1 rounded border border-blue-100 text-gray-600">
                                        <span className="font-bold">Tiền sử:</span> {formData.customerData?.medical_history || 'Chưa ghi nhận'}
                                    </div>
                                    <div className="bg-white px-2 py-1 rounded border border-red-100 text-red-600">
                                        <span className="font-bold">Dị ứng:</span> {formData.customerData?.allergies || 'Không'}
                                    </div>
                                </div>
                            </div>
                            <button title="Sửa thông tin KH" className="absolute top-2 right-2 text-gray-400 hover:text-blue-600"><Edit3 size={16}/></button>
                        </div>
                    )}
                 </div>

                 {/* 2. Dịch vụ (Select Multiple) */}
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Dịch vụ (Chọn nhiều)</label>
                    <Select
                        mode="multiple"
                        style={{ width: '100%' }}
                        placeholder="Chọn dịch vụ (Khám, Tiêm, Siêu âm)..."
                        size="large"
                        value={selectedServices}
                        onChange={setSelectedServices}
                        options={services.map(s => ({ 
                             label: `${s.name} - ${parseInt(s.price).toLocaleString()}đ`, 
                             value: s.id 
                        }))}
                    />
                 </div>

                 {/* 3. Time, Room */}
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-bold text-gray-700 mb-1">Thời gian hẹn</label>
                       <input 
                           type="datetime-local" 
                           className="w-full p-2 border border-gray-300 rounded-lg text-sm font-mono" 
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
                        <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                            {['normal', 'emergency', 'vip'].map((p) => (
                                <button 
                                    key={p}
                                    onClick={() => setFormData({...formData, priority: p as any})}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded transition capitalize ${
                                        formData.priority === p 
                                        ? 'bg-white shadow text-blue-700' 
                                        : 'text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {p === 'emergency' ? 'Cấp cứu' : p}
                                </button>
                            ))}
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

              {/* FOOTER ACTIONS */}
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

      {/* [HOTFIX] Cancel Modal */}
      <Modal
          title="Xác nhận Hủy Lịch Hẹn"
          open={cancelModal.open}
          onOk={submitCancel}
          onCancel={() => setCancelModal({ open: false, id: null })}
          okText="Xác nhận Hủy"
          okButtonProps={{ danger: true }}
          cancelText="Đóng"
      >
          <p className="mb-2 font-medium text-gray-700">Lý do hủy:</p>
          <textarea
              className="w-full p-3 border border-solid border-gray-300 bg-white rounded-lg focus:ring-2 focus:ring-red-500 outline-none shadow-sm resize-y text-slate-800"
              style={{ minHeight: '120px' }}
              placeholder="Ví dụ: Khách bận, Sai thông tin..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
          />
      </Modal>

    </div>
  );
}