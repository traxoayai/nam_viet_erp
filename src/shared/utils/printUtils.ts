/**
 * Opens a new window with the given HTML content and triggers the print dialog.
 * @param htmlContent The complete HTML string to print
 */
export const printHTML = (htmlContent: string) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Vui lòng cho phép popup để in phiếu.");
    return;
  }
  renderAndPrint(printWindow, htmlContent);
};

// Mở cửa sổ in ngay trong user-gesture (click handler) để tránh bị popup blocker
// chặn khi hàm print cần await data trước lúc ghi HTML.
export const openPrintWindow = (): Window | null => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Vui lòng cho phép popup để in phiếu.");
    return null;
  }
  printWindow.document.write(
    "<p style=\"font-family: sans-serif; padding: 24px\">Đang chuẩn bị phiếu in...</p>"
  );
  return printWindow;
};

export const renderAndPrint = (printWindow: Window, htmlContent: string) => {
  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};
