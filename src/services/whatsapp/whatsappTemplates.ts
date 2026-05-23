import { formatRupiah } from '../../utils/formatting';

export interface TemplateVariables {
  customerName: string;
  invoiceNumber: string;
  outletName: string;
  remainingBalance: number;
  estimatedDoneDate?: string;
  servicesSummary?: string;
  pickupInfo?: string;
}

export type TemplateType =
  | 'order_received'
  | 'order_processing'
  | 'order_ready'
  | 'order_completed'
  | 'payment_reminder';

export interface WhatsAppTemplate {
  name: string;
  render(vars: TemplateVariables): string;
}

export const WHATSAPP_TEMPLATES: Record<TemplateType, WhatsAppTemplate> = {
  order_received: {
    name: 'Order Diterima (Pendaftaran)',
    render: (vars) => {
      const remainingText = vars.remainingBalance > 0 
        ? `Sisa Tagihan: *${formatRupiah(vars.remainingBalance)}*` 
        : 'Status Pembayaran: *LUNAS* ✅';

      const estText = vars.estimatedDoneDate 
        ? `\n📅 Estimasi Selesai: *${vars.estimatedDoneDate}*` 
        : '';

      return `Halo Kak *${vars.customerName}*! 👋

Cucian Kakak telah diterima dengan baik di *${vars.outletName}*. Terima kasih banyak atas kepercayaan Kakak! 🧺✨

📝 Nomor Invoice: *#${vars.invoiceNumber}*
${vars.servicesSummary ? `🧺 Rincian Layanan: ${vars.servicesSummary}` : ''}${estText}
💰 ${remainingText}

Kami akan memproses pakaian Kakak dengan penuh kehati-hatian, bersih, higienis, dan wangi. Kami akan menginfokan kembali jika laundry sudah siap diambil.

Hormat kami, Tim LaundryKu *${vars.outletName}* 🫧`;
    }
  },

  order_processing: {
    name: 'Order Diproses (Cuci-Setrika)',
    render: (vars) => {
      const estText = vars.estimatedDoneDate 
        ? `\n📅 Estimasi Selesai: *${vars.estimatedDoneDate}*` 
        : '';

      return `Halo Kak *${vars.customerName}*! 👋

Update terkini: Cucian Kakak dengan Invoice *#${vars.invoiceNumber}* saat ini *SEDANG DIPROSES* oleh tim handal kami di *${vars.outletName}*. 🫧🧼

Pakaian Kakak sedang melewati tahap treatment terbaik demi memastikan hasil bersih, higienis, dan harum sempurna.${estText}

Terima kasih atas kesabarannya menunggu! 👕👖`;
    }
  },

  order_ready: {
    name: 'Order Siap (Selesai Proses)',
    render: (vars) => {
      const remainingText = vars.remainingBalance > 
          0 ? `\n\n📌 *Harap diketahui:* Masih terdapat sisa tagihan sebesar *${formatRupiah(vars.remainingBalance)}*. Pembayaran dapat diselesaikan di kassa saat pengambilan.` 
        : '\n\nStatus Pembayaran: *LUNAS* ✅ (Terima kasih)';

      const pickupText = vars.pickupInfo 
        ? `\nℹ️ Info Tambahan: ${vars.pickupInfo}` 
        : '';

      return `Kabar Gembira Kak *${vars.customerName}*! 🎉

Cucian Kakak dengan nomor Invoice *#${vars.invoiceNumber}* di *${vars.outletName}* kini *SUDAH SELESAI* diproses rapi, harum, dan *SIAP UNTUK DIANTAR / DIAMBIL*. 📦👔
${remainingText}${pickupText}

Silakan kunjungi outlet kami pada jam operasional untuk pengambilan, dengan menunjukkan nomor invoice di atas kepada kasir kami.

Sampai jumpa di outlet! 👋😊`;
    }
  },

  order_completed: {
    name: 'Order Selesai (Diambil)',
    render: (vars) => {
      return `Halo Kak *${vars.customerName}*! 👋

Terima kasih banyak telah menyelesaikan pengambilan cucian dengan Invoice *#${vars.invoiceNumber}* di *${vars.outletName}*. 🧺✨

Senang sekali bisa melayani kebutuhan laundry Kakak. Kami harap Kakak puas dengan kebersihan, keharuman, dan kerapian cucian kami.

Jika Kakak senang dengan pelayanan kami, jangan ragu untuk berbagi rekomendasi kepada keluarga dan kerabat terdekat ya! Ditunggu kedatangan berikutnya. 😊🌟`;
    }
  },

  payment_reminder: {
    name: 'Tagihan Pembayaran (Pengingat)',
    render: (vars) => {
      return `Halo Kak *${vars.customerName}*! 🙏

Ini adalah pesan pengingat ramah dari kami mengenai tagihan transaksi laundry Kakak di *${vars.outletName}*.

📝 Nomor Invoice: *#${vars.invoiceNumber}*
💰 Sisa Tagihan Belum Lunas: *${formatRupiah(vars.remainingBalance)}*

Mohon kesediaan Kakak untuk melakukan pelunasan tagihan tersebut di kasir outlet atau melalui transfer bank demi kemudahan administrasi.

Terima kasih banyak atas kerja sama dan pengertian Kakak! Have a wonderful day. 🌸`;
    }
  }
};
