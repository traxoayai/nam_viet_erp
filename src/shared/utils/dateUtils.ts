// src/shared/utils/dateUtils.ts
import dayjs from "dayjs";

/**
 * Tính tuổi chính xác theo năm, tháng, ngày
 * @param dob Date of Birth (ISO string or Date)
 * @returns string format: 
 * - > 1 year: "X tuổi Y tháng"
 * - < 1 year: "X tháng Y ngày"
 * - No dob: "Chưa cập nhật ngày sinh"
 */
export const calculateExactAge = (dob: string | Date | null | undefined): string => {
    if (!dob) return 'Chưa cập nhật ngày sinh';

    const birthDate = dayjs(dob);
    const now = dayjs();

    if (!birthDate.isValid() || birthDate.isAfter(now)) {
        return 'Ngày sinh không hợp lệ';
    }

    const years = now.diff(birthDate, 'year');
    const dateWithYears = birthDate.add(years, 'year');
    
    const months = now.diff(dateWithYears, 'month');
    const dateWithMonths = dateWithYears.add(months, 'month');
    
    const days = now.diff(dateWithMonths, 'day');

    if (years >= 1) {
        let result = `${years} tuổi`;
        if (months > 0) result += ` ${months} tháng`;
        return result;
    } else {
        // Under 1 year
        let result = '';
        if (months > 0) result += `${months} tháng `;
        result += `${days} ngày`;
        return result.trim();
    }
};
