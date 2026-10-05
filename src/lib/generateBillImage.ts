import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

function resolveReceiptElement(element: HTMLElement): HTMLElement {
  const receiptRoot = element.querySelector<HTMLElement>('[data-receipt-root="true"]');
  return receiptRoot || element;
}

function createCaptureClone(target: HTMLElement): { container: HTMLDivElement; clone: HTMLElement } {
  const width = Math.ceil(target.scrollWidth || target.offsetWidth || target.clientWidth || target.getBoundingClientRect().width || 400);

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.background = '#ffffff';
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.width = `${width}px`;
  container.style.minWidth = `${width}px`;
  container.style.maxWidth = `${width}px`;
  container.style.overflow = 'hidden';

  const clone = target.cloneNode(true) as HTMLElement;
  clone.style.width = `${width}px`;
  clone.style.minWidth = `${width}px`;
  clone.style.maxWidth = `${width}px`;
  clone.style.margin = '0';

  container.appendChild(clone);
  document.body.appendChild(container);

  return { container, clone };
}

async function waitForReceiptRender(): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
  }

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Open TinyPrint app via Android Intent to print a bill
 * Package: com.frogtosea.tinyPrint
 */
export function openTinyPrintApp(): void {
  if (typeof window !== 'undefined' && /Android/i.test(navigator.userAgent)) {
    try {
      // Try to open TinyPrint app directly via intent URL scheme
      window.location.href = 'intent://#Intent;package=com.frogtosea.tinyPrint;action=android.intent.action.VIEW;end';
    } catch (e) {
      console.log('TinyPrint app not installed, fallback to download');
    }
  }
}

/**
 * Share bill image to TinyPrint app via Android Intent
 * If app not installed or not Android, falls back to download
 */
export async function shareToTinyPrint(
  element: HTMLElement,
  invoiceNumber: string,
  shopName: string
): Promise<void> {
  // Capture receipt first
  const dataUrl = await captureReceiptAsBase64(element);

  // On Android, try to open TinyPrint app directly via intent
  if (typeof window !== 'undefined' && /Android/i.test(navigator.userAgent)) {
    try {
      window.location.href = 'intent://#Intent;package=com.frogtosea.tinyPrint;action=android.intent.action.VIEW;end';
    } catch (e) {
      // TinyPrint app not installed - download the image as fallback
      console.log('TinyPrint app not installed, downloading bill image');
      await downloadBillImage(element, invoiceNumber);
    }
  } else {
    // Non-Android: download the image
    await downloadBillImage(element, invoiceNumber);
  }
}

/**
 * Capture a DOM element as a base64 PNG image (high resolution)
 */
export async function captureReceiptAsBase64(element: HTMLElement): Promise<string> {
  let captureContainer: HTMLDivElement | null = null;
  try {
    const target = resolveReceiptElement(element);
    await waitForReceiptRender();

    const { container, clone } = createCaptureClone(target);
    captureContainer = container;

    await waitForReceiptRender();

    const width = Math.ceil(clone.scrollWidth || clone.offsetWidth || clone.clientWidth || clone.getBoundingClientRect().width || 400);
    const height = Math.ceil(clone.scrollHeight || clone.offsetHeight || clone.clientHeight || 1);
    const options = {
      scale: 3,              // 3x resolution (renders at 3x pixel density)
      backgroundColor: '#ffffff',
      useCORS: true,         // allow logo/images to render
      allowTaint: false,
      logging: false,
      imageTimeout: 15000,   // wait longer for images to load
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDoc: Document) => {
        // Make sure fonts are loaded in cloned document
        const clonedElement = clonedDoc.querySelector('[data-receipt-root="true"]') as HTMLElement;
        if (clonedElement) {
          clonedElement.style.fontFamily = '"Courier New", Courier, monospace';
        }
      }
    } as any;
    const canvas = await html2canvas(clone, options);

    // Use PNG for lossless maximum quality (Fix 2)
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl;
  } catch (error) {
    console.error('Error capturing receipt:', error);
    throw error;
  } finally {
    captureContainer?.remove();
  }
}

/**
 * Get formatted date for filename
 */
function getFormattedDate(): string {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Download a receipt as a PNG file
 */
export async function downloadBillImage(
  element: HTMLElement,
  invoiceNumber: string
): Promise<void> {
  try {
    const dataUrl = await captureReceiptAsBase64(element);

    // Create a link element with date in filename
    const link = document.createElement('a');
    link.download = `INV-${invoiceNumber.replace('INV-', '')}-${getFormattedDate()}.png`;
    link.href = dataUrl;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading bill image:', error);
    throw error;
  }
}

/**
 * Get filename from invoice number
 */
function getFilename(invoiceNumber: string): string {
  return `INV-${invoiceNumber.replace('INV-', '')}.png`;
}

/**
 * Check if Web Share API is available and can be used
 */
export function canUseWebShare(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.share === 'function' && typeof navigator.canShare === 'function';
}

/**
 * Share a receipt using Web Share API
 */
export async function shareBillImage(
  element: HTMLElement,
  invoiceNumber: string,
  shopName: string
): Promise<boolean> {
  try {
    const dataUrl = await captureReceiptAsBase64(element);

    // Convert base64 to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create file from blob
    const file = new File([blob], getFilename(invoiceNumber), {
      type: 'image/png',
    });

    // Check if sharing is supported with the file
    const shareData = {
      title: `Bill ${invoiceNumber} - ${shopName}`,
      text: `Your bill from ${shopName}. Invoice: ${invoiceNumber}`,
      files: [file],
    };

    if (navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return true;
    } else {
      // Fallback to download
      await downloadBillImage(element, invoiceNumber);
      return false;
    }
  } catch (error: any) {
    // User cancelled or error - fallback to download
    if (error.name !== 'AbortError') {
      console.error('Error sharing bill:', error);
      await downloadBillImage(element, invoiceNumber);
    }
    return false;
  }
}

/**
 * Check if device is mobile
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Share via WhatsApp
 * Note: WhatsApp API cannot directly attach images, so we open WhatsApp with message and download the image
 */
export async function shareViaWhatsApp(
  element: HTMLElement,
  invoiceNumber: string,
  shopName: string,
  totalAmount: number
): Promise<void> {
  try {
    // First download the image
    await downloadBillImage(element, invoiceNumber);

    // Create WhatsApp message
    const message = encodeURIComponent(
      `Your bill from ${shopName}.\nInvoice: ${invoiceNumber}\nTotal: â‚¹${totalAmount.toFixed(2)}`
    );

    // Open WhatsApp
    const whatsappUrl = `https://api.whatsapp.com/send?text=${message}`;
    window.open(whatsappUrl, '_blank');
  } catch (error) {
    console.error('Error sharing via WhatsApp:', error);
    throw error;
  }
}

/**
 * Download a receipt as a PDF file
 */
export async function downloadBillPDF(
  element: HTMLElement,
  invoiceNumber: string
): Promise<void> {
  try {
    const dataUrl = await captureReceiptAsBase64(element);

    // Create PDF with receipt dimensions (80mm thermal paper)
    const preview = new Image();
    preview.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      preview.onload = () => resolve();
      preview.onerror = () => reject(new Error('Failed to measure receipt image'));
    });

    const pdfWidth = 80;
    const pdfHeight = (preview.height * pdfWidth) / preview.width;
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });

    // Add image to PDF using PNG
    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

    // Save PDF
    pdf.save(`INV-${invoiceNumber.replace('INV-', '')}-${getFormattedDate()}.pdf`);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    throw error;
  }
}
