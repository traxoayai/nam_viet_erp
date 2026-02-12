// src/pages/medical/DoctorQueuePage.tsx
import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Input, DatePicker, Avatar, Space } from 'antd';
import { UserOutlined, SearchOutlined } from '@ant-design/icons';
import { Stethoscope } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { receptionService } from '@/features/medical/api/receptionService';

const DoctorQueuePage = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [date, setDate] = useState(dayjs());
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchQueue();
    }, [date]); // Reload when date changes

    const fetchQueue = async () => {
        setLoading(true);
        try {
            // Call RPC or Service
            const res = await receptionService.getQueue(date.format('YYYY-MM-DD'), search);
            // Filter only waiting or examining
            const filtered = res.filter((item: any) => 
                ['waiting', 'examining'].includes(item.status)
            );
            setData(filtered);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const columns = [
        {
            title: 'STT',
            dataIndex: 'priority', // or calculate index
            width: 60,
            render: (_: any, __: any, index: number) => <Tag color="blue">#{index + 1}</Tag>
        },
        {
            title: 'Khách hàng',
            dataIndex: 'customer_name',
            render: (name: string, row: any) => (
                <Space>
                    <Avatar icon={<UserOutlined />} style={{ backgroundColor: row.customer_gender === 'male' ? '#1890ff' : '#eb2f96' }} />
                    <div>
                        <div className="font-bold">{name}</div>
                        <div className="text-xs text-gray-500">{row.customer_phone} - {dayjs().year() - row.customer_yob} tuổi</div>
                    </div>
                </Space>
            )
        },
        {
            title: 'Dịch vụ',
            dataIndex: 'service_names',
            render: (services: string[]) => (
                <div className="flex flex-wrap gap-1">
                    {services?.map((s, i) => <Tag key={i}>{s}</Tag>)}
                </div>
            )
        },
        {
            title: 'Trạng thái',
            dataIndex: 'status',
            width: 120,
            render: (status: string) => {
                const color = status === 'examining' ? 'processing' : 'warning';
                const text = status === 'examining' ? 'Đang khám' : 'Chờ khám';
                return <Tag color={color}>{text}</Tag>;
            }
        },
        {
            title: 'Hành động',
            key: 'action',
            width: 100,
            render: (_: any, row: any) => (
                <Button 
                    type="primary" 
                    icon={<Stethoscope />} 
                    onClick={() => navigate(`/medical/examination/${row.id}`)}
                >
                    Khám
                </Button>
            )
        }
    ];

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Stethoscope className="text-blue-600"/> Danh sách chờ khám bệnh
            </h2>

            <Card className="shadow-sm">
                <div className="flex justify-between mb-4">
                    <div className="flex gap-2">
                         <DatePicker 
                            value={date} 
                            onChange={(d) => d && setDate(d)} 
                            format="DD/MM/YYYY"
                            allowClear={false}
                         />
                         <Input 
                            placeholder="Tìm tên / SĐT..." 
                            prefix={<SearchOutlined />} 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onPressEnter={fetchQueue}
                            style={{ width: 200 }}
                         />
                         <Button onClick={fetchQueue}>Tìm</Button>
                    </div>
                    <div>
                        {/* Summary stats could go here */}
                    </div>
                </div>

                <Table 
                    loading={loading}
                    dataSource={data}
                    columns={columns}
                    rowKey="id"
                    pagination={{ pageSize: 10 }}
                />
            </Card>
        </div>
    );
};

export default DoctorQueuePage;
