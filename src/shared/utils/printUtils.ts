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

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();

  // Small delay to ensure styles/images load (if any)
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
};
