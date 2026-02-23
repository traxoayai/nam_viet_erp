
// src/features/medical/components/paraclinical/ImagingWorkspace.tsx
import { useState } from 'react';
import { Select, Button, message, Typography, Card, Input } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { paraclinicalService } from '@/features/medical/api/paraclinicalService';
import { SaveOutlined, PrinterOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { printImagingResult } from '@/shared/utils/printTemplates';

const { Text } = Typography;
const { Option } = Select;

interface Props {
    request: any;
    onComplete: () => void;
}

export const ImagingWorkspace = ({ request, onComplete }: Props) => {
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [description, setDescription] = useState<string>('');
    const [conclusion, setConclusion] = useState<string>('');
    const [recommendation, setRecommendation] = useState<string>('');
    const [customConclusion, setCustomConclusion] = useState<string>('');
    
    // Lưu giá trị form động từ description/conclusion
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: templates = [], isLoading } = useQuery({
        queryKey: ['paraclinical_templates', request.service_package_id],
        queryFn: () => paraclinicalService.getTemplates(request.service_package_id),
        enabled: !!request.service_package_id
    });

    const handleApplyTemplate = (id: number) => {
        const tpl = templates.find((t: any) => t.id === id);
        if (tpl) {
            setSelectedTemplate(tpl);
            setDescription(tpl.description_html || '');
            setConclusion(tpl.conclusion || '');
            setRecommendation(tpl.recommendation || '');
            setCustomConclusion('');
            setFormData({}); // Reset
        }
    };

    // --- SMART PARSER ---
    const RED_FLAGS = ['viêm', 'u', 'phình', 'nang', 'gãy', 'sỏi', 'tràn dịch', 'cấp cứu'];

    // Hàm render nội dung thông minh
    const renderSmartContent = (content: string, fieldPrefix: string, applyHighlight: boolean = false) => {
        if (!content) return null;
        const regex = /\{\{(.*?)\}\}/g;
        const parts = [];
        let lastIndex = 0;
        let fieldIndex = 0;

        // Xử lý bôi đỏ từ khóa & TRẢ VỀ HTML STRING
        const processTextToHtmlString = (txt: string) => {
            if (!applyHighlight) return txt;
            const regexStr = RED_FLAGS.join('|');
            const highlightRegex = new RegExp(`(${regexStr})`, 'gi');
            return txt.replace(highlightRegex, '<span class="text-red-600 font-bold bg-red-50 px-1 rounded">$1</span>');
        };

        let match;
        while ((match = regex.exec(content)) !== null) {
            // 1. Render phần text (chứa HTML) TRƯỚC biến {{}} bằng dangerouslySetInnerHTML
            if (match.index > lastIndex) {
                const htmlString = processTextToHtmlString(content.substring(lastIndex, match.index));
                parts.push(
                    <span key={`text-${lastIndex}`} dangerouslySetInnerHTML={{ __html: htmlString }} />
                );
            }

            const token = match[1];
            const currentIdx = fieldIndex++;
            const formKey = `${fieldPrefix}_${currentIdx}`;

            // 2. Render Biến (Input hoặc Select)
            if (token === 'input') {
                parts.push(
                    <input
                        key={`input-${formKey}`}
                        className="border-b border-dashed border-gray-400 focus:border-blue-500 focus:bg-yellow-50 outline-none px-1 mx-1 w-16 text-center text-blue-700 font-semibold bg-transparent"
                        value={formData[formKey] || ''}
                        onChange={(e) => setFormData(prev => ({...prev, [formKey]: e.target.value}))}
                    />
                );
            } else if (token.startsWith('select:')) {
                const optionsStr = token.substring(7);
                const options = optionsStr.split('|');
                const defaultOpt = options.find(o => o.endsWith('*'))?.replace('*', '') || options[0];

                parts.push(
                    <select
                        key={`select-${formKey}`}
                        className="border-b border-dashed border-gray-400 focus:border-blue-500 outline-none px-1 mx-1 text-blue-700 font-semibold bg-transparent cursor-pointer"
                        value={formData[formKey] !== undefined ? formData[formKey] : defaultOpt}
                        onChange={(e) => setFormData(prev => ({...prev, [formKey]: e.target.value}))}
                    >
                        {options.map((opt, i) => {
                            const val = opt.replace('*', '');
                            return <option key={i} value={val}>{val}</option>;
                        })}
                    </select>
                );
            }
            lastIndex = regex.lastIndex;
        }

        // 3. Render đoạn text (chứa HTML) CUỐI CÙNG sau biến cuối
        if (lastIndex < content.length) {
            const htmlString = processTextToHtmlString(content.substring(lastIndex));
            parts.push(
                <span key={`text-end`} dangerouslySetInnerHTML={{ __html: htmlString }} />
            );
        }

        return <div className="leading-loose text-base">{parts}</div>;
    };

    const handlePrint = () => {
        // Phải build lại HTML từ state hiện tại (giống hàm submit)
        const regex = /\{\{(.*?)\}\}/g;
        let fieldIndex = 0;
        const finalDescriptionHtml = description.replace(regex, (match, token) => {
            const currentIdx = fieldIndex++;
            if (token === 'input') return formData[`desc_${currentIdx}`] || '_____';
            if (token.startsWith('select:')) {
                const options = token.substring(7).split('|');
                const def = options.find((o: string) => o.endsWith('*'))?.replace('*', '') || options[0];
                return formData[`desc_${currentIdx}`] || def;
            }
            return match;
        });

        // Parse kết luận
        let concIndex = 0;
        const finalConcHtml = conclusion.replace(regex, (match, token) => {
            const currentIdx = concIndex++;
            if (token === 'input') return formData[`conc_${currentIdx}`] || '_____';
            if (token.startsWith('select:')) {
                const options = token.substring(7).split('|');
                const def = options.find((o: string) => o.endsWith('*'))?.replace('*', '') || options[0];
                return formData[`conc_${currentIdx}`] || def;
            }
            return match;
        });

        const highlightTextHTML = (text: string) => {
             if (!text) return '';
             const regexStr = RED_FLAGS.join('|');
             const highlightRegex = new RegExp(`(${regexStr})`, 'gi');
             return text.replace(highlightRegex, '<span style="color:red;font-weight:bold;">$1</span>');
        };

        const fullConclusionHtml = customConclusion ? `${highlightTextHTML(finalConcHtml)} <br/><i>${customConclusion}</i>` : highlightTextHTML(finalConcHtml);

        printImagingResult({
            patientInfo: request.patient,
            serviceName: request.service_name_snapshot,
            descriptionHtml: finalDescriptionHtml,
            conclusionHtml: fullConclusionHtml,
            recommendation: recommendation,
            doctorName: 'Admin', // Lấy user name từ Auth Store nếu có
            date: new Date().toISOString()
        });
    };

    // Submit
    const handleSubmit = async (status: 'draft' | 'completed') => {
        setIsSubmitting(true);
        try {
             const buildHtml = (content: string, fieldPrefix: string) => {
                 let fieldIndex = 0;
                 return content.replace(/\{\{(.*?)\}\}/g, (match, token) => {
                     const formKey = `${fieldPrefix}_${fieldIndex++}`;
                     if (token === 'input') return formData[formKey] || '_____';
                     if (token.startsWith('select:')) {
                         const options = token.substring(7).split('|');
                         const def = options.find((o: string) => o.endsWith('*'))?.replace('*', '') || options[0];
                         return formData[formKey] || def;
                     }
                     return match;
                 });
             };

             // Khi build final HTML trong submit:
             const finalDescHtml = buildHtml(description, 'desc');
             const finalConcHtml = buildHtml(conclusion, 'conc');
             const fullConclusionHtml = customConclusion ? `${finalConcHtml}. <br/><i>Bổ sung: ${customConclusion}</i>` : finalConcHtml;

             const fullHtml = `
                <div>
                   <h4>Mô tả:</h4>
                   <div>${finalDescHtml}</div>
                   <br/>
                   <h4>Kết luận:</h4>
                   <div style="font-weight: bold; color: #b91c1c;">${fullConclusionHtml}</div>
                   <br/>
                   <h4>Đề nghị:</h4>
                   <div>${recommendation}</div>
                </div>
             `;

             await paraclinicalService.submitResult({
                 request_id: request.id,
                 imaging_result: fullHtml,
                 status
             });

             message.success(status === 'completed' ? 'Đã hoàn thành phiếu chụp!' : 'Đã lưu nháp!');
             
             if (status === 'completed') {
                 onComplete();
             }

        } catch (error: any) {
             message.error(error.message || 'Lỗi lưu kết quả');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white h-screen">
             <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white sticky top-0 z-10 shadow-sm print:hidden">
                  <div>
                      <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                           Kết quả {request.service_name_snapshot}
                      </h2>
                      <Text type="secondary">Bệnh nhân: {request.patient?.name || 'Khách vãng lai'}</Text>
                  </div>
                  <div className="flex gap-4 items-center">
                       <Select 
                           placeholder="Chọn Mẫu kết quả..." 
                           style={{ width: 250 }}
                           loading={isLoading}
                           onChange={handleApplyTemplate}
                           value={selectedTemplate?.id}
                       >
                           {templates.map((t: any) => <Option key={t.id} value={t.id}>{t.name}</Option>)}
                       </Select>
                  </div>
             </div>
             
             <div className="flex-1 overflow-auto p-6 bg-gray-50 custom-scrollbar print:p-0 print:bg-white">
                  <Card bordered={false} className="max-w-4xl mx-auto shadow-sm print:shadow-none">
                       
                        <div className="mb-6">
                            <h3 className="font-bold text-gray-700 mb-2 uppercase border-b pb-1">Mô tả tổn thương</h3>
                            <div className="p-4 bg-gray-50 rounded border border-gray-200 min-h-[120px]">
                                {description ? renderSmartContent(description, 'desc', false) : <span className="text-gray-400 italic">Vui lòng chọn mẫu...</span>}
                            </div>
                        </div>

                        <div className="mb-6">
                            <h3 className="font-bold text-red-600 mb-2 uppercase border-b pb-1">Kết luận (Chính)</h3>
                            <div className="p-4 bg-red-50/30 rounded border border-red-100 min-h-[60px] mb-2">
                                {conclusion ? renderSmartContent(conclusion, 'conc', true) : <span className="text-gray-400 italic">Kết luận tự động...</span>}
                            </div>
                            <Input.TextArea
                                rows={2}
                                className="font-mono text-sm"
                                value={customConclusion}
                                onChange={(e) => setCustomConclusion(e.target.value)}
                                placeholder="Kết luận bổ sung (KTV gõ thêm tay nếu cần)..."
                            />
                        </div>

                       <div className="mb-6">
                            <h3 className="font-bold text-gray-700 mb-2 uppercase border-b pb-1">Lời khuyên / Đề nghị</h3>
                            <Input.TextArea 
                                rows={3}
                                className="font-mono text-base"
                                value={recommendation}
                                onChange={(e: any) => setRecommendation(e.target.value)}
                                placeholder="Đề nghị khám chuyên khoa..."
                            />
                       </div>

                  </Card>
             </div>

             <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 print:hidden">
                 {/* Nút In phiếu độc lập */}
                 <Button 
                     size="large" 
                     icon={<PrinterOutlined />} 
                     onClick={handlePrint}
                 >
                     In Phiếu
                 </Button>

                 {/* Nút Lưu Nháp */}
                 <Button 
                     size="large" 
                     icon={<SaveOutlined />} 
                     onClick={() => handleSubmit('draft')} 
                     loading={isSubmitting}
                 >
                     Lưu Nháp
                 </Button>

                 {/* Nút Hoàn thành (Chốt kết quả) */}
                 <Button 
                     size="large" 
                     type="primary" 
                     icon={<CheckCircleOutlined />} 
                     onClick={() => handleSubmit('completed')} 
                     loading={isSubmitting} 
                     style={{ backgroundColor: '#1890ff' }}
                 >
                     Hoàn Thành
                 </Button>
             </div>
        </div>
    );
};
