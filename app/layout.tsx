import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Chia Đơn Không Chia Ly 💰',
  description: 'Ứng dụng chia tiền & chốt sổ nợ tự động - Nhắc nợ không du di!',
  openGraph: {
    title: 'Chia Đơn Không Chia Ly 💰',
    description: 'Ứng dụng chia tiền & chốt sổ nợ tự động - Nhắc nợ không du di!',
    url: 'https://chia-don-khong-chia-ly.vercel.app',
    siteName: 'Chia Đơn Không Chia Ly',
    locale: 'vi_VN',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
