export function buildHtmlEmail(type, data) {
  const brandColor = "#0d9488";
  const brandName = "Nam Việt";
  const wrapper = (title, body) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:${brandColor};padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${brandName}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;">
                &copy; ${new Date().getFullYear()} ${brandName}. Tất cả quyền được bảo lưu.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const businessLabel = data.business_name
    ? `<strong>${data.business_name}</strong>`
    : "Quý khách";
  switch (type) {
    case "registration_received": {
      const subject = `[${brandName}] Đã nhận đơn đăng ký của bạn`;
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Xác nhận đơn đăng ký</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Xin chào ${businessLabel},
        </p>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Chúng tôi đã nhận được đơn đăng ký của bạn trên hệ thống <strong>${brandName}</strong>.
          Đơn của bạn đang được xem xét và chúng tôi sẽ thông báo kết quả trong thời gian sớm nhất.
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#f0fdfa;border-left:4px solid ${brandColor};border-radius:4px;">
          <p style="margin:0;color:#0f766e;font-size:14px;">
            <strong>Trạng thái:</strong> Đang chờ duyệt
          </p>
        </div>
        <p style="margin:0;color:#6b7280;font-size:14px;">
          Nếu bạn có thắc mắc, vui lòng liên hệ bộ phận hỗ trợ của chúng tôi.
        </p>`;
      return {
        subject,
        html: wrapper(subject, body),
      };
    }
    case "registration_approved": {
      const subject = `[${brandName}] Tài khoản của bạn đã được kích hoạt`;
      const portalUrl = data.portal_url || "#";
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Tài khoản đã kích hoạt</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Xin chào ${businessLabel},
        </p>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Chúc mừng! Đơn đăng ký của bạn đã được phê duyệt. Tài khoản trên hệ thống
          <strong>${brandName}</strong> đã sẵn sàng sử dụng.
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${portalUrl}"
             style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
            Đăng nhập Portal
          </a>
        </div>
        <p style="margin:0 0 12px;color:#6b7280;font-size:13px;text-align:center;">
          Hoặc truy cập: <a href="${portalUrl}" style="color:${brandColor};">${portalUrl}</a>
        </p>
        <p style="margin:16px 0 0;color:#6b7280;font-size:14px;">
          Nếu bạn có thắc mắc, vui lòng liên hệ bộ phận hỗ trợ của chúng tôi.
        </p>`;
      return {
        subject,
        html: wrapper(subject, body),
      };
    }
    case "registration_rejected": {
      const subject = `[${brandName}] Thông báo về đơn đăng ký`;
      const reason = data.reason || "Không đủ điều kiện";
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Kết quả xét duyệt</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Xin chào ${businessLabel},
        </p>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Sau khi xem xét, chúng tôi rất tiếc phải thông báo rằng đơn đăng ký
          của bạn trên hệ thống <strong>${brandName}</strong> chưa được chấp thuận.
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#fef2f2;border-left:4px solid #ef4444;border-radius:4px;">
          <p style="margin:0;color:#991b1b;font-size:14px;">
            <strong>Lý do:</strong> ${reason}
          </p>
        </div>
        <p style="margin:0;color:#374151;font-size:15px;line-height:1.6;">
          Bạn có thể liên hệ bộ phận hỗ trợ để được tư vấn thêm hoặc nộp đơn mới sau khi
          đã bổ sung đầy đủ thông tin cần thiết.
        </p>`;
      return {
        subject,
        html: wrapper(subject, body),
      };
    }
    case "admin_new_registration": {
      const bName = data.business_name || "Không rõ";
      const subject = `[${brandName}] Đăng ký Portal mới: ${bName}`;
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Đăng ký Portal mới</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Có một đơn đăng ký Portal mới cần duyệt:
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#f0fdfa;border-left:4px solid ${brandColor};border-radius:4px;">
          <table style="width:100%;font-size:14px;color:#374151;">
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Doanh nghiệp:</td>
              <td style="padding:4px 8px;">${bName}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Người liên hệ:</td>
              <td style="padding:4px 8px;">${data.contact_name || "—"}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Email:</td>
              <td style="padding:4px 8px;">${data.contact_email || "—"}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Điện thoại:</td>
              <td style="padding:4px 8px;">${data.contact_phone || "—"}</td>
            </tr>
          </table>
        </div>
        <div style="margin:24px 0;text-align:center;">
          <a href="#/portal/registrations"
             style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
            Xem & Duyệt đơn
          </a>
        </div>`;
      return {
        subject,
        html: wrapper(subject, body),
      };
    }
    case "admin_new_order": {
      const orderCode = data.order_code || "N/A";
      const custName = data.customer_name || "Khách hàng";
      const totalAmt =
        data.total_amount != null
          ? new Intl.NumberFormat("vi-VN").format(data.total_amount) + " đ"
          : "0 đ";
      const subject = `[${brandName}] Đơn hàng Portal mới: ${orderCode}`;
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Đơn hàng Portal mới</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Có đơn hàng mới từ Portal cần xử lý:
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#f0fdfa;border-left:4px solid ${brandColor};border-radius:4px;">
          <table style="width:100%;font-size:14px;color:#374151;">
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Mã đơn:</td>
              <td style="padding:4px 8px;">${orderCode}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Khách hàng:</td>
              <td style="padding:4px 8px;">${custName}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Tổng tiền:</td>
              <td style="padding:4px 8px;font-weight:700;color:${brandColor};">${totalAmt}</td>
            </tr>
          </table>
        </div>
        <div style="margin:24px 0;text-align:center;">
          <a href="#/sales/orders"
             style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
            Xem đơn hàng
          </a>
        </div>`;
      return {
        subject,
        html: wrapper(subject, body),
      };
    }
    case "admin_payment_received": {
      const amt = data.amount || "0 đ";
      const partner = data.partner_name || "Không rõ";
      const ref = data.reference || "N/A";
      const desc = data.description || "";
      const subject = `[${brandName}] Thanh toán mới: ${amt}`;
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Thanh toán mới</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Hệ thống vừa ghi nhận một khoản thanh toán:
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#f0fdfa;border-left:4px solid ${brandColor};border-radius:4px;">
          <table style="width:100%;font-size:14px;color:#374151;">
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Số tiền:</td>
              <td style="padding:4px 8px;font-weight:700;color:${brandColor};">${amt}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Đối tác:</td>
              <td style="padding:4px 8px;">${partner}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Tham chiếu:</td>
              <td style="padding:4px 8px;">${ref}</td>
            </tr>
            ${
              desc
                ? `<tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Mô tả:</td>
              <td style="padding:4px 8px;">${desc}</td>
            </tr>`
                : ""
            }
          </table>
        </div>
        <div style="margin:24px 0;text-align:center;">
          <a href="#/finance"
             style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
            Xem tài chính
          </a>
        </div>`;
      return {
        subject,
        html: wrapper(subject, body),
      };
    }
    case "portal_user_invite": {
      const subject = `[${brandName}] Tài khoản Portal đã được tạo`;
      const actionLink = data.action_link || "#";
      const displayName =
        data.display_name || data.business_name || "Quý khách";
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Mời kích hoạt tài khoản Portal</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Xin chào <strong>${displayName}</strong>,
        </p>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Quản trị viên đã tạo tài khoản B2B Portal cho bạn trên hệ thống <strong>${brandName}</strong>.
          Vui lòng bấm nút bên dưới để đặt mật khẩu lần đầu.
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${actionLink}"
             style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
            Đặt mật khẩu tài khoản
          </a>
        </div>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Nếu nút không hoạt động, sao chép liên kết sau vào trình duyệt:<br/>
          <a href="${actionLink}" style="color:${brandColor};word-break:break-all;">${actionLink}</a>
        </p>`;
      return {
        subject,
        html: wrapper(subject, body),
      };
    }
    case "payment_reminder": {
      const orderCode = data.order_code || "N/A";
      const displayName =
        data.display_name || data.business_name || "Quý khách";
      const portalUrl = data.portal_url || "#";
      const totalAmt =
        data.total_amount != null
          ? new Intl.NumberFormat("vi-VN").format(data.total_amount) + " đ"
          : "0 đ";
      const remainAmt =
        data.remaining_amount != null
          ? new Intl.NumberFormat("vi-VN").format(data.remaining_amount) + " đ"
          : totalAmt;
      const hoursLeft =
        typeof data.hours_left === "number"
          ? Math.max(0, Math.round(data.hours_left))
          : 0;
      const subject = `[${brandName}] Nhắc thanh toán đơn ${orderCode}`;
      const urgency =
        hoursLeft <= 4
          ? `<strong style="color:#b91c1c;">Đơn sẽ tự hủy trong ~${hoursLeft} giờ nữa nếu chưa thanh toán.</strong>`
          : `Đơn sẽ tự hủy sau ${hoursLeft} giờ nữa nếu chưa thanh toán.`;
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Đơn hàng đang chờ thanh toán</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Xin chào <strong>${displayName}</strong>,
        </p>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Đơn hàng <strong>${orderCode}</strong> của bạn trên <strong>${brandName}</strong> hiện đang ở trạng thái
          <em>chờ thanh toán</em>. ${urgency}
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;">
          <table style="width:100%;font-size:14px;color:#374151;">
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Mã đơn:</td>
              <td style="padding:4px 8px;">${orderCode}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Tổng tiền:</td>
              <td style="padding:4px 8px;">${totalAmt}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Cần thanh toán:</td>
              <td style="padding:4px 8px;font-weight:700;color:#b45309;">${remainAmt}</td>
            </tr>
          </table>
        </div>
        <div style="margin:24px 0;text-align:center;">
          <a href="${portalUrl}"
             style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
            Thanh toán ngay
          </a>
        </div>
        <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">
          Nếu bạn đã chuyển khoản, vui lòng bỏ qua email này — hệ thống sẽ tự động cập nhật trong vài phút.
        </p>`;
      return {
        subject,
        html: wrapper(subject, body),
      };
    }
    case "payment_received_customer": {
      const orderCode = data.order_code || "N/A";
      const displayName =
        data.display_name || data.business_name || "Quý khách";
      const amount =
        data.amount != null
          ? new Intl.NumberFormat("vi-VN").format(Number(data.amount)) + " đ"
          : "0 đ";
      const totalPaid =
        data.total_paid != null
          ? new Intl.NumberFormat("vi-VN").format(data.total_paid) + " đ"
          : amount;
      const finalAmt =
        data.final_amount != null
          ? new Intl.NumberFormat("vi-VN").format(data.final_amount) + " đ"
          : totalPaid;
      const remainAmt =
        data.remaining_amount != null
          ? new Intl.NumberFormat("vi-VN").format(data.remaining_amount) + " đ"
          : "0 đ";
      const subject = data.status_confirmed
        ? `[${brandName}] Đơn ${orderCode} đã thanh toán đủ`
        : `[${brandName}] Đã nhận ${amount} cho đơn ${orderCode}`;
      const heading = data.status_confirmed
        ? "Đơn hàng đã thanh toán đủ"
        : "Xác nhận đã nhận thanh toán";
      const statusRow = data.status_confirmed
        ? `<tr><td colspan="2" style="padding:8px;background:#dcfce7;color:#166534;border-radius:4px;font-weight:600;">Đơn đã xác nhận, đội kho sẽ sớm chuẩn bị hàng.</td></tr>`
        : `<tr><td style="padding:4px 8px;font-weight:600;">Còn thiếu:</td><td style="padding:4px 8px;color:#b45309;font-weight:700;">${remainAmt}</td></tr>`;
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">${heading}</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Xin chào <strong>${displayName}</strong>,
        </p>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          ${brandName} đã nhận được <strong>${amount}</strong> cho đơn <strong>${orderCode}</strong>.
        </p>
        <div style="margin:24px 0;padding:16px;background-color:#f0fdf4;border-left:4px solid #22c55e;border-radius:4px;">
          <table style="width:100%;font-size:14px;color:#374151;">
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Mã đơn:</td>
              <td style="padding:4px 8px;">${orderCode}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Số tiền lần này:</td>
              <td style="padding:4px 8px;">${amount}</td>
            </tr>
            <tr>
              <td style="padding:4px 8px;font-weight:600;white-space:nowrap;">Đã thanh toán:</td>
              <td style="padding:4px 8px;">${totalPaid} / ${finalAmt}</td>
            </tr>
            ${statusRow}
          </table>
        </div>
        <p style="margin:16px 0 0;color:#6b7280;font-size:13px;">
          Cảm ơn Quý khách đã tin tưởng ${brandName}.
        </p>`;
      return {
        subject,
        html: wrapper(subject, body),
      };
    }
    case "payment_received_internal": {
      const orderCode = data.order_code || "N/A";
      const customerName = data.customer_name || "Khách lẻ";
      const amount =
        data.amount != null
          ? new Intl.NumberFormat("vi-VN").format(Number(data.amount)) + " đ"
          : "0 đ";
      const finalAmt =
        data.final_amount != null
          ? new Intl.NumberFormat("vi-VN").format(data.final_amount) + " đ"
          : "-";
      const remainAmt =
        data.remaining_amount != null
          ? new Intl.NumberFormat("vi-VN").format(data.remaining_amount) + " đ"
          : "0 đ";
      const subject = `[ERP] ${customerName} đã thanh toán ${amount} — đơn ${orderCode}`;
      const statusLine = data.status_confirmed
        ? `<p style="margin:0 0 12px;color:#166534;font-weight:600;">Đơn đã chuyển CONFIRMED, sẵn sàng đóng gói.</p>`
        : `<p style="margin:0 0 12px;color:#b45309;">Đơn vẫn đang chờ đủ tiền. Còn thiếu: <strong>${remainAmt}</strong>.</p>`;
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Thông báo thu tiền nội bộ</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Khách <strong>${customerName}</strong> đã thanh toán <strong>${amount}</strong> cho đơn <strong>${orderCode}</strong> (tổng đơn ${finalAmt}).
        </p>
        ${statusLine}`;
      return {
        subject,
        html: wrapper(subject, body),
      };
    }
    case "portal_user_reset_password": {
      const subject = `[${brandName}] Yêu cầu đặt lại mật khẩu Portal`;
      const actionLink = data.action_link || "#";
      const displayName =
        data.display_name || data.business_name || "Quý khách";
      const body = `
        <h2 style="margin:0 0 16px;color:#111827;font-size:20px;">Đặt lại mật khẩu</h2>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Xin chào <strong>${displayName}</strong>,
        </p>
        <p style="margin:0 0 12px;color:#374151;font-size:15px;line-height:1.6;">
          Bạn vừa yêu cầu gửi lại liên kết đặt mật khẩu cho tài khoản B2B Portal.
          Vui lòng bấm nút bên dưới để tạo mật khẩu mới.
        </p>
        <div style="margin:24px 0;text-align:center;">
          <a href="${actionLink}"
             style="display:inline-block;padding:14px 32px;background-color:${brandColor};color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">
            Đặt lại mật khẩu
          </a>
        </div>
        <p style="margin:0;color:#6b7280;font-size:13px;">
          Nếu bạn không thực hiện yêu cầu này, có thể bỏ qua email.<br/>
          Liên kết trực tiếp: <a href="${actionLink}" style="color:${brandColor};word-break:break-all;">${actionLink}</a>
        </p>`;
      return {
        subject,
        html: wrapper(subject, body),
      };
    }
  }
}
